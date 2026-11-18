// Esferas navideñas con nombre para corte láser, plotter o impresión 3D.
//
// La esfera es una sola pieza: aro exterior, tapa y argolla, una banda al
// centro con el nombre y dos zonas (arriba y abajo) con figuras caladas. El
// nombre va dentro de una "ventana" entre dos rieles: cada letra toca los dos
// rieles, así ninguna letra queda suelta. Lo que no toca un riel recibe un
// soporte hacia el riel de abajo (puntos de la i, acentos de cursiva, signos).
//
// Todo se dibuja en una rejilla fina (como Letreros) y se vectoriza con el mismo
// trazador: así las letras se unen a los rieles sin líneas cruzadas. Las
// figuras de cada diseño son huecos dentro de zonas sólidas, con una pared
// mínima hacia el aro y los rieles: la pieza siempre queda unida.
//
// Coordenadas internas en mm con Y hacia abajo (como las letras de opentype),
// centro de la bola en (0, 0). El dibujo que se entrega va con Y hacia arriba.

import { type P, type Trazo, curvasATrazos } from "./geo2d"
import { type Fuente, rellenar } from "./letreros"
import { type Curva, contornos, curvasDeMascara } from "./trazado"

export type DisenoEsfera = "copos" | "estrellas" | "pinos" | "lunares" | "rayas" | "corazones" | "regalos" | "ventana"

export const DISENOS_ESFERA: { id: DisenoEsfera; nombre: string }[] = [
  { id: "copos", nombre: "Copos" },
  { id: "estrellas", nombre: "Estrellas" },
  { id: "pinos", nombre: "Pinos" },
  { id: "regalos", nombre: "Regalos" },
  { id: "corazones", nombre: "Corazones" },
  { id: "lunares", nombre: "Lunares" },
  { id: "rayas", nombre: "Rayas" },
  { id: "ventana", nombre: "Ventana" },
]

export type OpcionesEsfera = {
  diseno: DisenoEsfera
  diametro: number // mm, ancho de la bola
  cursiva: boolean // letras unidas: se escala la palabra completa en vez de cada letra
}

// ---------- medidas de la esfera (proporcionales al diámetro) ----------
export function medidasEsfera(D: number) {
  const R = D / 2
  const b = Math.max(2.5, 0.055 * D) // aro
  const t = Math.max(1.6, 0.03 * D) // rieles de la banda
  const hb = 0.26 * D // alto de la ventana del nombre
  const w = Math.max(1.5, 0.025 * D) // pared mínima entre huecos y aro o rieles
  const Ri = R - b
  const capW = 0.3 * D
  const capY0 = -R - 0.075 * D // arriba de la tapa
  const capY1 = -R + 0.04 * D
  const ringR = Math.max(0.075 * D, 5)
  const ringr = Math.max(0.04 * D, 2.6)
  const ringY = capY0 - ringR + Math.min(2, ringR - ringr) * 0.9
  return { R, b, t, hb, w, Ri, capW, capY0, capY1, ringR, ringr, ringY, alto: R - (ringY - ringR), ancho: D }
}

// ---------- rejillas ----------
type Rejilla = { m: Uint8Array; w: number; h: number; x0: number; y0: number; pxmm: number }
const rejilla = (x0: number, y0: number, x1: number, y1: number, pxmm: number): Rejilla => {
  const w = Math.ceil((x1 - x0) * pxmm) + 2
  const h = Math.ceil((y1 - y0) * pxmm) + 2
  return { m: new Uint8Array(w * h), w, h, x0: x0 - 1 / pxmm, y0: y0 - 1 / pxmm, pxmm }
}
const llenar = (g: Rejilla, curvas: Curva[]) => {
  const m = new Uint8Array(g.w * g.h)
  rellenar(curvas, { ...g, m })
  return m
}
// píxel (i, j) → mm (centro del píxel)
const pxX = (g: Rejilla, i: number) => g.x0 + (i + 0.5) / g.pxmm
const pxY = (g: Rejilla, j: number) => g.y0 + (j + 0.5) / g.pxmm

// ---------- figuras como curvas ----------
const poli = (pts: P[]): Curva => ({ inicio: pts[0], tramos: [...pts.slice(1), pts[0]].map((p) => ({ p })), hueco: false })
const anti = (pts: P[]) => {
  // todas las figuras con el mismo sentido: así el relleno (regla distinto de cero) las une
  let s = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1])
  return s < 0 ? [...pts].reverse() : pts
}
const fig = (pts: P[]) => poli(anti(pts))
const circ = (cx: number, cy: number, r: number, n = 0): P[] => {
  const k = n || Math.max(24, Math.min(160, Math.round(r * 6)))
  return Array.from({ length: k }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / k), cy + r * Math.sin((2 * Math.PI * i) / k)] as P)
}
const rectP = (x0: number, y0: number, x1: number, y1: number): P[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const girarP = (pts: P[], a: number, cx: number, cy: number): P[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)])
const estrellaP = (cx: number, cy: number, r: number, puntas = 5, ri = 0.45): P[] =>
  Array.from({ length: puntas * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / puntas
    const rr = i % 2 ? r * ri : r
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as P
  })
const corazonP = (cx: number, cy: number, s: number): P[] =>
  Array.from({ length: 64 }, (_, i) => {
    const t = (2 * Math.PI * i) / 64
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return [cx + (x / 34) * s, cy - (y / 34) * s] as P
  })
// copo de nieve: seis brazos con dos ramitas cada uno (una sola figura, por unión)
function copo(cx: number, cy: number, r: number): Curva[] {
  const a = Math.max(r * 0.16, 0.9) // grosor del brazo (hueco)
  const out: Curva[] = [fig(circ(cx, cy, r * 0.22, 24))]
  for (let k = 0; k < 6; k++) {
    const ang = (Math.PI / 3) * k
    out.push(fig(girarP(rectP(cx - a / 2, cy - r, cx + a / 2, cy), ang, cx, cy)))
    for (const [d, l] of [[0.55, 0.34], [0.8, 0.22]] as const) {
      for (const s of [-1, 1]) {
        const bx = cx
        const by = cy - r * d
        const rama = girarP(rectP(bx - a / 2, by - r * l, bx + a / 2, by), (s * Math.PI) / 4, bx, by)
        out.push(fig(girarP(rama, ang, cx, cy)))
      }
    }
  }
  return out
}
function pino(cx: number, yb: number, h: number): Curva[] {
  const w = h * 0.62
  const tronco = Math.max(h * 0.13, 1)
  const out: Curva[] = [fig(rectP(cx - tronco / 2, yb - h * 0.16, cx + tronco / 2, yb))]
  for (const [y0, y1, k] of [[0.12, 0.5, 0.62], [0.36, 0.78, 0.84], [0.62, 1, 1]] as const) {
    out.push(fig([[cx, yb - h + h * y0 - h * 0.12], [cx + (w / 2) * k, yb - h + h * y1], [cx - (w / 2) * k, yb - h + h * y1]]))
  }
  return out
}
// regalo: cuatro huecos (el listón queda sólido) y un moño de dos óvalos
function regalo(cx: number, cy: number, s: number): Curva[] {
  const l = Math.max(s * 0.14, 1.2) // listón
  const x0 = cx - s / 2, x1 = cx + s / 2, y0 = cy - s * 0.4, y1 = cy + s / 2
  const out: Curva[] = [
    fig(rectP(x0, y0, cx - l / 2, cy - l / 2 + s * 0.05)),
    fig(rectP(cx + l / 2, y0, x1, cy - l / 2 + s * 0.05)),
    fig(rectP(x0, cy + l / 2 + s * 0.05, cx - l / 2, y1)),
    fig(rectP(cx + l / 2, cy + l / 2 + s * 0.05, x1, y1)),
  ]
  for (const sg of [-1, 1]) {
    const pts = circ(0, 0, 1, 32).map(([x, y]) => [cx + sg * s * 0.17 + x * s * 0.15, y0 - s * 0.14 + y * s * 0.09] as P)
    out.push(fig(girarP(pts, sg * 0.35, cx + sg * s * 0.17, y0 - s * 0.14)))
  }
  return out
}

// ---------- marco (todo menos el nombre): depende sólo del diseño y el tamaño ----------
export type MarcoEsfera = { contornos: Curva[]; piezas: number; medidas: ReturnType<typeof medidasEsfera> }

export function marcoEsfera(diseno: DisenoEsfera, D: number, pxmm: number): MarcoEsfera {
  const M = medidasEsfera(D)
  const { R, t, hb, w, Ri, capW, capY0, capY1, ringR, ringr, ringY } = M
  const g = rejilla(-R, ringY - ringR, R, R, pxmm)
  // silueta: bola + tapa + argolla
  const tapaR = Math.min(capW * 0.12, 3)
  const tapa: P[] = [[-capW / 2, capY1], [-capW / 2, capY0 + tapaR], [-capW / 2 + tapaR, capY0], [capW / 2 - tapaR, capY0], [capW / 2, capY0 + tapaR], [capW / 2, capY1]]
  const solido = llenar(g, [fig(circ(0, 0, R)), fig(tapa), fig(circ(0, ringY, ringR))])
  const hueco = llenar(g, [fig(circ(0, ringY, ringr))])
  // ranuras decorativas de la tapa
  const ranuras: Curva[] = []
  const rw = Math.max(1, capW * 0.06)
  const rh = (capY1 - capY0) * 0.42
  for (const x of [-0.25, 0, 0.25]) ranuras.push(fig(rectP(x * capW - rw / 2, capY0 + (capY1 - capY0) * 0.25, x * capW + rw / 2, capY0 + (capY1 - capY0) * 0.25 + rh)))
  const huecoTapa = llenar(g, ranuras)

  // zonas para las figuras (con pared mínima al aro y a los rieles)
  const yArriba = -hb / 2 - t - w // las figuras de arriba quedan con y < yArriba
  const yAbajo = hb / 2 + t + w
  const disco = llenar(g, [fig(circ(0, 0, Ri - w))])
  const zona = new Uint8Array(g.w * g.h)
  for (let j = 0; j < g.h; j++) {
    const y = pxY(g, j)
    if (y < yArriba || y > yAbajo) for (let i = 0; i < g.w; i++) zona[j * g.w + i] = disco[j * g.w + i]
  }
  // figura discreta: sólo si cabe completa en su zona
  const cabe = (pts: P[]) =>
    pts.every(([x, y]) => Math.hypot(x, y) <= Ri - w - 0.2 && (y <= yArriba - 0.2 || y >= yAbajo + 0.2)) &&
    (pts.every(([, y]) => y < 0) || pts.every(([, y]) => y > 0))
  const figuras: Curva[] = []
  const agregar = (curvas: Curva[]) => {
    const todas = curvas.flatMap((c) => [c.inicio, ...c.tramos.map((q) => q.p)])
    if (cabe(todas)) figuras.push(...curvas)
  }
  // altura de cada zona y su centro
  const yTop = -(Ri - w)
  const hz = Math.max(0, Ri - w + yArriba) // alto útil de cada zona
  const cz = (yArriba + yTop) / 2 // centro de la zona de arriba (abajo es -cz)
  const u = D // las figuras se dan en fracciones del diámetro
  let abiertas = false
  switch (diseno) {
    case "ventana":
      abiertas = true
      break
    case "copos":
      agregar(copo(0, cz - hz * 0.02, Math.min(hz * 0.42, u * 0.085)))
      for (const s of [-1, 1]) agregar(copo(s * u * 0.2, cz + hz * 0.12, Math.min(hz * 0.32, u * 0.06)))
      agregar(copo(0, -cz + hz * 0.02, Math.min(hz * 0.42, u * 0.085)))
      for (const s of [-1, 1]) agregar(copo(s * u * 0.2, -cz - hz * 0.12, Math.min(hz * 0.32, u * 0.06)))
      break
    case "estrellas":
      agregar([fig(estrellaP(0, cz, Math.min(hz * 0.46, u * 0.1)))])
      for (const s of [-1, 1]) agregar([fig(estrellaP(s * u * 0.2, cz + hz * 0.15, Math.min(hz * 0.26, u * 0.05)))])
      for (const s of [-1, 1]) agregar([fig(estrellaP(s * u * 0.08, -cz - hz * 0.05, Math.min(hz * 0.26, u * 0.05)))])
      for (const s of [-1, 1]) agregar([fig(estrellaP(s * u * 0.24, -cz - hz * 0.2, Math.min(hz * 0.2, u * 0.04)))])
      agregar([fig(estrellaP(0, -cz + hz * 0.28, Math.min(hz * 0.18, u * 0.035)))])
      break
    case "pinos": {
      const h = Math.min(hz * 0.8, u * 0.2)
      const base = -cz + h / 2
      agregar(pino(0, base, h))
      // los de los lados, más chicos y arriba (la zona se angosta hacia abajo)
      const hs = h * 0.6
      for (const s of [-1, 1]) agregar(pino(s * u * 0.18, yAbajo + hs + 0.5, hs))
      agregar([fig(estrellaP(0, cz, Math.min(hz * 0.36, u * 0.075)))])
      for (const s of [-1, 1]) agregar([fig(circ(s * u * 0.14, cz + hz * 0.08, Math.min(hz * 0.09, u * 0.02)))])
      for (const s of [-1, 1]) agregar([fig(circ(s * u * 0.25, cz + hz * 0.22, Math.min(hz * 0.07, u * 0.016)))])
      break
    }
    case "regalos": {
      const s = Math.min(hz * 0.62, u * 0.15)
      agregar(regalo(0, -cz + s * 0.08, s))
      const ss = s * 0.6
      for (const x of [-1, 1]) agregar(regalo(x * u * 0.19, yAbajo + ss * 0.7 + 0.4, ss))
      agregar([fig(estrellaP(0, cz, Math.min(hz * 0.36, u * 0.075)))])
      for (const sg of [-1, 1]) agregar([fig(estrellaP(sg * u * 0.19, cz + hz * 0.14, Math.min(hz * 0.2, u * 0.04)))])
      break
    }
    case "corazones": {
      const s = Math.min(hz * 0.5, u * 0.11)
      agregar([fig(corazonP(0, cz, s * 1.2))])
      for (const sg of [-1, 1]) agregar([fig(corazonP(sg * u * 0.2, cz + hz * 0.14, s * 0.7))])
      agregar([fig(corazonP(0, -cz, s * 1.2))])
      for (const sg of [-1, 1]) agregar([fig(corazonP(sg * u * 0.2, -cz - hz * 0.14, s * 0.7))])
      break
    }
    case "lunares": {
      const r = Math.max(1.2, u * 0.026)
      const paso = r * 3.1
      for (let y = -R; y <= R; y += paso)
        for (let x = -R; x <= R; x += paso) {
          const fila = Math.round((y + R) / paso)
          agregar([fig(circ(x + (fila % 2 ? paso / 2 : 0), y, r, 28))])
        }
      break
    }
    case "rayas": {
      // ranuras diagonales que se recortan con la zona
      const a = Math.max(1.4, u * 0.03)
      const paso = a * 2.4
      const rayas: Curva[] = []
      for (let x = -2 * R; x <= 2 * R; x += paso) rayas.push(fig([[x, -R], [x + a, -R], [x + a + 2 * R, R], [x + 2 * R, R]]))
      const m = llenar(g, rayas)
      for (let k = 0; k < m.length; k++) if (m[k] && zona[k]) hueco[k] = 1
      break
    }
  }
  if (abiertas) for (let k = 0; k < zona.length; k++) if (zona[k]) hueco[k] = 1
  if (figuras.length) {
    const m = llenar(g, figuras)
    for (let k = 0; k < m.length; k++) if (m[k] && zona[k]) hueco[k] = 1
  }
  for (let k = 0; k < solido.length; k++) solido[k] = solido[k] && !hueco[k] && !huecoTapa[k] ? 1 : 0
  // cuellos más delgados que ~0.6 mm se rompen al vectorizar y al cortar:
  // se abren (erosión y dilatación) y lo que queda suelto se descarta
  abrir(solido, g.w, g.h, 0.3 * pxmm)
  soloLaMayor(solido, g.w, g.h)
  const mm = (cs: Curva[]) => aMM(g, cs)
  const piezas = contornos(solido, g.w, g.h, 1).filter((l) => l.area > 0).length
  const curvas = mm(curvasDeMascara(solido, g.w, g.h, { tolerancia: 0.5, manchas: Math.max(2, (0.6 * pxmm) ** 2), suave: false }))
  return { contornos: curvas, piezas, medidas: M }
}

// Distancia (chaflán 3-4, en píxeles) a la celda más cercana con valor "a"
function distancia(m: Uint8Array, w: number, h: number, a: number): Float32Array {
  const d = new Float32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = m[i] === a ? 0 : 1e9
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = d[i]
      if (!v) continue
      if (x > 0) v = Math.min(v, d[i - 1] + 3)
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3)
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4)
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4)
      }
      d[i] = v
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let v = d[i]
      if (!v) continue
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3)
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3)
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4)
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4)
      }
      d[i] = v
    }
  for (let i = 0; i < d.length; i++) d[i] /= 3
  return d
}
// engrosa la figura r píxeles (en el mismo arreglo)
function engrosar(m: Uint8Array, w: number, h: number, r: number) {
  if (!(r > 0)) return
  const d = distancia(m, w, h, 1)
  for (let i = 0; i < m.length; i++) m[i] = d[i] <= r ? 1 : 0
}
// abre la figura: adelgaza y vuelve a engrosar r píxeles (quita cuellos y pelusas)
function abrir(m: Uint8Array, w: number, h: number, r: number) {
  if (!(r > 0)) return
  const d = distancia(m, w, h, 0)
  for (let i = 0; i < m.length; i++) m[i] = d[i] > r ? 1 : 0
  engrosar(m, w, h, r)
}

// Deja sólo la parte más grande: los pedacitos que quedan encerrados entre
// figuras (la punta de un copo, la unión de dos ramitas) se caerían al cortar,
// así que pasan a ser parte del hueco. Garantiza una sola pieza.
function soloLaMayor(m: Uint8Array, w: number, h: number) {
  const et = new Int32Array(w * h).fill(-1)
  const tam: number[] = []
  const pila: number[] = []
  for (let q0 = 0; q0 < m.length; q0++) {
    if (!m[q0] || et[q0] >= 0) continue
    const n = tam.length
    let c = 0
    et[q0] = n
    pila.push(q0)
    while (pila.length) {
      const q = pila.pop()!
      c++
      const i = q % w
      if (i > 0 && m[q - 1] && et[q - 1] < 0) { et[q - 1] = n; pila.push(q - 1) }
      if (i < w - 1 && m[q + 1] && et[q + 1] < 0) { et[q + 1] = n; pila.push(q + 1) }
      if (q >= w && m[q - w] && et[q - w] < 0) { et[q - w] = n; pila.push(q - w) }
      if (q + w < m.length && m[q + w] && et[q + w] < 0) { et[q + w] = n; pila.push(q + w) }
    }
    tam.push(c)
  }
  if (tam.length < 2) return
  const mayor = tam.indexOf(Math.max(...tam))
  for (let q = 0; q < m.length; q++) if (m[q] && et[q] !== mayor) m[q] = 0
}

function aMM(g: Rejilla, curvas: Curva[]): Curva[] {
  const P = (p: P): P => [g.x0 + p[0] / g.pxmm, g.y0 + p[1] / g.pxmm]
  return curvas.map((c) => ({ ...c, inicio: P(c.inicio), tramos: c.tramos.map((q) => ("c1" in q ? { c1: P(q.c1), c2: P(q.c2), p: P(q.p) } : { p: P(q.p) })) }))
}

// ---------- el nombre dentro de la ventana ----------
const f23 = 2 / 3
type Cmd = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }
function curvasGlifo(cmds: Cmd[]): Curva[] {
  const out: Curva[] = []
  let act: Curva | null = null
  let a: P = [0, 0]
  for (const c of cmds) {
    const p: P = [c.x ?? 0, c.y ?? 0]
    if (c.type === "M") {
      if (act && act.tramos.length) out.push(act)
      act = { inicio: p, tramos: [], hueco: false }
    } else if (c.type === "L" && act) act.tramos.push({ p })
    else if (c.type === "C" && act) act.tramos.push({ c1: [c.x1 ?? 0, c.y1 ?? 0], c2: [c.x2 ?? 0, c.y2 ?? 0], p })
    else if (c.type === "Q" && act) {
      const q: P = [c.x1 ?? 0, c.y1 ?? 0]
      act.tramos.push({ c1: [a[0] + f23 * (q[0] - a[0]), a[1] + f23 * (q[1] - a[1])], c2: [p[0] + f23 * (q[0] - p[0]), p[1] + f23 * (q[1] - p[1])], p })
    } else if (c.type === "Z") {
      if (act && act.tramos.length) out.push(act)
      act = null
      continue
    }
    a = p
  }
  if (act && act.tramos.length) out.push(act)
  return out
}
// puntos sobre las curvas (no los de control, que quedan por fuera del trazo)
function puntosCurvas(cs: Curva[]): P[] {
  const out: P[] = []
  for (const c of cs) {
    let a = c.inicio
    out.push(a)
    for (const q of c.tramos) {
      if ("c1" in q)
        for (let i = 1; i <= 16; i++) {
          const s = i / 16
          const u = 1 - s
          out.push([
            u * u * u * a[0] + 3 * u * u * s * q.c1[0] + 3 * u * s * s * q.c2[0] + s * s * s * q.p[0],
            u * u * u * a[1] + 3 * u * u * s * q.c1[1] + 3 * u * s * s * q.c2[1] + s * s * s * q.p[1],
          ])
        }
      else out.push(q.p)
      a = q.p
    }
  }
  return out
}
function limites(cs: Curva[]) {
  const pts = puntosCurvas(cs)
  if (!pts.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}
const transformar = (cs: Curva[], f: (p: P) => P): Curva[] =>
  cs.map((c) => ({ ...c, inicio: f(c.inicio), tramos: c.tramos.map((q) => ("c1" in q ? { c1: f(q.c1), c2: f(q.c2), p: f(q.p) } : { p: f(q.p) })) }))

export type NombreEsfera = { huecos: Curva[]; soportes: number; compresion: number; faltan: string[] }

// Letras del nombre en la ventana: cada letra o número se estira al alto de la
// ventana (más lo que entra en los rieles). Con "cursiva" se escala la palabra
// completa para no romper las uniones. Devuelve los huecos a cortar.
export function nombreEsfera(fuente: Fuente, texto: string, o: OpcionesEsfera, pxmm: number): NombreEsfera {
  const M = medidasEsfera(o.diametro)
  const { t, hb, Ri, w } = M
  const ov = t * 0.6 // cuánto entra cada letra en los rieles
  const yt = -hb / 2 - ov
  const yb = hb / 2 + ov
  const cuerda = Math.sqrt(Math.max(0, Ri * Ri - (hb / 2) ** 2))
  const disponible = 2 * (cuerda - Math.max(w, o.diametro * 0.03))
  const faltan: string[] = []
  const em = fuente.unitsPerEm
  const H = limites(curvasGlifo(fuente.charToGlyph("H").getPath(0, 0, em).commands as Cmd[]))
  const altoH = H && H.y1 - H.y0 > 0 ? H.y1 - H.y0 : em * 0.7
  const tam = (hb * em) / altoH
  const k = tam / em
  const chars = Array.from(texto.trim())
  let letras: Curva[] = []
  if (o.cursiva) {
    // opentype.js arma la palabra completa (con sus ligaduras y uniones)
    const f = fuente as unknown as { getPath?: (t: string, x: number, y: number, s: number) => { commands: Cmd[] } }
    const curvas = curvasGlifo(f.getPath ? f.getPath(texto.trim(), 0, 0, tam).commands : [])
    const b = limites(curvas)
    if (b) {
      const s = (yb - yt) / (b.y1 - b.y0)
      letras = transformar(curvas, ([x, y]) => [(x - (b.x0 + b.x1) / 2) * s, yt + (y - b.y0) * s])
    }
  } else {
    let x = 0
    let prev: ReturnType<Fuente["charToGlyph"]> | null = null
    for (const ch of chars) {
      const gl = fuente.charToGlyph(ch)
      if (prev) x += fuente.getKerningValue(prev, gl) * k
      const curvas = curvasGlifo(gl.getPath(0, 0, tam).commands as Cmd[])
      const b = limites(curvas)
      if (!b && ch.trim()) faltan.push(ch)
      if (b) {
        if (/[\p{L}\p{N}]/u.test(ch)) {
          // letra o número: al alto completo de la ventana. Si es más alta que
          // la H (acento, tilde) se angosta en la misma proporción para que el
          // acento conserve su forma y no se vea como un punto.
          // Con acento, la punta entra poco en el riel (si entrara completa, el
          // acento quedaría tapado por el riel y se vería como un punto).
          const gh = b.y1 - b.y0
          const conAcento = gh > altoH * k * 1.08
          const arriba = conAcento ? -hb / 2 - Math.min(0.35, ov) : yt
          const sy = (yb - arriba) / gh
          const sx = conAcento ? (altoH * k * 1.08) / gh : 1
          const cx = (b.x0 + b.x1) / 2
          letras.push(...transformar(curvas, ([px, py]) => [x + cx + (px - cx) * sx, arriba + (py - b.y0) * sy]))
        } else {
          // signo: proporción natural, centrado; el soporte lo pone la reparación
          const s = Math.min(1, (hb * 0.7) / Math.max(b.y1 - b.y0, 1e-6))
          const cy = (b.y0 + b.y1) / 2
          letras.push(...transformar(curvas, ([px, py]) => [x + (px - b.x0) * s + b.x0, (py - cy) * s]))
        }
      }
      x += (gl.advanceWidth ?? 0) * k
      prev = gl
    }
    const b = limites(letras)
    if (b) {
      const c = (b.x0 + b.x1) / 2
      letras = transformar(letras, ([px, py]) => [px - c, py])
    }
  }
  let compresion = 1
  const b = limites(letras)
  if (b && b.x1 - b.x0 > disponible) {
    compresion = disponible / (b.x1 - b.x0)
    letras = transformar(letras, ([px, py]) => [px * compresion, py])
  }

  // rejilla de la ventana
  const g = rejilla(-Ri, -hb / 2 - 1, Ri, hb / 2 + 1, pxmm)
  const ventana = new Uint8Array(g.w * g.h)
  for (let j = 0; j < g.h; j++) {
    const y = pxY(g, j)
    if (y <= -hb / 2 || y >= hb / 2) continue
    for (let i = 0; i < g.w; i++) {
      const x = pxX(g, i)
      if (x * x + y * y < Ri * Ri) ventana[j * g.w + i] = 1
    }
  }
  const L = llenar(g, letras)
  // un poco más gruesas: los trazos finos (nombres largos, letras con remates)
  // no se rompen al vectorizar ni se queman con el láser
  engrosar(L, g.w, g.h, 0.15 * pxmm)
  const S = new Uint8Array(g.w * g.h)
  for (let q = 0; q < S.length; q++) S[q] = L[q] && ventana[q] ? 1 : 0

  // reparación: cada parte suelta (o apenas tocando) recibe un soporte al riel de abajo
  const ws = Math.max(1.2, o.diametro * 0.015)
  const contactoMin = Math.max(3, Math.round(1.0 * pxmm))
  let soportes = 0
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    const sueltas = partesSueltas(S, ventana, g.w, g.h, contactoMin)
    if (!sueltas.length) break
    for (const s of sueltas) {
      soportes++
      const half = (ws * pxmm) / 2
      for (let j = s.j; j < g.h; j++)
        for (let i = Math.max(0, Math.floor(s.i - half)); i <= Math.min(g.w - 1, Math.ceil(s.i + half)); i++) if (ventana[j * g.w + i]) S[j * g.w + i] = 1
    }
  }
  const C = new Uint8Array(g.w * g.h)
  for (let q = 0; q < C.length; q++) C[q] = ventana[q] && !S[q] ? 1 : 0
  // huecos de menos de ~1 mm² (rendijas entre letra y riel) se quedan sólidos: en láser no se ven y ensucian el corte
  const huecos = aMM(g, curvasDeMascara(C, g.w, g.h, { tolerancia: 0.5, manchas: Math.max(2, (1.1 * pxmm) ** 2), suave: false }))
  return { huecos, soportes, compresion, faltan }
}

// Partes del nombre que no tocan la orilla de la ventana (los rieles o el aro)
// con al menos contactoMin píxeles. Devuelve su píxel más bajo (centro).
function partesSueltas(S: Uint8Array, V: Uint8Array, w: number, h: number, contactoMin: number) {
  const etiqueta = new Int32Array(w * h).fill(-1)
  const sueltas: { i: number; j: number }[] = []
  const pila: number[] = []
  let n = 0
  for (let q0 = 0; q0 < S.length; q0++) {
    if (!S[q0] || etiqueta[q0] >= 0) continue
    let contacto = 0
    let bajo = q0
    etiqueta[q0] = n
    pila.push(q0)
    while (pila.length) {
      const q = pila.pop()!
      const i = q % w
      const j = (q - i) / w
      if (j > ((bajo - (bajo % w)) / w)) bajo = q
      let toca = false
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di
        const jj = j + dj
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) { toca = true; continue }
        const r = jj * w + ii
        if (!V[r]) toca = true
        else if (S[r] && etiqueta[r] < 0) {
          etiqueta[r] = n
          pila.push(r)
        }
      }
      if (toca) contacto++
    }
    // su píxel más bajo: el soporte baja desde ahí, así siempre toca la pieza
    if (contacto < contactoMin) sueltas.push({ i: bajo % w, j: (bajo - (bajo % w)) / w })
    n++
  }
  return sueltas
}

// ---------- esfera completa ----------
export type Esfera = { trazos: Trazo[]; ancho: number; alto: number; piezas: number; soportes: number; compresion: number; faltan: string[] }

// pxmm según el tamaño: fino en esferas chicas, sin pasarse de memoria en grandes
export const resolucionEsfera = (D: number) => Math.max(3, Math.min(16, 1400 / (D * 1.3)))

export function armarEsfera(marco: MarcoEsfera, nombre: NombreEsfera | null, dx = 0, dy = 0): Esfera {
  const curvas = [...marco.contornos, ...(nombre ? nombre.huecos : [])]
  const M = marco.medidas
  // Y hacia arriba; (dx, dy) es la esquina de abajo a la izquierda de la esfera
  const trazos = curvasATrazos(curvas, "corte").map((tr) => ({ ...tr, pts: tr.pts.map(([x, y]) => [x + M.R + dx, M.R - y + dy] as P) }))
  return {
    trazos,
    ancho: M.ancho,
    alto: M.alto,
    piezas: marco.piezas,
    soportes: nombre?.soportes ?? 0,
    compresion: nombre?.compresion ?? 1,
    faltan: nombre?.faltan ?? [],
  }
}
