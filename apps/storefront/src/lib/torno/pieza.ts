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
