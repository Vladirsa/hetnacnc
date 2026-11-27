// Reloj de palabras (2D Studio · Decoración): una cuadrícula de letras en la que
// se iluminan las palabras de la hora ("SON LAS TRES Y CUARTO"), cada 5 minutos.
// Cuadrícula propia de HETNA (12 × 10) con todas las palabras en español.
// Salen tres capas para láser: el frente con las letras caladas (letra
// esténcil para que no se caigan los centros), la rejilla que separa la luz de
// cada letra y el fondo para los LEDs; más la lista de qué letras prender.
import { rectPts as rect } from "@/lib/generador/contornos"
import type { Dibujo, P, Trazo } from "@/lib/generador/vectores"

/** La cuadrícula: cada renglón de 12 letras. Las mayúsculas sueltas son relleno. */
export const CUADRICULA = [
  "ESHLAXSONLAS",
  "UNADOSTRESZE",
  "CUATROCINCOH",
  "SEISIETEOCHO",
  "NUEVEDIEZRTM",
  "ONCEDOCEKYAB",
  "MENOSVEINTEJ",
  "VEINTICINCOP",
  "DIEZCINCOBTQ",
  "CUARTOMEDIAX",
]
export const COLUMNAS = 12

type Palabra = { renglon: number; desde: number; largo: number }
const P_ = (renglon: number, desde: number, largo: number): Palabra => ({ renglon, desde, largo })
export const PALABRAS: Record<string, Palabra> = {
  ES: P_(0, 0, 2), LA: P_(0, 3, 2), SON: P_(0, 6, 3), LAS: P_(0, 9, 3),
  UNA: P_(1, 0, 3), DOS: P_(1, 3, 3), TRES: P_(1, 6, 4),
  CUATRO: P_(2, 0, 6), CINCO: P_(2, 6, 5),
  SEIS: P_(3, 0, 4), SIETE: P_(3, 3, 5), OCHO: P_(3, 8, 4),
  NUEVE: P_(4, 0, 5), DIEZ: P_(4, 5, 4),
  ONCE: P_(5, 0, 4), DOCE: P_(5, 4, 4), Y: P_(5, 9, 1),
  MENOS: P_(6, 0, 5), "VEINTE+": P_(6, 5, 6),
  "VEINTICINCO+": P_(7, 0, 11),
  "DIEZ+": P_(8, 0, 4), "CINCO+": P_(8, 4, 5),
  "CUARTO+": P_(9, 0, 6), "MEDIA+": P_(9, 6, 5),
}
const HORAS = ["DOCE", "UNA", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE"]

/** Las palabras que se prenden a una hora (minutos redondeados hacia abajo a 5). */
export function palabrasDeLaHora(h: number, m: number): string[] {
  const cinco = Math.floor((((m % 60) + 60) % 60) / 5) * 5
  let hora = ((h % 12) + 12) % 12
  const minutos: Record<number, string[]> = { 5: ["CINCO+"], 10: ["DIEZ+"], 15: ["CUARTO+"], 20: ["VEINTE+"], 25: ["VEINTICINCO+"], 30: ["MEDIA+"] }
  let extra: string[] = []
  if (cinco > 30) {
    hora = (hora + 1) % 12
    extra = ["MENOS", ...minutos[60 - cinco]]
  } else if (cinco > 0) extra = ["Y", ...minutos[cinco]]
  const nombre = HORAS[hora]
  return [...(nombre === "UNA" ? ["ES", "LA"] : ["SON", "LAS"]), nombre, ...extra]
}

/** Las letras (renglón, columna) que se prenden: para programar los LEDs. */
export const celdasDe = (palabras: string[]) => palabras.flatMap((p) => Array.from({ length: PALABRAS[p].largo }, (_, i) => [PALABRAS[p].renglon, PALABRAS[p].desde + i] as [number, number]))

export type OpcionesReloj = { lado: number; margen: number; letra: number } // letra: % de la celda
export type ResultadoReloj = { dibujo: Dibujo; ancho: number; alto: number; avisos: string[]; tabla: string[] }


/** `letra(c, alto)`: la letra c en trazos centrados en (0, 0) (la pantalla la da con la tipografía esténcil). */
export function hacerRelojPalabras(o: OpcionesReloj, letra: ((c: string, alto: number) => Trazo[]) | null): ResultadoReloj {
  const L = Math.max(150, Math.min(1000, o.lado || 300)), M = Math.max(10, Math.min(L / 4, o.margen || 30))
  const filas = CUADRICULA.length
  const celda = Math.min((L - 2 * M) / COLUMNAS, (L - 2 * M) / filas)
  const x0 = (L - celda * COLUMNAS) / 2, y0 = (L - celda * filas) / 2
  const alto = celda * Math.max(0.3, Math.min(0.85, (o.letra || 60) / 100))
  const avisos: string[] = []
  if (!letra) avisos.push("Cargando la letra…")
  // 1) frente: el cuadro y cada letra calada
  const frente: Trazo[] = [{ pts: rect(0, 0, L, L), cerrado: true, capa: "corte" }]
  CUADRICULA.forEach((renglon, r) =>
    [...renglon].forEach((c, k) => {
      const cx = x0 + (k + 0.5) * celda, cy = y0 + (filas - r - 0.5) * celda
      for (const t of letra ? letra(c, alto) : []) frente.push({ ...t, capa: "corte", pts: t.pts.map(([x, y]) => [x + cx, y + cy] as P) })
    }),
  )
  // 2) rejilla: el cuadro con un hueco por letra (paredes de 2 mm entre celdas)
  const pared = Math.min(3, celda * 0.12)
  const rejilla: Trazo[] = [{ pts: rect(0, 0, L, L), cerrado: true, capa: "corte" }]
  for (let r = 0; r < filas; r++)
    for (let k = 0; k < COLUMNAS; k++) {
      const a = x0 + k * celda + pared / 2, b = y0 + r * celda + pared / 2
      rejilla.push({ pts: rect(a, b, a + celda - pared, b + celda - pared), cerrado: true, capa: "corte" })
    }
  // 3) fondo: el cuadro con barreno para colgar y salida de cable
  const fondo: Trazo[] = [
    { pts: rect(0, 0, L, L), cerrado: true, capa: "corte" },
    { pts: Array.from({ length: 32 }, (_, i) => [L / 2 + 4 * Math.cos((i / 32) * 2 * Math.PI), L - M / 2 + 4 * Math.sin((i / 32) * 2 * Math.PI)] as P), cerrado: true, capa: "corte" },
    { pts: rect(L / 2 - 6, M / 3, L / 2 + 6, M / 3 + 8), cerrado: true, capa: "corte" },
  ]
  const sep = 15
  const mover = (t: Trazo[], dx: number) => t.map((x) => ({ ...x, pts: x.pts.map(([a, b]) => [a + dx, b] as P) }))
  const trazos = [...frente, ...mover(rejilla, L + sep), ...mover(fondo, 2 * (L + sep))]
  // tabla para programar: palabra → LEDs (numerados renglón por renglón desde arriba a la izquierda)
  const tabla = ["Palabra,LEDs (renglón×12 + columna, desde 0)"]
  for (const [p, d] of Object.entries(PALABRAS)) tabla.push(`${p.replace("+", " (minutos)")},${Array.from({ length: d.largo }, (_, i) => d.renglon * COLUMNAS + d.desde + i).join(" ")}`)
  return { dibujo: { trazos, avisos: [], unidades: "mm" }, ancho: 3 * L + 2 * sep, alto: L, avisos, tabla }
}
