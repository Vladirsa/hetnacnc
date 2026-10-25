/**
 * HETNA TURN STUDIO — Núcleo de geometría de la pieza (Node/TypeScript)
 *
 * Laboratorio CAM > Torno 4 ejes (/cam/torno). Lo usan la pantalla (para el
 * perfil en vivo) y el generador de G-code (lib/torno/gcode.ts).
 *
 * Esto es el "cerebro" que describe la forma de la pieza (balaustre, pata,
 * columna, etc.) como una lista de segmentos, y sabe responder una sola
 * pregunta clave: "¿qué radio tiene la pieza en la posición Y?"
 *
 * Es el port directo de pieza_config.py + la función radioEn() que ya
 * vivía dentro de hetna-turn-studio-ui.jsx. Aquí queda en un solo lugar
 * para que tanto la página web (components/) como el generador de G-code
 * (lib/gcode.ts) usen exactamente la misma fuente de verdad.
 */

// ── Tipos de segmento ──────────────────────────────────────────────────
// cilindro: radio constante en todo el tramo
// cono:     el radio cambia en línea recta de un extremo al otro
// esfera:   un tramo redondo tipo "bola" (tipo perilla de balaustre)
// cova:     un tramo cóncavo (una "cintura" hacia adentro, tipo anillo)
export type TipoSegmento = "cilindro" | "cono" | "esfera" | "cova";

export interface Segmento {
  id: string;
  tipo: TipoSegmento;
  /** dónde empieza este segmento a lo largo de la pieza (mm) */
  inicioY: number;
  /** dónde termina este segmento a lo largo de la pieza (mm) */
  finY: number;
  /** radio al inicio del segmento (mm) — para cilindro es el único radio */
  radioInicio: number;
  /** radio al final del segmento (mm) — usado en cono; en esfera/cova es el radio máximo/mínimo del bulto */
  radioFin: number;
}

export interface PresetMaterial {
  nombre: string;
  /** rpm del husillo (la fresa), no de la pieza */
  spindleRpm: number;
  /** avance en mm/min para pasadas normales */
  feed: number;
}

export const MATERIAL_PRESETS: Record<string, PresetMaterial> = {
  pino: { nombre: "Pino", spindleRpm: 18000, feed: 2500 },
  dura: { nombre: "Madera dura", spindleRpm: 18000, feed: 1500 },
  mdf: { nombre: "MDF", spindleRpm: 16000, feed: 2000 },
  generico: { nombre: "Genérico", spindleRpm: 16000, feed: 1200 },
};

/**
 * Calcula el radio de la pieza en una posición Y dada (mm), recorriendo
 * la lista de segmentos. Si Y cae fuera de todos los segmentos, devuelve
 * el radio del extremo más cercano (no truena, no inventa datos raros).
 */
export function radioEn(y: number, segmentos: Segmento[]): number {
  if (segmentos.length === 0) return 0;

  // aseguramos que estén ordenados de inicio a fin de la pieza
  const ordenados = [...segmentos].sort((a, b) => a.inicioY - b.inicioY);

  if (y <= ordenados[0].inicioY) return ordenados[0].radioInicio;
  const ultimo = ordenados[ordenados.length - 1];
  if (y >= ultimo.finY) return ultimo.radioFin;

  for (const seg of ordenados) {
    if (y >= seg.inicioY && y <= seg.finY) {
      const largo = seg.finY - seg.inicioY;
      if (largo <= 0) return seg.radioInicio;
      const t = (y - seg.inicioY) / largo; // 0..1 dentro del segmento

      switch (seg.tipo) {
        case "cilindro":
          return seg.radioInicio;

        case "cono":
          // interpolación recta entre radioInicio y radioFin
          return seg.radioInicio + (seg.radioFin - seg.radioInicio) * t;

        case "esfera": {
          // perfil de media-circunferencia (bulto tipo perilla/bola):
          // sale de radioInicio, sube hasta radioFin (el radio máximo
          // del bulto) a la mitad, y vuelve a radioInicio al final.
          const rBase = Math.min(seg.radioInicio, seg.radioFin);
          const rMax = Math.max(seg.radioInicio, seg.radioFin);
          const anguloRel = (t - 0.5) * Math.PI; // -π/2 .. π/2
          const factor = Math.cos(anguloRel); // 0 en los extremos, 1 al centro
          return rBase + (rMax - rBase) * factor;
        }

        case "cova": {
          // como esfera pero invertida: se mete hacia adentro (cintura)
          const rBase = Math.max(seg.radioInicio, seg.radioFin);
          const rMin = Math.min(seg.radioInicio, seg.radioFin);
          const anguloRel = (t - 0.5) * Math.PI;
          const factor = Math.cos(anguloRel);
          return rBase - (rBase - rMin) * factor;
        }
      }
    }
  }
  return ordenados[ordenados.length - 1].radioFin;
}

/** Longitud total de la pieza (mm), tomada del último segmento. */
export function longitudTotal(segmentos: Segmento[]): number {
  if (segmentos.length === 0) return 0;
  return Math.max(...segmentos.map((s) => s.finY));
}

/** Radio máximo de toda la pieza (mm) — útil para saber el diámetro del stock necesario. */
export function radioMaximo(segmentos: Segmento[], resolucionMm = 1): number {
  const largo = longitudTotal(segmentos);
  let max = 0;
  for (let y = 0; y <= largo; y += resolucionMm) {
    max = Math.max(max, radioEn(y, segmentos));
  }
  return max;
}

/** Radio mínimo entre dos puntos Y — usado para validar si una estría/espiral cabe. */
export function radioMinEnRango(
  segmentos: Segmento[],
  yDesde: number,
  yHasta: number,
  resolucionMm = 1
): number {
  let min = Infinity;
  for (let y = yDesde; y <= yHasta; y += resolucionMm) {
    min = Math.min(min, radioEn(y, segmentos));
  }
  return min === Infinity ? 0 : min;
}

// ── Tallados (etapa 2): estrías y espiral ─────────────────────────────
// Se cortan DESPUÉS del acabado, con la misma fresa (se asume punta de bola:
// el canal sale redondo, del ancho de la fresa).

export interface Estrias {
  activo: boolean
  /** cuántos canales alrededor de la pieza */
  cantidad: number
  /** tramo de la pieza donde van (mm) */
  yDesde: number
  yHasta: number
  /** qué tan hondo entra la fresa (mm) */
  profundidad: number
}

export interface Espiral {
  activo: boolean
  /** cuántos hilos arrancan a la vez (1 = espiral sencilla, 2-4 = salomónica) */
  entradas: number
  /** cuánto avanza el hilo en una vuelta completa (mm) */
  paso: number
  yDesde: number
  yHasta: number
  profundidad: number
  sentido: "derecha" | "izquierda"
}

export interface Tallados {
  estrias?: Estrias
  espiral?: Espiral
}

export const ESTRIAS_INICIALES: Estrias = { activo: false, cantidad: 8, yDesde: 0, yHasta: 0, profundidad: 3 }
export const ESPIRAL_INICIAL: Espiral = {
  activo: false,
  entradas: 2,
  paso: 120,
  yDesde: 0,
  yHasta: 0,
  profundidad: 4,
  sentido: "derecha",
}

/** Ángulo (grados) del centro del canal k de la espiral a la altura y. */
export function anguloEspiral(e: Espiral, k: number, y: number): number {
  const signo = e.sentido === "izquierda" ? -1 : 1
  return (360 * k) / Math.max(1, e.entradas) + (signo * 360 * (y - e.yDesde)) / e.paso
}

/** Distancia angular más corta entre dos ángulos en grados (0..180). */
function difAngulo(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180)
  return d
}

/**
 * Cuánto se hunde un canal redondo (fresa de bola de diámetro `ancho`) en un
 * punto que está a `sLado` mm del centro del canal (medido sobre la
 * superficie) y a `sPunta` mm más allá de donde termina el canal.
 */
function hundimiento(profundidad: number, ancho: number, sLado: number, sPunta: number): number {
  const r = ancho / 2
  const s = Math.hypot(sLado, sPunta)
  if (s >= r) return 0
  // fondo de la bola a `profundidad`; a un lado, la bola sube (r - √(r²-s²))
  return Math.max(0, profundidad - (r - Math.sqrt(r * r - s * s)))
}

/**
 * Radio de la pieza YA TALLADA en (y, ángulo). Lo usa el visor 3D.
 * Sin tallados es igual a radioEn(y).
 */
export function radioTalladoEn(
  y: number,
  anguloGrados: number,
  segmentos: Segmento[],
  tallados: Tallados,
  anchoFresa: number
): number {
  const r = radioEn(y, segmentos)
  let hondo = 0
  const fuera = (desde: number, hasta: number) => (y < desde ? desde - y : y > hasta ? y - hasta : 0)

  const es = tallados.estrias
  if (es?.activo && es.cantidad > 0 && es.yHasta > es.yDesde) {
    const sPunta = fuera(es.yDesde, es.yHasta)
    if (sPunta < anchoFresa / 2) {
      const rCanal = Math.max(1, r - es.profundidad)
      for (let k = 0; k < es.cantidad; k++) {
        const d = difAngulo(anguloGrados, (360 * k) / es.cantidad)
        const sLado = (d * Math.PI * rCanal) / 180
        hondo = Math.max(hondo, hundimiento(es.profundidad, anchoFresa, sLado, sPunta))
      }
    }
  }

  const sp = tallados.espiral
  if (sp?.activo && sp.entradas > 0 && sp.paso > 0 && sp.yHasta > sp.yDesde) {
    const yC = Math.min(Math.max(y, sp.yDesde), sp.yHasta)
    const sPunta = fuera(sp.yDesde, sp.yHasta)
    if (sPunta < anchoFresa / 2) {
      const rCanal = Math.max(1, r - sp.profundidad)
      // el canal va inclinado: la distancia perpendicular es la angular por el
      // coseno del ángulo de la hélice
      const vueltaMm = 2 * Math.PI * rCanal
      const cosHelice = sp.paso / Math.hypot(sp.paso, vueltaMm)
      for (let k = 0; k < sp.entradas; k++) {
        const d = difAngulo(anguloGrados, anguloEspiral(sp, k, yC))
        const sLado = ((d * Math.PI * rCanal) / 180) * cosHelice
        hondo = Math.max(hondo, hundimiento(sp.profundidad, anchoFresa, sLado, sPunta))
      }
    }
  }

  return Math.max(0.5, r - hondo)
}
