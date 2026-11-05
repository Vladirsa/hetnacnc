// Bisagra viva (madera flexible): una pieza rectangular con una zona de
// cortes que la deja doblar. El largo de esa zona sale del radio y del
// ángulo que necesitas: L = ángulo × (radio interior + espesor / 2).
import { type P, type Trazo, dibujo, rect, trazo } from "@/lib/generador/geo2d"

export const PATRONES_BISAGRA = [
  { id: "recto", nombre: "Recto" },
  { id: "ondas", nombre: "Ondas" },
  { id: "rombos", nombre: "Rombos" },
] as const
export type PatronBisagra = (typeof PATRONES_BISAGRA)[number]["id"]

export type OpcionesBisagra = {
  patron: PatronBisagra
  ancho: number // largo total de la pieza (en la dirección que dobla)
  alto: number // ancho de la pieza (a lo largo de los cortes)
  espesor: number
  radio: number // radio interior del doblez
  angulo: number // grados
  paso: number // distancia entre líneas de corte
  ranura: number // largo de cada ranura
  puente: number // material entre ranuras de la misma línea
  esquinas: number
}

export function largoDoblez(o: Pick<OpcionesBisagra, "radio" | "espesor" | "angulo">) {
  return ((Math.max(0, o.angulo) * Math.PI) / 180) * (Math.max(0, o.radio) + o.espesor / 2)
}

export function hacerBisagra(o: OpcionesBisagra) {
  const avisos: string[] = []
  const W = Math.max(20, o.ancho)
  const H = Math.max(10, o.alto)
  const L = Math.min(W - 4, largoDoblez(o))
  const paso = Math.max(0.6, o.paso)
  const g = Math.max(1, o.puente)
  const l = Math.max(g * 2, Math.min(o.ranura, H))
  const trazos: Trazo[] = [rect(0, 0, W, H, o.esquinas)]
  const xa = (W - L) / 2
  const xb = xa + L
  const columnas = Math.max(1, Math.floor(L / paso) + 1)
  const dx = (L - (columnas - 1) * paso) / 2

  // Tramos a lo largo de una columna: ranuras de largo l separadas por g,
  // alternando el arranque para que los puentes queden escalonados.
  const tramos = (col: number): [number, number][] => {
    const periodo = l + g
    const inicio = col % 2 ? -periodo / 2 : 0
    const out: [number, number][] = []
    for (let y = inicio + g / 2; y < H; y += periodo) {
      const y0 = Math.max(y, g / 2)
      const y1 = Math.min(y + l, H - g / 2)
      if (y1 - y0 > g * 0.5) out.push([y0, y1])
    }
    return out
  }

  for (let c = 0; c < columnas; c++) {
    const x = xa + dx + c * paso
    for (const [y0, y1] of tramos(c)) {
      if (o.patron === "recto") trazos.push(trazo([[x, y0], [x, y1]], false))
      else if (o.patron === "ondas") {
        const pts: P[] = []
        const n = Math.max(6, Math.ceil((y1 - y0) / 1.2))
        const amp = paso * 0.28
        for (let k = 0; k <= n; k++) {
          const y = y0 + ((y1 - y0) * k) / n
          pts.push([x + amp * Math.sin((k / n) * Math.PI * 2), y])
        }
        trazos.push(trazo(pts, false))
      } else {
        const w = Math.max(0.3, paso * 0.35)
        const m = (y0 + y1) / 2
        trazos.push(trazo([[x, y0], [x + w / 2, m], [x, y1], [x - w / 2, m]], true))
      }
    }
  }
  // Guías del doblez (sólo en la vista)
  trazos.push(trazo([[xa, -3], [xa, H + 3]], false, "guia"), trazo([[xb, -3], [xb, H + 3]], false, "guia"))

  if (largoDoblez(o) > W - 4) avisos.push("La pieza es más corta que el doblez que pides: alárgala o baja el radio.")
  if (paso < o.espesor * 0.4) avisos.push("Líneas muy juntas para ese espesor: la madera se puede romper. Prueba un paso de al menos 40% del espesor.")
  if (paso > o.espesor * 1.2) avisos.push("Líneas muy separadas: doblará duro. En MDF de 3 mm funciona un paso de 1.2 a 2 mm.")
  avisos.push("La bisagra viva es para láser (cortes finos). Con fresa de router no sale.")
  return { dibujo: dibujo(trazos, avisos), avisos, largo: L, lineas: columnas }
}
