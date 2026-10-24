/**
 * HETNA TURN STUDIO — Generador de G-code (Node/TypeScript)
 *
 * Laboratorio CAM > Torno 4 ejes (/cam/torno). Port del generador del
 * prototipo (torneado_perfil.py / hetna-turn-studio-ui.jsx). Corre en el
 * servidor de Next.js (POST /api/cam/torno): NO necesita Python.
 *
 * CONVENCIÓN DE EJES (la de tu router con 4to eje):
 *   A = eje rotativo (gira la pieza)
 *   Y = longitud a lo largo de la pieza
 *   Z = radio de corte (Z0 calibrado en el CENTRO del eje rotativo)
 *
 * Por qué G93 (avance en tiempo inverso): con radio variable, G94 en
 * movimientos Y+A+Z depende de cómo Mach3/4 interprete el avance del
 * eje rotativo. En G93, F = 1 / (minutos que debe durar ese bloque),
 * así que la velocidad de giro de la pieza es exactamente la que pides.
 *
 * CÓMO SE CORTA: cada pasada es una espiral. Mientras la fresa avanza
 * en Y, la pieza gira; por cada vuelta completa la fresa avanza un
 * "paso" (lead) en Y. El ángulo A se ACUMULA dentro de cada pasada
 * (0, 144, 288, 432...). Al empezar la siguiente pasada se pone G92 A0: el
 * contador vuelve a cero SIN mover la pieza. Así no desenrolla cientos de
 * vueltas en vacío (lo que haría un G0 A0) y los números no crecen sin fin.
 */

import { Segmento, TipoSegmento, radioEn, longitudTotal, radioMaximo, radioMinEnRango, MATERIAL_PRESETS } from "./pieza";

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

export interface EntradaGCode {
  segmentos: Segmento[];
  material: string;
  maquina: ParametrosMaquina;
  herramienta: ParametrosHerramienta;
  rpm: ParametrosRpm;
  origenPunto: OrigenPunto;
  numPasadasDesbaste?: number;
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
  const numPasadasDesbaste = finito(b.numPasadasDesbaste)
    ? Math.min(LIMITES.maxPasadasDesbaste, Math.max(1, Math.round(num(b.numPasadasDesbaste))))
    : undefined;

  return { ok: true, entrada: { segmentos, material, maquina, herramienta, rpm, origenPunto, numPasadasDesbaste } };
}

export function generarGCode(entrada: EntradaGCode): ResultadoGCode {
  const { segmentos, material, maquina, herramienta, rpm, origenPunto } = entrada;

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
    lines.push(`G0 Y${yIni.toFixed(3)}`);
    lines.push("G92 A0 (contador del eje A a cero, sin girar)");
    aAcum = 0;
    lines.push(`G1 Z${radioFn(Math.max(0, yIni)).toFixed(3)} F250 (hundir)`);
    lines.push("G93 (avance en tiempo inverso)");

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
      const f = 1 / t;
      const z = radioFn(Math.min(Math.max(y, 0), largo));
      lines.push(`G1 Y${y.toFixed(3)} Z${z.toFixed(3)} A${aAcum.toFixed(2)} F${f.toFixed(4)}`);
      yPrev = y;
    }
    lines.push("G94");
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
  lines.push("(*** A = rotativo | Y = longitud | Z = radio de corte ***)");
  lines.push("(*** Z0 calibrado en el CENTRO del eje rotativo ***)");
  lines.push("(*** PRUEBA PRIMERO EN AIRE o con material de descarte ***)");
  lines.push("");
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
