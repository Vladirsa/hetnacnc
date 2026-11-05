// Celosías y paneles decorativos: un panel con marco y un patrón calado.
// El "puente" es lo que queda de material entre dos huecos (lo que sostiene
// el panel): cada patrón calcula su hueco para que el puente mida eso.
import { type P, type Trazo, circulo, dibujo, poligonoRegular, rect, trazo } from "@/lib/generador/geo2d"

export const PATRONES = [
  { id: "rombos", nombre: "Rombos" },
  { id: "circulos", nombre: "Círculos" },
  { id: "panal", nombre: "Panal" },
  { id: "cuadros", nombre: "Cuadros" },
  { id: "estrella", nombre: "Estrella árabe" },
  { id: "cruces", nombre: "Cruces" },
  { id: "hojas", nombre: "Hojas" },
  { id: "ondas", nombre: "Ondas" },
  { id: "triangulos", nombre: "Triángulos" },
  { id: "ladrillos", nombre: "Ladrillos" },
] as const
export type Patron = (typeof PATRONES)[number]["id"]

export type OpcionesCelosia = {
  patron: Patron
  ancho: number
  alto: number
  marco: number // mm de borde sin calar
  celda: number // tamaño del módulo del patrón
  puente: number // material entre huecos
  radio: number // esquinas del panel
  barrenos: boolean // 4 barrenos de fijación en las esquinas
  diametroBarreno: number
}

const MAX_HUECOS = 6000

const rombo = (cx: number, cy: number, h: number): P[] => [[cx + h, cy], [cx, cy + h], [cx - h, cy], [cx, cy - h]]

function estrella(cx: number, cy: number, ro: number, ri: number, puntas = 8): P[] {
  const pts: P[] = []
  for (let i = 0; i < puntas * 2; i++) {
    const r = i % 2 ? ri : ro
    const a = (i / (puntas * 2)) * Math.PI * 2 + Math.PI / puntas / 2
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

function cruz(cx: number, cy: number, l: number, g: number): P[] {
  return [
    [cx - g, cy - l], [cx + g, cy - l], [cx + g, cy - g], [cx + l, cy - g], [cx + l, cy + g], [cx + g, cy + g],
    [cx + g, cy + l], [cx - g, cy + l], [cx - g, cy + g], [cx - l, cy + g], [cx - l, cy - g], [cx - g, cy - g],
  ]
}

// Hoja (lente): dos arcos que se juntan en las puntas
function hoja(cx: number, cy: number, largo: number, ancho: number, giro: number): P[] {
  const a = largo / 2
  const b = ancho / 2
  const r = (a * a + b * b) / (2 * b)
  const t = Math.asin(Math.min(1, a / r))
  const n = 18
  const pts: P[] = []
  for (let i = 0; i <= n; i++) {
    const u = -t + (2 * t * i) / n
    pts.push([r * Math.sin(u), r * Math.cos(u) - (r - b)])
  }
  for (let i = 1; i < n; i++) {
    const u = t - (2 * t * i) / n
    pts.push([r * Math.sin(u), -(r * Math.cos(u) - (r - b))])
  }
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c])
}

export function hacerCelosia(o: OpcionesCelosia) {
  const avisos: string[] = []
  const W = Math.max(20, o.ancho)
  const H = Math.max(20, o.alto)
  const m = Math.max(0, Math.min(o.marco, W / 2 - 5, H / 2 - 5))
  const s = Math.max(4, o.celda)
  const p = Math.max(0.5, Math.min(o.puente, s * 0.6))
  const trazos: Trazo[] = [rect(0, 0, W, H, o.radio)]
  const ix0 = m
  const iy0 = m
  const ix1 = W - m
  const iy1 = H - m
  const cabe = (pts: P[]) => pts.every(([x, y]) => x >= ix0 - 1e-6 && x <= ix1 + 1e-6 && y >= iy0 - 1e-6 && y <= iy1 + 1e-6)
  let huecos = 0
  const poner = (pts: P[]) => {
    if (huecos >= MAX_HUECOS || !cabe(pts)) return
    trazos.push(trazo(pts, true, "corte"))
    huecos++
  }
  // Rejilla centrada en el área calada
  const rejilla = (dx: number, dy: number, alterna: number, cb: (cx: number, cy: number, fila: number, col: number) => void) => {
    const nx = Math.floor((ix1 - ix0) / dx) + 2
    const ny = Math.floor((iy1 - iy0) / dy) + 2
    const ox = (ix0 + ix1) / 2 - ((nx - 1) * dx) / 2
    const oy = (iy0 + iy1) / 2 - ((ny - 1) * dy) / 2
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cb(ox + i * dx + (j % 2 ? alterna : 0), oy + j * dy, j, i)
  }

  switch (o.patron) {
    case "rombos": {
      const h = (s - p * Math.SQRT2) / 2
      rejilla(s, s / 2, s / 2, (x, y) => poner(rombo(x, y, h)))
      break
    }
    case "circulos": {
      const r = (s - p) / 2
      rejilla(s, s, 0, (x, y) => {
        const c = circulo(x, y, r)
        poner(c.pts)
      })
      break
    }
    case "panal": {
      const Rc = s / Math.sqrt(3)
      const R = Rc - p / Math.sqrt(3)
      const dx = 1.5 * Rc
      const dy = Math.sqrt(3) * Rc
      const nx = Math.floor((ix1 - ix0) / dx) + 2
      const ny = Math.floor((iy1 - iy0) / dy) + 2
      const ox = (ix0 + ix1) / 2 - ((nx - 1) * dx) / 2
      const oy = (iy0 + iy1) / 2 - ((ny - 1) * dy) / 2
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) poner(poligonoRegular(ox + i * dx, oy + j * dy + (i % 2 ? dy / 2 : 0), R, 6))
      break
    }
    case "cuadros": {
      const l = (s - p) / 2
      rejilla(s, s, 0, (x, y) => poner([[x - l, y - l], [x + l, y - l], [x + l, y + l], [x - l, y + l]]))
      break
    }
    case "estrella": {
      const ro = (s - p) / 2
      rejilla(s, s, 0, (x, y) => poner(estrella(x, y, ro, ro * 0.62)))
      break
    }
    case "cruces": {
      // Cruces encajadas: rejilla girada para que llenen el plano
      const l = (s - p) / 2
      const g = Math.max(0.6, l / 3 - p / 4)
      rejilla(s, s, s / 2, (x, y) => poner(cruz(x, y, l, g)))
      break
    }
    case "hojas": {
      const largo = s - p
      rejilla(s, s / 2, s / 2, (x, y, fila) => poner(hoja(x, y, largo, largo * 0.42, fila % 2 ? Math.PI / 4 : -Math.PI / 4)))
      break
    }
    case "ondas": {
      // Ranuras onduladas que cruzan el panel de lado a lado
      const grueso = s - p
      const amp = s * 0.35
      const per = s * 2.2
      const x0 = ix0 + amp * 0 + p
      const x1 = ix1 - p
      const ny = Math.floor((iy1 - iy0 - 2 * amp - grueso) / s) + 1
      const oy = (iy0 + iy1) / 2 - ((ny - 1) * s) / 2
      for (let j = 0; j < ny; j++) {
        const cy = oy + j * s
        const arriba: P[] = []
        const abajo: P[] = []
        const n = Math.max(8, Math.ceil((x1 - x0) / 1.5))
        for (let k = 0; k <= n; k++) {
          const x = x0 + ((x1 - x0) * k) / n
          const y = cy + amp * Math.sin(((x - x0) / per) * Math.PI * 2)
          arriba.push([x, y + grueso / 2])
          abajo.push([x, y - grueso / 2])
        }
        poner([...abajo, ...arriba.reverse()])
      }
      break
    }
    case "triangulos": {
      const L = s
      const altoT = (L * Math.sqrt(3)) / 2
      const rin = L / (2 * Math.sqrt(3)) - p / 2
      const rv = 2 * rin
      if (rin <= 0.3) break
      const nx = Math.floor((ix1 - ix0) / (L / 2)) + 2
      const ny = Math.floor((iy1 - iy0) / altoT) + 2
      const ox = (ix0 + ix1) / 2 - ((nx - 1) * L) / 4
      const oy = (iy0 + iy1) / 2 - ((ny - 1) * altoT) / 2
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const arribaT = (i + j) % 2 === 0
          const cx = ox + (i * L) / 2
          const cy = oy + j * altoT + (arribaT ? -altoT / 6 : altoT / 6)
          poner(poligonoRegular(cx, cy, rv, 3, arribaT ? Math.PI / 2 : -Math.PI / 2))
        }
      break
    }
    case "ladrillos": {
      const w = s * 2 - p
      const h = s * 0.6 - p
      if (h <= 0.5) break
      rejilla(s * 2, s * 0.6, s, (x, y) => poner([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]]))
      break
    }
  }

  if (o.barrenos && m >= o.diametroBarreno + 2) {
    const d = m / 2
    for (const [x, y] of [[d, d], [W - d, d], [W - d, H - d], [d, H - d]] as P[]) trazos.push(circulo(x, y, o.diametroBarreno / 2))
  } else if (o.barrenos) avisos.push("El marco es muy angosto para los barrenos: hazlo más ancho que el barreno más 2 mm.")

  if (huecos >= MAX_HUECOS) avisos.push(`Hay muchísimos huecos: se cortó en ${MAX_HUECOS}. Usa una celda más grande.`)
  if (huecos === 0) avisos.push("No cabe ningún hueco: haz la celda más chica o el marco más angosto.")
  if (p < 2) avisos.push("Puentes de menos de 2 mm se rompen fácil en MDF; en acrílico o metal sí aguantan.")
  return { dibujo: dibujo(trazos, avisos), huecos, avisos }
}
