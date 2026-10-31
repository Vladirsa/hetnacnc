/**
 * HETNA TURN STUDIO — Generador de G-code (Node/TypeScript)
 *
 * Laboratorio CAM > Torno 4 ejes (/cam/torno). Port del generador del
 * prototipo (torneado_perfil.py / hetna-turn-studio-ui.jsx). Corre en el
 * servidor de Next.js (POST /api/cam/torno): NO necesita Python.
 *
 * CONVENCIÓN DE EJES (la de tu router con 4to eje):
 *   A = eje rotativo (gira la pieza)
 *   X = longitud a lo largo de la pieza (el eje A va montado paralelo a X,
 *       como en casi todos los routers; se puede elegir Y si el tuyo va
 *       atravesado)
 *   Z = radio de corte (Z0 calibrado en el CENTRO del eje rotativo)
 *
 * AVANCE: por defecto G94 (mm/min), que es lo que Mach3 y Mach4 corren sin
 * problema. Como esos controles suman los grados del eje A como si fueran
 * milímetros, la F de cada bloque se calcula para que el bloque dure lo que
 * debe durar según las RPM de la pieza (igual que hacen los posprocesadores
 * "wrap" de Vectric). Opcionalmente G93 (tiempo inverso, F = 1 / minutos del
 * bloque), que es exacto en LinuxCNC pero en Mach3 no es confiable.
 *
 * CÓMO SE CORTA: cada pasada es una espiral. Mientras la fresa avanza
 * a lo largo, la pieza gira; por cada vuelta completa la fresa avanza un
 * "paso" (lead). El ángulo A se ACUMULA dentro de cada pasada
 * (0, 144, 288, 432...). Al empezar la siguiente pasada se pone G92 A0: el
 * contador vuelve a cero SIN mover la pieza. Así no desenrolla cientos de
 * vueltas en vacío (lo que haría un G0 A0) y los números no crecen sin fin.
 */

import {
  Segmento,
  TipoSegmento,
  Tallados,
  Estrias,
  Espiral,
  anguloEspiral,
  radioEn,
  longitudTotal,
  radioMaximo,
  radioMinEnRango,
  MATERIAL_PRESETS,
} from "./pieza";

export interface ParametrosMaquina {
  stockWidthMm: number;
  startOffsetMm: number;
  endOffsetMm: number;
  safeZClearanceMm: number;
}

export interface ParametrosHerramienta {
  toolDiameterMm: number;
  feed: number;
}

export interface ParametrosRpm {
  /** RPM de la PIEZA (mandril), no de la fresa */
  rpmCilindrado: number;
  rpmDesbaste: number;
  rpmAcabado: number;
}

export type OrigenPunto = "mandril" | "contrapunto";
/** Eje lineal que recorre el largo de la pieza (el eje A gira sobre él). */
export type EjeLargo = "X" | "Y";
/** G94 = avance normal en mm/min (Mach3/Mach4). G93 = tiempo inverso (LinuxCNC). */
export type ModoAvance = "G94" | "G93";

export interface EntradaGCode {
  segmentos: Segmento[];
  material: string;
  maquina: ParametrosMaquina;
  herramienta: ParametrosHerramienta;
  rpm: ParametrosRpm;
  origenPunto: OrigenPunto;
  ejeLargo?: EjeLargo;
  avance?: ModoAvance;
  numPasadasDesbaste?: number;
  /** Estrías y espiral, que se cortan después del acabado */
  tallados?: Tallados;
}

export interface ResultadoGCode {
  gcode: string;
  totalLineas: number;
  longitudTotalMm: number;
  radioMaximoMm: number;
  /** Minutos aproximados de corte (sin contar movimientos rápidos) */
  minutosEstimados: number;
  /** Avisos para el usuario (datos que no cuadran, cosas por revisar) */
  avisos: string[];
}

// ── Límites de lo que acepta el generador ──────────────────────────────
// Protegen al servidor (una pieza de 50 m sería un programa de millones de
// líneas) y al usuario (una fresa de 0.01 mm o 5000 rpm de pieza no existen).
export const LIMITES = {
  maxSegmentos: 60,
  maxLargoMm: 3000,
  maxRadioMm: 300,
  maxStockMm: 600,
  herramientaMm: [1, 50] as const,
  rpmPieza: [1, 600] as const,
  maxPasadasDesbaste: 40,
  maxLineas: 250_000,
};

const TIPOS: TipoSegmento[] = ["cilindro", "cono", "esfera", "cova"];

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const finito = (v: unknown) => Number.isFinite(num(v));

/**
 * Revisa lo que mandó el navegador y lo convierte en una entrada limpia.
 * Devuelve el error en palabras de taller, no en términos de programación.
 */
export function validarEntrada(body: unknown): { ok: true; entrada: EntradaGCode } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, any>;
  const segs = Array.isArray(b.segmentos) ? b.segmentos : [];
  if (!segs.length) return { ok: false, error: "Falta el diseño: agrega al menos un segmento a la pieza." };
  if (segs.length > LIMITES.maxSegmentos)
    return { ok: false, error: `Son demasiados segmentos (máximo ${LIMITES.maxSegmentos}).` };

  const segmentos: Segmento[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] ?? {};
    const n = i + 1;
    if (!TIPOS.includes(s.tipo)) return { ok: false, error: `El segmento ${n} tiene un tipo que no existe.` };
    if (![s.inicioY, s.finY, s.radioInicio, s.radioFin].every(finito))
      return { ok: false, error: `El segmento ${n} tiene un número vacío o inválido.` };
    const seg: Segmento = {
      id: String(s.id ?? `seg-${n}`).slice(0, 60),
      tipo: s.tipo,
      inicioY: num(s.inicioY),
      finY: num(s.finY),
      radioInicio: num(s.radioInicio),
      radioFin: num(s.radioFin),
    };
    if (seg.inicioY < 0) return { ok: false, error: `El segmento ${n} empieza antes de 0 mm.` };
    if (seg.finY <= seg.inicioY) return { ok: false, error: `En el segmento ${n}, "Termina" debe ser mayor que "Empieza".` };
    if (seg.finY > LIMITES.maxLargoMm)
      return { ok: false, error: `La pieza no puede medir más de ${LIMITES.maxLargoMm} mm de largo.` };
    if (seg.radioInicio <= 0 || seg.radioFin <= 0)
      return { ok: false, error: `En el segmento ${n} los radios deben ser mayores que 0.` };
    if (seg.radioInicio > LIMITES.maxRadioMm || seg.radioFin > LIMITES.maxRadioMm)
      return { ok: false, error: `En el segmento ${n} el radio pasa de ${LIMITES.maxRadioMm} mm.` };
    segmentos.push(seg);
  }

  const m = (b.maquina ?? {}) as Record<string, unknown>;
  const h = (b.herramienta ?? {}) as Record<string, unknown>;
  const r = (b.rpm ?? {}) as Record<string, unknown>;
  const numeros = [m.stockWidthMm, m.startOffsetMm, m.endOffsetMm, m.safeZClearanceMm, h.toolDiameterMm, r.rpmCilindrado, r.rpmDesbaste, r.rpmAcabado];
  if (!numeros.every(finito)) return { ok: false, error: "Faltan datos de la máquina, la fresa o las RPM." };

  const maquina: ParametrosMaquina = {
    stockWidthMm: num(m.stockWidthMm),
    startOffsetMm: num(m.startOffsetMm),
    endOffsetMm: num(m.endOffsetMm),
    safeZClearanceMm: num(m.safeZClearanceMm),
  };
  if (maquina.stockWidthMm <= 0 || maquina.stockWidthMm > LIMITES.maxStockMm)
    return { ok: false, error: `El ancho del bloque debe estar entre 1 y ${LIMITES.maxStockMm} mm.` };
  if (maquina.startOffsetMm < 0 || maquina.endOffsetMm < 0 || maquina.startOffsetMm > 500 || maquina.endOffsetMm > 500)
    return { ok: false, error: "Los márgenes de inicio y fin deben estar entre 0 y 500 mm." };
  if (maquina.safeZClearanceMm < 1 || maquina.safeZClearanceMm > 200)
    return { ok: false, error: "El retiro seguro en Z debe estar entre 1 y 200 mm." };

  const herramienta: ParametrosHerramienta = {
    toolDiameterMm: num(h.toolDiameterMm),
    feed: finito(h.feed) ? num(h.feed) : 0,
  };
  const [dMin, dMax] = LIMITES.herramientaMm;
  if (herramienta.toolDiameterMm < dMin || herramienta.toolDiameterMm > dMax)
    return { ok: false, error: `El diámetro de la fresa debe estar entre ${dMin} y ${dMax} mm.` };

  const rpm: ParametrosRpm = {
    rpmCilindrado: num(r.rpmCilindrado),
    rpmDesbaste: num(r.rpmDesbaste),
    rpmAcabado: num(r.rpmAcabado),
  };
  const [rMin, rMaxRpm] = LIMITES.rpmPieza;
  if ([rpm.rpmCilindrado, rpm.rpmDesbaste, rpm.rpmAcabado].some((v) => v < rMin || v > rMaxRpm))
    return { ok: false, error: `Las RPM de la pieza deben estar entre ${rMin} y ${rMaxRpm}.` };

  const material = typeof b.material === "string" && b.material in MATERIAL_PRESETS ? b.material : "generico";
  const origenPunto: OrigenPunto = b.origenPunto === "contrapunto" ? "contrapunto" : "mandril";
  const ejeLargo: EjeLargo = b.ejeLargo === "Y" ? "Y" : "X";
  const avance: ModoAvance = b.avance === "G93" ? "G93" : "G94";
  const numPasadasDesbaste = finito(b.numPasadasDesbaste)
    ? Math.min(LIMITES.maxPasadasDesbaste, Math.max(1, Math.round(num(b.numPasadasDesbaste))))
    : undefined;

  const largoPieza = Math.max(...segmentos.map((x) => x.finY));
  const t = (b.tallados ?? {}) as Record<string, any>;
  const tallados: Tallados = {};

  if (t.estrias?.activo) {
    const e = t.estrias;
    if (![e.cantidad, e.yDesde, e.yHasta, e.profundidad].every(finito))
      return { ok: false, error: "Faltan datos de las estrías." };
    const est: Estrias = {
      activo: true,
      cantidad: Math.round(num(e.cantidad)),
      yDesde: num(e.yDesde),
      yHasta: num(e.yHasta),
      profundidad: num(e.profundidad),
    };
    if (est.cantidad < 1 || est.cantidad > 60) return { ok: false, error: "Las estrías deben ser entre 1 y 60." };
    const err = revisarTramo("las estrías", est.yDesde, est.yHasta, est.profundidad, segmentos, largoPieza);
    if (err) return { ok: false, error: err };
    tallados.estrias = est;
  }

  if (t.espiral?.activo) {
    const e = t.espiral;
    if (![e.entradas, e.paso, e.yDesde, e.yHasta, e.profundidad].every(finito))
      return { ok: false, error: "Faltan datos de la espiral." };
    const esp: Espiral = {
      activo: true,
      entradas: Math.round(num(e.entradas)),
      paso: num(e.paso),
      yDesde: num(e.yDesde),
      yHasta: num(e.yHasta),
      profundidad: num(e.profundidad),
      sentido: e.sentido === "izquierda" ? "izquierda" : "derecha",
    };
    if (esp.entradas < 1 || esp.entradas > 8) return { ok: false, error: "La espiral puede tener de 1 a 8 hilos." };
    if (esp.paso < 5 || esp.paso > 2000) return { ok: false, error: "El paso de la espiral debe estar entre 5 y 2000 mm por vuelta." };
    const err = revisarTramo("la espiral", esp.yDesde, esp.yHasta, esp.profundidad, segmentos, largoPieza);
    if (err) return { ok: false, error: err };
    tallados.espiral = esp;
  }

  return {
    ok: true,
    entrada: { segmentos, material, maquina, herramienta, rpm, origenPunto, ejeLargo, avance, numPasadasDesbaste, tallados },
  };
}

/** Revisa el tramo y la profundidad de un tallado. Devuelve el error o null. */
function revisarTramo(
  que: string,
  yDesde: number,
  yHasta: number,
  profundidad: number,
  segmentos: Segmento[],
  largo: number
): string | null {
  if (yDesde < 0 || yHasta > largo) return `El tramo de ${que} debe quedar dentro de la pieza (0 a ${largo} mm).`;
  if (yHasta - yDesde < 5) return `El tramo de ${que} debe medir al menos 5 mm.`;
  if (profundidad < 0.2 || profundidad > 30) return `La profundidad de ${que} debe estar entre 0.2 y 30 mm.`;
  const rMin = radioMinEnRango(segmentos, yDesde, yHasta, 0.5);
  if (profundidad >= rMin - 1)
    return `Con ${profundidad} mm de profundidad, el tallado atravesaría la pieza en el tramo de ${que}: ahí el radio baja a ${rMin.toFixed(1)} mm.`;
  return null;
}

export function generarGCode(entrada: EntradaGCode): ResultadoGCode {
  const { segmentos, material, maquina, herramienta, rpm, origenPunto } = entrada;
  const L = entrada.ejeLargo === "Y" ? "Y" : "X"; // letra del eje que recorre el largo
  const g93 = entrada.avance === "G93";
  // F equivalente en G94: Mach3/Mach4 miden el bloque como hipot(mm, grados),
  // así que para que dure `tMin` minutos la F debe ser esa "distancia" / tMin.
  const fEquivalente = (dLargo: number, dRadio: number, dAng: number, tMin: number) =>
    Math.min(99999, Math.max(1, Math.round(Math.hypot(dLargo, dRadio, dAng) / Math.max(tMin, 1e-6))));

  const avisos: string[] = [];
  const preset = MATERIAL_PRESETS[material] ?? MATERIAL_PRESETS.generico;
  const largo = longitudTotal(segmentos);
  const rMax = radioMaximo(segmentos);
  const rMinPerfil = radioMinEnRango(segmentos, 0, largo);
  const rEsquina = (maquina.stockWidthMm * Math.SQRT2) / 2;
  const zSeguro = rEsquina + maquina.safeZClearanceMm;

  // ---- Validaciones: avisamos en lugar de generar código peligroso ----
  if (largo <= 0) throw new Error("La pieza tiene longitud 0.");
  if (herramienta.toolDiameterMm <= 0) throw new Error("El diámetro de la fresa debe ser mayor a 0.");
  if (rpm.rpmCilindrado <= 0 || rpm.rpmDesbaste <= 0 || rpm.rpmAcabado <= 0) {
    throw new Error("Las RPM de la pieza deben ser mayores a 0.");
  }
  if (rMax * 2 > maquina.stockWidthMm) {
    avisos.push(
      `El diámetro máximo de la pieza (${(rMax * 2).toFixed(1)}mm) es mayor que el ancho del bloque (${maquina.stockWidthMm}mm): el material no alcanza.`
    );
  }
  // Huecos entre segmentos: radioEn los rellena con el segmento más cercano,
  // pero casi siempre es un error de captura.
  const ordenados = [...segmentos].sort((a, b) => a.inicioY - b.inicioY);
  for (let i = 1; i < ordenados.length; i++) {
    const hueco = ordenados[i].inicioY - ordenados[i - 1].finY;
    if (Math.abs(hueco) > 0.01) {
      avisos.push(
        hueco > 0
          ? `Hay un hueco de ${hueco.toFixed(1)}mm entre ${ordenados[i - 1].finY}mm y ${ordenados[i].inicioY}mm.`
          : `Dos segmentos se enciman entre ${ordenados[i].inicioY}mm y ${ordenados[i - 1].finY}mm.`
      );
    }
  }

  // Si el origen es contrapunto, el perfil se recorre al revés.
  const radioEnOrigen = (y: number): number =>
    radioEn(origenPunto === "contrapunto" ? largo - y : y, segmentos);

  const lines: string[] = [];
  const paso = 2; // cada cuántos mm de Y se calcula un punto del perfil
  let aAcum = 0; // ángulo A acumulado dentro de la pasada
  let minutos = 0;

  /**
   * Una pasada en espiral. radioFn(y) da el radio de corte en cada Y.
   * lead = cuánto avanza Y por cada vuelta completa de la pieza (mm/vuelta).
   */
  function pasadaEspiral(
    titulo: string,
    rpmPieza: number,
    lead: number,
    radioFn: (y: number) => number,
    yIni: number,
    yFin: number
  ) {
    lines.push(`(--- ${titulo} ---)`);
    lines.push(`G0 Z${zSeguro.toFixed(3)}`);
    lines.push(`G0 ${L}${yIni.toFixed(3)}`);
    lines.push("G92 A0 (contador del eje A a cero, sin girar)");
    aAcum = 0;
    let zPrev = radioFn(Math.max(0, yIni));
    lines.push(`G1 Z${zPrev.toFixed(3)} F250 (hundir)`);
    if (g93) lines.push("G93 (avance en tiempo inverso)");

    let yPrev = yIni;
    const puntos: number[] = [];
    for (let y = yIni + paso; y < yFin; y += paso) puntos.push(y);
    puntos.push(yFin);

    for (const y of puntos) {
      const dy = y - yPrev;
      if (dy <= 0) continue;
      const dA = (dy / lead) * 360; // grados que gira la pieza en este tramo
      aAcum += dA;
      // tiempo del bloque (min) = vueltas / rpm  ->  F = 1 / tiempo
      const t = dA / 360 / rpmPieza;
      minutos += t;
      const z = radioFn(Math.min(Math.max(y, 0), largo));
      const f = g93 ? (1 / t).toFixed(4) : String(fEquivalente(dy, z - zPrev, dA, t));
      lines.push(`G1 ${L}${y.toFixed(3)} Z${z.toFixed(3)} A${aAcum.toFixed(2)} F${f}`);
      yPrev = y;
      zPrev = z;
    }
    if (g93) lines.push("G94");
    lines.push(`G0 Z${zSeguro.toFixed(3)} (retirar)`);
    lines.push("");
  }

  const yIni = -maquina.startOffsetMm;
  const yFin = largo + maquina.endOffsetMm;
  const profCorte = Math.max(0.5, herramienta.toolDiameterMm * 0.25); // profundidad por pasada

  // Desbaste: las pasadas que pidió el usuario, pero nunca menos de las que
  // hacen falta para no quitar más de `profCorte` por pasada en lo más hondo.
  const necesarias = Math.ceil((rMax - rMinPerfil) / profCorte);
  const pedidas = entrada.numPasadasDesbaste ?? 3;
  const numPasadasDesbaste = Math.min(LIMITES.maxPasadasDesbaste, Math.max(1, pedidas, necesarias));
  if (numPasadasDesbaste > pedidas) {
    avisos.push(
      `Se usaron ${numPasadasDesbaste - 1} pasadas de desbaste para no quitar más de ${profCorte.toFixed(1)}mm por pasada.`
    );
  }

  // Pasos en Y por vuelta (lead): más grueso al desbastar, fino al acabar.
  const leadDesbaste = herramienta.toolDiameterMm * 0.4;
  const leadAcabado = Math.max(0.5, herramienta.toolDiameterMm * 0.15);

  lines.push("(HETNA TURN STUDIO - Torneado de perfil)");
  lines.push(`(Pieza: ${largo.toFixed(1)}mm de largo | radio maximo ${rMax.toFixed(2)}mm | Material ${preset.nombre})`);
  lines.push(`(Origen: ${origenPunto} | Fresa ${herramienta.toolDiameterMm}mm)`);
  lines.push(`(*** A = rotativo | ${L} = longitud | Z = radio de corte ***)`);
  lines.push("(*** Z0 calibrado en el CENTRO del eje rotativo ***)");
  lines.push(
    g93
      ? "(*** Avance G93 tiempo inverso: para LinuxCNC. En Mach3 usa G94 ***)"
      : "(*** Avance G94 en mm/min, con los grados de A contados como mm: Mach3 / Mach4 ***)"
  );
  lines.push("(*** PRUEBA PRIMERO EN AIRE o con material de descarte ***)");
  lines.push("");
  lines.push("G92.1 (borra cualquier desfase G92 que haya quedado de otro programa)");
  lines.push("G21 G17 G90 G40 G49 G80 (mm, plano XY, absoluto, cancela comp. fresa/longitud/ciclos)");
  lines.push("G94");
  lines.push(`M3 S${preset.spindleRpm} (husillo encendido)`);
  lines.push("");

  // ETAPA 1: escuadrado, de la esquina del cuadrado hasta el radio máximo
  let zActual = rEsquina;
  let n = 1;
  while (zActual > rMax) {
    zActual = Math.max(rMax, zActual - profCorte);
    const zFijo = zActual;
    pasadaEspiral(`ETAPA 1: Escuadrado pasada ${n}`, rpm.rpmCilindrado, leadDesbaste, () => zFijo, yIni, yFin);
    n++;
    if (n > 200) {
      avisos.push("Escuadrado cortado a 200 pasadas: revisa el diámetro de fresa.");
      break;
    }
  }

  // ETAPA 2: desbaste con techo decreciente hacia el perfil
  for (let p = 1; p < numPasadasDesbaste; p++) {
    const factor = p / numPasadasDesbaste;
    pasadaEspiral(
      `ETAPA 2: Desbaste ${p}/${numPasadasDesbaste - 1}`,
      rpm.rpmDesbaste,
      leadDesbaste,
      (y) => {
        const rPerfil = radioEnOrigen(y);
        return rMax - (rMax - rPerfil) * factor;
      },
      yIni,
      yFin
    );
  }

  // ETAPA 3: acabado, sigue el perfil exacto
  pasadaEspiral("ETAPA 3: Acabado (perfil exacto)", rpm.rpmAcabado, leadAcabado, radioEnOrigen, yIni, yFin);

  // ETAPA 4 y 5: tallados (estrías y espiral), con la pieza ya en su perfil.
  // El ángulo de cada canal se toma desde donde quedó la pieza al terminar el
  // acabado; lo que importa es que los canales queden repartidos entre sí.
  const tallados = entrada.tallados ?? {};
  if (tallados.estrias?.activo || tallados.espiral?.activo) {
    const feedTallado = herramienta.feed > 0 ? herramienta.feed : preset.feed;
    // Coordenada de máquina a lo largo para una Y de la pieza (desde el contrapunto, al revés)
    const yMaq = (yPieza: number) => (origenPunto === "contrapunto" ? largo - yPieza : yPieza);
    let aActual = 0;
    const normalizarA = () => {
      // vuelve el contador a su equivalente entre 0 y 360 SIN girar la pieza,
      // para que el siguiente G0 A gire menos de una vuelta
      const equiv = ((aActual % 360) + 360) % 360;
      if (Math.abs(equiv - aActual) > 1e-6) lines.push(`G92 A${equiv.toFixed(3)}`);
      aActual = equiv;
    };
    const pasadasDe = (prof: number) => Math.max(1, Math.ceil(prof / profCorte));
    const anchoCanal = (prof: number) => {
      const r = herramienta.toolDiameterMm / 2;
      return prof >= r ? 2 * r : 2 * Math.sqrt(r * r - (r - prof) ** 2);
    };

    lines.push("(--- TALLADOS: la pieza ya tiene su perfil ---)");
    lines.push(`G0 Z${zSeguro.toFixed(3)}`);
    lines.push("G92 A0");
    lines.push("G94");

    const es = tallados.estrias;
    if (es?.activo) {
      const n = pasadasDe(es.profundidad);
      const rMinTramo = radioMinEnRango(segmentos, es.yDesde, es.yHasta, 0.5);
      if (es.cantidad * anchoCanal(es.profundidad) > 2 * Math.PI * (rMinTramo - es.profundidad)) {
        avisos.push("Las estrías se enciman en la parte más delgada: usa menos estrías, menos profundidad o una fresa más chica.");
      }
      lines.push(`(--- ETAPA 4: ${es.cantidad} estrias de ${es.profundidad}mm, de ${es.yDesde} a ${es.yHasta}mm ---)`);
      let ida = true;
      for (let p = 1; p <= n; p++) {
        const d = (es.profundidad * p) / n;
        for (let k = 0; k < es.cantidad; k++) {
          const ang = (360 * k) / es.cantidad;
          const ys: number[] = [];
          for (let y = es.yDesde; y < es.yHasta; y += paso) ys.push(y);
          ys.push(es.yHasta);
          if (!ida) ys.reverse();
          ida = !ida;
          lines.push(`(estria ${k + 1}/${es.cantidad}, pasada ${p}/${n})`);
          lines.push(`G0 Z${zSeguro.toFixed(3)}`);
          lines.push(`G0 A${ang.toFixed(3)}`);
          aActual = ang;
          lines.push(`G0 ${L}${yMaq(ys[0]).toFixed(3)}`);
          lines.push(`G1 Z${(radioEn(ys[0], segmentos) - d).toFixed(3)} F250`);
          let yPrev = ys[0];
          for (const y of ys.slice(1)) {
            lines.push(`G1 ${L}${yMaq(y).toFixed(3)} Z${(radioEn(y, segmentos) - d).toFixed(3)} F${feedTallado.toFixed(0)}`);
            minutos += Math.abs(y - yPrev) / feedTallado;
            yPrev = y;
          }
          lines.push(`G0 Z${zSeguro.toFixed(3)}`);
        }
        normalizarA();
      }
      lines.push("");
    }

    const sp = tallados.espiral;
    if (sp?.activo) {
      const n = pasadasDe(sp.profundidad);
      lines.push(
        `(--- ETAPA 5: espiral de ${sp.entradas} hilo(s), paso ${sp.paso}mm, ${sp.sentido}, de ${sp.yDesde} a ${sp.yHasta}mm ---)`
      );
      for (let p = 1; p <= n; p++) {
        const d = (sp.profundidad * p) / n;
        for (let k = 0; k < sp.entradas; k++) {
          const ys: number[] = [];
          for (let y = sp.yDesde; y < sp.yHasta; y += paso / 2) ys.push(y);
          ys.push(sp.yHasta);
          lines.push(`(hilo ${k + 1}/${sp.entradas}, pasada ${p}/${n})`);
          lines.push(`G0 Z${zSeguro.toFixed(3)}`);
          normalizarA();
          const a0 = ((anguloEspiral(sp, k, ys[0]) % 360) + 360) % 360;
          lines.push(`G0 A${a0.toFixed(3)}`);
          aActual = a0;
          lines.push(`G0 ${L}${yMaq(ys[0]).toFixed(3)}`);
          let rPrev = radioEn(ys[0], segmentos) - d;
          lines.push(`G1 Z${rPrev.toFixed(3)} F250`);
          if (g93) lines.push("G93 (avance en tiempo inverso)");
          let yPrev = ys[0];
          for (const y of ys.slice(1)) {
            const dA = anguloEspiral(sp, k, y) - anguloEspiral(sp, k, yPrev);
            const r = radioEn(y, segmentos) - d;
            const largoTramo = Math.hypot(y - yPrev, (Math.abs(dA) * Math.PI * Math.max(r, 1)) / 180);
            const tMin = Math.max(largoTramo / feedTallado, 1e-5);
            aActual += dA;
            minutos += tMin;
            const f = g93 ? (1 / tMin).toFixed(4) : String(fEquivalente(y - yPrev, r - rPrev, Math.abs(dA), tMin));
            lines.push(`G1 ${L}${yMaq(y).toFixed(3)} Z${r.toFixed(3)} A${aActual.toFixed(3)} F${f}`);
            yPrev = y;
            rPrev = r;
          }
          if (g93) lines.push("G94");
          lines.push(`G0 Z${zSeguro.toFixed(3)}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("G92.1 (quita el desfase de G92)");
  lines.push("M5 (husillo apagado)");
  lines.push("M30 (fin de programa)");

  if (lines.length > LIMITES.maxLineas) {
    throw new Error(
      `el programa saldría de ${lines.length.toLocaleString("es-MX")} líneas. Usa una fresa más grande o un bloque más cercano a la medida de la pieza.`
    );
  }

  return {
    gcode: lines.join("\n"),
    totalLineas: lines.length,
    longitudTotalMm: largo,
    radioMaximoMm: rMax,
    minutosEstimados: minutos,
    avisos,
  };
}
