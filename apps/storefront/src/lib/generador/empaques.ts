// Plantillas de empaque (troqueles) para imprimir, cortar con plotter o láser.
// Todo en milímetros, calculado en el navegador.
//  - Líneas de CORTE: contornos cerrados.
//  - Líneas de DOBLEZ: segmentos sueltos. Salen marcadas (capa DOBLEZ) o
//    perforadas para cartón (capa PERFORADO, cortes con puentes).

export type P = [number, number]
export type Plantilla = {
  nombre: string
  cortes: P[][] // contornos cerrados
  pliegues: [P, P][] // líneas de doblez
}
export type Resultado = { piezas: Plantilla[]; errores: string[]; avisos: string[] }

// Generadores (geometría). Las plantillas que ve el usuario (FORMAS) apuntan a
// uno de estos con sus medidas de inicio; varias plantillas pueden compartir
// generador (caja pizza y caja para pastel son la misma caja con tapa unida).
export type Gen =
  | "caja" | "piramide" | "cono" | "sobre" | "bolsa" | "hexagonal"
  | "bandeja" | "tapaFondo" | "pillow" | "bolsaAsa" | "bolsaPlana" | "prisma" | "cilindro"
  | "tetra" | "maceta" | "sobreBolsillo" | "sobrePuntas" | "tarjeta" | "cajaVentana" | "cajon" | "bisagra" | "inserto"
  | "envio" | "leche" | "exhibidor" | "cartas" | "rebanada" | "explosiva"
  | "redonda" | "corazon" | "estrella"
export type Forma = string // id de la plantilla en FORMAS

export type Datos = {
  largo: number // caja: largo · sobre: ancho del contenido · bolsa: ancho
  ancho: number // caja: ancho · sobre: alto del contenido · bolsa: fuelle · pirámide/hexagonal: lado · cono: diámetro base
  alto: number // altura (caja, pirámide, cono, bolsa, hexagonal)
  pestana: number // pestaña de pegado
  lados: number // pirámide/prisma/maceta: lados de la base (3 a 8)
  diametroSup: number // cono: diámetro superior (0 = punta) · maceta: lado de arriba
  conBase: boolean // cono: agrega pestañas y tapa redonda
  altoTapa: number // caja con tapa suelta: alto de la tapa
  holgura: number // tapa suelta y cajón: holgura entre piezas
  margen: number // caja con ventana: marco alrededor de la ventana
  filas: number // inserto: filas de huecos
  columnas: number // inserto: columnas de huecos
  diametro: number // inserto: diámetro de cada hueco
}

const PI = Math.PI
const r3 = (x: number) => Math.round(x * 1000) / 1000
const sum = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]]
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k]
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]]
const largoDe = (a: P) => Math.hypot(a[0], a[1])
const unit = (a: P): P => mul(a, 1 / (largoDe(a) || 1))
const rot = (a: P, t: number): P => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)]

// Pestaña trapecial a la derecha del tramo p→q (afuera, en un contorno antihorario).
// Devuelve los puntos intermedios (sin p ni q).
function pestana(p: P, q: P, prof: number, bisel = prof): P[] {
  const d = sub(q, p)
  const L = largoDe(d)
  const u = unit(d)
  const n: P = [u[1], -u[0]]
  const b = Math.min(bisel, L * 0.3)
  return [sum(sum(p, mul(u, b)), mul(n, prof)), sum(sub(q, mul(u, b)), mul(n, prof))]
}

// ---------- Franja de paneles (caja con solapas, bolsa, hexagonal) ----------
// Paneles en fila, pegados a lo largo; cada borde de arriba o abajo puede llevar una solapa.
// Una solapa se describe en coordenadas del borde: u a lo largo (0 = izquierda), v hacia afuera.
type Solapa = { puntos: P[]; pliegues?: [P, P][] }

function franja(
  anchos: number[],
  alto: number,
  pegado: number,
  abajo: (Solapa | null)[],
  arriba: (Solapa | null)[],
  extras: [P, P][] = []
) {
  const xs = [pegado]
  for (const w of anchos) xs.push(xs[xs.length - 1] + w)
  const pts: P[] = []
  const pliegues: [P, P][] = [...extras]
  // abajo, de izquierda a derecha
  pts.push([xs[0], 0])
  anchos.forEach((w, i) => {
    const s = abajo[i]
    const x = xs[i]
    if (s) {
      for (const [u, v] of s.puntos) pts.push([x + u, -v])
      pliegues.push([[x, 0], [x + w, 0]])
      for (const [a, b] of s.pliegues || []) pliegues.push([[x + a[0], -a[1]], [x + b[0], -b[1]]])
    }
    pts.push([x + w, 0])
  })
  // lado derecho y arriba, de derecha a izquierda
  for (let i = anchos.length - 1; i >= 0; i--) {
    const s = arriba[i]
    const x = xs[i]
    pts.push([x + anchos[i], alto])
    if (s) {
      for (const [u, v] of [...s.puntos].reverse()) pts.push([x + u, alto + v])
      pliegues.push([[x, alto], [x + anchos[i], alto]])
      for (const [a, b] of s.pliegues || []) pliegues.push([[x + a[0], alto + a[1]], [x + b[0], alto + b[1]]])
    }
    pts.push([x, alto])
  }
  // pestaña de pegado a la izquierda
  const c = Math.min(pegado, alto / 4)
  pts.push([0, alto - c], [0, c])
  // dobleces verticales entre paneles
  for (let i = 0; i < anchos.length; i++) pliegues.push([[xs[i], 0], [xs[i], alto]])
  return { contorno: limpiar(pts), pliegues, xs }
}

const trapecio = (w: number, h: number, bisel: number): Solapa => {
  const b = Math.min(bisel, w * 0.3)
  return { puntos: [[b, h], [w - b, h]] }
}

// tapa con lengüeta (caja con solapas)
function tapa(L: number, W: number): Solapa {
  const T = Math.min(Math.max(W * 0.35, 8), 25, W)
  const r = Math.min(1.5, L * 0.05)
  const ch = Math.min(T * 0.6, (L - 2 * r) / 4)
  return {
    puntos: [[0, W], [r, W], [r + ch, W + T], [L - r - ch, W + T], [L - r, W], [L, W]],
    pliegues: [[[r, W], [L - r, W]]],
  }
}

function cajaSolapas(d: Datos): Resultado {
  const { largo: L, ancho: W, alto: H } = d
  const g = Math.min(d.pestana, L * 0.4)
  const dp = Math.min(W * 0.7, L / 2 - 1)
  const polvo = trapecio(W, dp, Math.min(dp * 0.4, W * 0.2))
  const f = franja([L, W, L, W], H, g, [tapa(L, W), polvo, null, polvo], [null, polvo, tapa(L, W), polvo])
  return { piezas: [{ nombre: "Caja", cortes: [f.contorno], pliegues: f.pliegues }], errores: [], avisos: [] }
}

function hexagonal(d: Datos): Resultado {
  const a = d.ancho
  const H = d.alto
  const g = Math.min(d.pestana, a * 0.4)
  const s3 = Math.sqrt(3)
  const hex: Solapa = { puntos: [[-a / 2, (s3 / 2) * a], [0, s3 * a], [a, s3 * a], [a + a / 2, (s3 / 2) * a]] }
  const t = Math.min(a * 0.3, 12)
  const tab = trapecio(a, t, t)
  const f = franja(
    Array(6).fill(a),
    H,
    g,
    [tab, tab, tab, tab, hex, tab],
    [tab, hex, tab, tab, tab, tab]
  )
  return { piezas: [{ nombre: "Caja hexagonal", cortes: [f.contorno], pliegues: f.pliegues }], errores: [], avisos: [] }
}

function bolsa(d: Datos): Resultado {
  const { largo: A, ancho: F, alto: H } = d
  const g = Math.min(d.pestana, F * 0.8)
  const vF = F / 2 + Math.min(15, F / 2) // frente y atrás se enciman en el fondo
  const vL = Math.max(F / 2 - 1, 1) // costados
  const frente = trapecio(A, vF, Math.min(vF * 0.25, A * 0.1))
  const costado = trapecio(F, vL, Math.min(vL * 0.5, F * 0.25))
  const x0 = g
  const centros: [P, P][] = [
    [[x0 + A + F / 2, 0], [x0 + A + F / 2, H]],
    [[x0 + 2 * A + 1.5 * F, 0], [x0 + 2 * A + 1.5 * F, H]],
  ]
  const f = franja([A, F, A, F], H, g, [frente, costado, frente, costado], [null, null, null, null], centros)
  return { piezas: [{ nombre: "Bolsa", cortes: [f.contorno], pliegues: f.pliegues }], errores: [], avisos: ["Dobla el centro de los costados hacia adentro para formar el fuelle."] }
}

function sobre(d: Datos): Resultado {
  const w = d.largo + 4 // 2 mm de holgura por lado
  const h = d.ancho + 4
  const sd = w * 0.28
  const bd = h * 0.55
  const td = h * 0.45
  const pts: P[] = [
    [0, 0],
    [w * 0.12, -bd], [w * 0.88, -bd],
    [w, 0],
    [w + sd, h * 0.15], [w + sd, h * 0.85],
    [w, h],
    [w * 0.6, h + td], [w * 0.4, h + td],
    [0, h],
    [-sd, h * 0.85], [-sd, h * 0.15],
  ]
  const pl: [P, P][] = [
    [[0, 0], [w, 0]], [[w, 0], [w, h]], [[w, h], [0, h]], [[0, h], [0, 0]],
  ]
  return { piezas: [{ nombre: "Sobre", cortes: [pts], pliegues: pl }], errores: [], avisos: [] }
}

function piramide(d: Datos): Resultado {
  const n = Math.round(d.lados)
  const b = d.ancho
  const h = d.alto
  const errores: string[] = []
  if (n < 3 || n > 8) errores.push("La base debe tener de 3 a 8 lados.")
  if (errores.length) return { piezas: [], errores, avisos: [] }
  const R = b / (2 * Math.sin(PI / n))
  const e = Math.hypot(h, R)
  const alfa = 2 * Math.asin(b / (2 * e))
  if (n * alfa > 2 * PI - 0.5) {
    return { piezas: [], errores: ["La pirámide es muy baja para armarse: aumenta la altura."], avisos: [] }
  }
  const t0 = -PI / 2 - (n * alfa) / 2
  const Pn = (i: number): P => [e * Math.cos(t0 + i * alfa), e * Math.sin(t0 + i * alfa)]
  const O: P = [0, 0]
  const k = Math.floor((n - 1) / 2)
  const tab = Math.min(10, b * 0.2)
  const g = Math.min(d.pestana, b * 0.4)

  // base: polígono regular sobre el borde P_k→P_{k+1}, hacia afuera
  const Q: P[] = [Pn(k + 1), Pn(k)]
  let dir = sub(Q[1], Q[0])
  for (let j = 2; j < n; j++) {
    dir = rot(dir, (2 * PI) / n)
    Q.push(sum(Q[j - 1], dir))
  }
  const pts: P[] = [O]
  const pl: [P, P][] = []
  for (let i = 0; i <= n; i++) {
    pts.push(Pn(i))
    if (i > 0 && i < n) pl.push([O, Pn(i)])
    if (i === k) {
      // recorrer la base con pestañas en sus bordes libres
      const base = [...Q.slice(1), Q[0]] // P_k, Q2..Q_{n-1}, P_{k+1}
      for (let j = 0; j < base.length - 1; j++) {
        pts.push(...pestana(base[j], base[j + 1], tab))
        pts.push(base[j + 1])
        pl.push([base[j], base[j + 1]])
      }
      pts.pop() // P_{k+1} se agrega en la siguiente vuelta
      pl.push([Pn(k), Pn(k + 1)])
    }
  }
  pts.push(...pestana(Pn(n), O, g, g))
  pl.push([Pn(n), O])
  return { piezas: [{ nombre: "Pirámide", cortes: [limpiar(pts)], pliegues: pl }], errores: [], avisos: [] }
}

function cono(d: Datos): Resultado {
  const D = d.ancho
  const d2 = Math.max(0, d.diametroSup)
  const h = d.alto
  if (d2 >= D) return { piezas: [], errores: ["El diámetro superior debe ser menor que el de la base."], avisos: [] }
  const s = Math.hypot(h, (D - d2) / 2)
  const R = (s * D) / (D - d2)
  const r = R - s
  const th = (PI * D) / R
  if (th > 2 * PI - 0.35) return { piezas: [], errores: ["El cono es muy plano para armarse: aumenta la altura."], avisos: [] }
  const f0 = -PI / 2 - th / 2
  const arco = (rad: number, a: number): P => [rad * Math.cos(a), rad * Math.sin(a)]
  const g = Math.min(d.pestana, s * 0.3)
  const pts: P[] = []
  const pl: [P, P][] = []

  if (d.conBase) {
    const m = Math.max(8, Math.round((PI * D) / 20))
    const tab = Math.min(8, D * 0.08)
    for (let j = 0; j < m; j++) {
      const a = arco(R, f0 + (th * j) / m)
      const b = arco(R, f0 + (th * (j + 1)) / m)
      pts.push(a, ...pestana(a, b, tab))
      pl.push([a, b])
    }
  } else {
    const m = Math.max(24, Math.ceil(th / (PI / 90)))
    for (let j = 0; j < m; j++) pts.push(arco(R, f0 + (th * j) / m))
  }
  const fin = arco(R, f0 + th)
  pts.push(fin)
  // pestaña de pegado en el borde recto final
  const interiorFin: P = r > 0 ? arco(r, f0 + th) : [0, 0]
  pts.push(...pestana(fin, interiorFin, g, g))
  pl.push([fin, interiorFin])
  if (r > 0) {
    const m = Math.max(12, Math.ceil(th / (PI / 90)))
    for (let j = m; j >= 0; j--) pts.push(arco(r, f0 + (th * j) / m))
  } else {
    pts.push([0, 0])
  }
  const piezas: Plantilla[] = [{ nombre: "Cono", cortes: [limpiar(pts)], pliegues: pl }]
  if (d.conBase) {
    const m = Math.max(48, Math.ceil(D))
    const circ: P[] = Array.from({ length: m }, (_, j) => arco(D / 2, (2 * PI * j) / m))
    piezas.push({ nombre: "Base", cortes: [circ], pliegues: [] })
  }
  return { piezas, errores: [], avisos: [] }
}

// ---------- Plantillas nuevas ----------

// rectángulo como contorno
const rect = (x: number, y: number, w: number, h: number): P[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
// círculo aproximado
const circulo = (cx: number, cy: number, r: number, m = 48): P[] =>
  Array.from({ length: m }, (_, j) => [cx + r * Math.cos((2 * PI * j) / m), cy + r * Math.sin((2 * PI * j) / m)] as P)
// rectángulo con esquinas redondeadas
function rectRedondo(x: number, y: number, w: number, h: number, r: number): P[] {
  r = Math.min(r, w / 2, h / 2)
  const pts: P[] = []
  const esq: [number, number, number][] = [[x + w - r, y + r, -PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, PI / 2], [x + r, y + r, PI]]
  for (const [cx, cy, a0] of esq) for (let j = 0; j <= 6; j++) pts.push([cx + r * Math.cos(a0 + (PI / 2) * (j / 6)), cy + r * Math.sin(a0 + (PI / 2) * (j / 6))])
  return pts
}

// Charola abierta (cruz con pestañas en las paredes cortas). Base L × W, alto H.
function bandejaPieza(L: number, W: number, H: number, pest: number, nombre: string): Plantilla {
  const g = Math.min(pest, H * 0.8)
  const b = Math.min(g, H * 0.3)
  const pts: P[] = [
    [0, -H], [L, -H], [L, 0],
    [L + b, -g], [L + H - b, -g], [L + H, 0],
    [L + H, W], [L + H - b, W + g], [L + b, W + g], [L, W],
    [L, W + H], [0, W + H], [0, W],
    [-b, W + g], [-H + b, W + g], [-H, W],
    [-H, 0], [-H + b, -g], [-b, -g], [0, 0],
  ]
  const pl: [P, P][] = [
    [[0, 0], [L, 0]], [[L, 0], [L, W]], [[L, W], [0, W]], [[0, W], [0, 0]],
    [[L, 0], [L + H, 0]], [[L, W], [L + H, W]], [[0, 0], [-H, 0]], [[0, W], [-H, W]],
  ]
  return { nombre, cortes: [limpiar(pts)], pliegues: pl }
}
const bandeja = (d: Datos): Resultado => ({ piezas: [bandejaPieza(d.largo, d.ancho, d.alto, d.pestana, "Charola")], errores: [], avisos: [] })

function tapaFondo(d: Datos): Resultado {
  const h = Math.max(0, d.holgura)
  const tapa = Math.min(d.altoTapa, d.alto)
  return {
    piezas: [
      bandejaPieza(d.largo, d.ancho, d.alto, d.pestana, "Base"),
      bandejaPieza(d.largo + 2 * h + 2 * 0.4, d.ancho + 2 * h + 2 * 0.4, tapa, d.pestana, "Tapa"),
    ],
    errores: [],
    avisos: ["La tapa lleva la holgura más el grosor del material; si usas cartón grueso, sube la holgura."],
  }
}

// Caja almohada: dos paneles con solapas curvas (corte convexo, doblez cóncavo)
function pillow(d: Datos): Resultado {
  const A = d.largo
  const B = d.ancho
  const g = Math.min(d.pestana, A * 0.3)
  const c = Math.min(A, B) * 0.18
  const m = 16
  const arco = (x0: number, y0: number, prof: number, inv = false): P[] =>
    Array.from({ length: m + 1 }, (_, j) => {
      const u = inv ? 1 - j / m : j / m
      return [x0 + A * u, y0 + prof * (1 - (2 * u - 1) ** 2)] as P
    })
  const c2 = Math.min(B * 0.25, g)
  const pts: P[] = [
    ...arco(g, 0, -c), ...arco(g + A, 0, -c),
    [g + 2 * A, B],
    ...arco(g + A, B, c, true), ...arco(g, B, c, true),
    [0, B - c2], [0, c2],
  ]
  const seg = (a: P[]): [P, P][] => a.slice(1).map((q, i) => [a[i], q])
  const pl: [P, P][] = [
    ...seg(arco(g, 0, c)), ...seg(arco(g + A, 0, c)),
    ...seg(arco(g, B, -c)), ...seg(arco(g + A, B, -c)),
    [[g, 0], [g, B]], [[g + A, 0], [g + A, B]],
  ]
  return { piezas: [{ nombre: "Caja almohada", cortes: [limpiar(pts)], pliegues: pl }], errores: [], avisos: ["Dobla las solapas curvas hacia adentro; cierra sin pegamento."] }
}

// Bolsa con asas: bolsa con fuelle + refuerzo arriba y ojales para listón
function bolsaAsa(d: Datos): Resultado {
  const r = bolsa(d)
  if (!r.piezas.length) return r
  const { largo: A, ancho: F, alto: H } = d
  const g = Math.min(d.pestana, F * 0.8)
  const pieza = r.piezas[0]
  const ref = Math.min(25, H * 0.15)
  pieza.pliegues.push([[g, H - ref], [g + 2 * A + 2 * F, H - ref]])
  const ojal = (cx: number, cy: number) => {
    const w = Math.max(6, Math.min(A * 0.1, 12))
    const hh = Math.max(4, w * 0.6)
    return rectRedondo(cx - w / 2, cy - hh / 2, w, hh, hh / 2)
  }
  const y = H - ref / 2
  for (const x0 of [g, g + A + F]) {
    pieza.cortes.push(ojal(x0 + A * 0.3, y), ojal(x0 + A * 0.7, y))
  }
  r.avisos.push("Dobla el refuerzo de arriba hacia adentro antes de pasar el listón por los ojales.")
  return r
}

// Bolsa plana (sin fuelle) con solapa
function bolsaPlana(d: Datos): Resultado {
  const { largo: A, alto: H } = d
  const g = Math.min(d.pestana, A * 0.3)
  const s = Math.min(Math.max(H * 0.2, 15), A * 0.6)
  const f = franja([A, A], H, g, [trapecio(A, g, g * 0.6), null], [null, trapecio(A, s, s * 0.35)])
  return { piezas: [{ nombre: "Bolsa plana", cortes: [f.contorno], pliegues: f.pliegues }], errores: [], avisos: [] }
}

// Prisma de N lados (base y tapa poligonales)
function prisma(d: Datos): Resultado {
  const n = Math.round(d.lados)
  if (n < 3 || n > 10) return { piezas: [], errores: ["El prisma debe tener de 3 a 10 lados."], avisos: [] }
  const a = d.ancho
  const H = d.alto
  const g = Math.min(d.pestana, a * 0.4)
  // polígono regular colgado del borde (0,0)-(a,0), hacia afuera (v > 0)
  const V: P[] = [[0, 0], [a, 0]]
  let dir: P = [a, 0]
  for (let j = 2; j < n; j++) {
    dir = rot(dir, (2 * PI) / n)
    V.push(sum(V[j - 1], dir))
  }
  const poli: Solapa = { puntos: V.slice(2).reverse() }
  const t = Math.min(a * 0.3, 12)
  const tab = trapecio(a, t, t)
  const abajo = Array.from({ length: n }, (_, i) => (i === n - 2 ? poli : tab))
  const arriba = Array.from({ length: n }, (_, i) => (i === 1 ? poli : tab))
  const f = franja(Array(n).fill(a), H, g, abajo, arriba)
  return { piezas: [{ nombre: `Prisma de ${n} lados`, cortes: [f.contorno], pliegues: f.pliegues }], errores: [], avisos: [] }
}

// Tubo con tapas: cuerpo con pestañas en ambos bordes + 2 círculos
function cilindro(d: Datos): Resultado {
  const D = d.ancho
  const H = d.alto
  const g = Math.min(d.pestana, D * 0.3)
  const L = PI * D
  const m = Math.max(8, Math.round(L / 18))
  const tab = Math.min(8, D * 0.1)
  const pts: P[] = []
  const pl: [P, P][] = []
  for (let j = 0; j < m; j++) {
    const a: P = [g + (L * j) / m, 0]
    const b: P = [g + (L * (j + 1)) / m, 0]
    pts.push(a, ...pestana(a, b, tab))
  }
  pts.push([g + L, 0], [g + L, H])
  for (let j = m; j > 0; j--) {
    const a: P = [g + (L * j) / m, H]
    const b: P = [g + (L * (j - 1)) / m, H]
    pts.push(a, ...pestana(a, b, tab))
  }
  pts.push([g, H])
  const c = Math.min(g, H / 4)
  pts.push([0, H - c], [0, c])
  pl.push([[g, 0], [g + L, 0]], [[g, H], [g + L, H]], [[g, 0], [g, H]])
  return {
    piezas: [
      { nombre: "Cuerpo", cortes: [limpiar(pts)], pliegues: pl },
      { nombre: "Tapa", cortes: [circulo(0, 0, D / 2)], pliegues: [] },
      { nombre: "Fondo", cortes: [circulo(0, 0, D / 2)], pliegues: [] },
    ],
    errores: [],
    avisos: ["Enrolla el cuerpo, pega la pestaña y dobla las lengüetas hacia adentro para pegar las tapas."],
  }
}

// Pirámide de regalo: base cuadrada con 4 triángulos que se cierran arriba con listón
function tetra(d: Datos): Resultado {
  const a = d.ancho
  const h = d.alto
  const s = Math.hypot(h, a / 2)
  const pts: P[] = [[0, 0], [a / 2, -s], [a, 0], [a + s, a / 2], [a, a], [a / 2, a + s], [0, a], [-s, a / 2]]
  const pl: [P, P][] = [[[0, 0], [a, 0]], [[a, 0], [a, a]], [[a, a], [0, a]], [[0, a], [0, 0]]]
  const r = Math.min(2.5, a * 0.04)
  const k = Math.min(10, s * 0.15)
  const ojales = [circulo(a / 2, -s + k, r), circulo(a + s - k, a / 2, r), circulo(a / 2, a + s - k, r), circulo(-s + k, a / 2, r)]
  return { piezas: [{ nombre: "Pirámide de regalo", cortes: [limpiar(pts), ...ojales], pliegues: pl }], errores: [], avisos: ["Pasa un listón por los cuatro ojales y jálalo para cerrarla."] }
}

// Pirámide truncada (maceta, cubeta) de N lados
function maceta(d: Datos): Resultado {
  const n = Math.round(d.lados)
  if (n < 3 || n > 10) return { piezas: [], errores: ["Debe tener de 3 a 10 lados."], avisos: [] }
  const a = d.ancho
  const b = d.diametroSup
  const h = d.alto
  if (!(b > 0) || b === a) return { piezas: [], errores: ["El lado de arriba debe ser mayor que cero y distinto al de abajo."], avisos: [] }
  const ap = (l: number) => l / (2 * Math.tan(PI / n))
  const s = Math.hypot(h, ap(a) - ap(b))
  const th = Math.atan2(Math.abs(a - b) / 2, s)
  if (n * 2 * th > 2 * PI - 0.4) return { piezas: [], errores: ["Es muy baja para armarse: aumenta la altura o el lado de arriba."], avisos: [] }
  // panel 0 y los demás por reflexión sobre el lado compartido
  const refl = (p: P, A: P, B: P): P => {
    const u = unit(sub(B, A))
    const v = sub(p, A)
    const t = v[0] * u[0] + v[1] * u[1]
    const foot: P = sum(A, mul(u, t))
    return sub(mul(foot, 2), p)
  }
  let panel: P[] = [[0, 0], [a, 0], [(a + b) / 2, s], [(a - b) / 2, s]]
  const abajo: [P, P][] = []
  const pts: P[] = []
  const pl: [P, P][] = []
  const tab = Math.min(10, a * 0.2)
  const arriba: P[] = []
  for (let i = 0; i < n; i++) {
    abajo.push([panel[0], panel[1]])
    arriba.push(panel[3], panel[2])
    if (i < n - 1) {
      const A = panel[1], B = panel[2]
      pl.push([A, B])
      // el panel siguiente es el reflejo de este sobre el lado compartido
      panel = [A, refl(panel[0], A, B), refl(panel[3], A, B), B]
    }
  }
  // contorno: base con polígono en el primer panel, pestañas en las demás bases, lado final con pestaña de pegado, borde superior
  const g = Math.min(d.pestana, s * 0.3)
  // polígono base colgado del primer borde (hacia afuera = abajo)
  const Q: P[] = [abajo[0][1], abajo[0][0]]
  let dir = sub(Q[1], Q[0])
  for (let j = 2; j < n; j++) {
    dir = rot(dir, (2 * PI) / n)
    Q.push(sum(Q[j - 1], dir))
  }
  const base = [...Q.slice(1), Q[0]] // de abajo[0][0] rodeando hasta abajo[0][1]
  pts.push(abajo[0][0])
  for (let j = 0; j < base.length - 1; j++) {
    pts.push(...pestana(base[j], base[j + 1], tab))
    pts.push(base[j + 1])
    pl.push([base[j], base[j + 1]])
  }
  pl.push([abajo[0][0], abajo[0][1]])
  for (let i = 1; i < n; i++) {
    pts.push(abajo[i][0], ...pestana(abajo[i][0], abajo[i][1], tab), abajo[i][1])
    pl.push([abajo[i][0], abajo[i][1]])
  }
  const fin = abajo[n - 1][1]
  const finSup = arriba[2 * (n - 1) + 1]
  pts.push(...pestana(fin, finSup, g, g))
  pl.push([fin, finSup])
  for (let i = n - 1; i >= 0; i--) pts.push(arriba[2 * i + 1], arriba[2 * i])
  return { piezas: [{ nombre: `Maceta de ${n} lados`, cortes: [limpiar(pts)], pliegues: pl }], errores: [], avisos: [] }
}

// Funda / sobre de bolsillo (abierto por arriba)
function sobreBolsillo(d: Datos): Resultado {
  const w = d.largo + 3
  const h = d.ancho + 3
  const g = Math.min(d.pestana, w * 0.25)
  const b = Math.min(g, h * 0.15)
  const pts: P[] = [[0, -h], [w, -h], [w, 0], [w + g, b], [w + g, h - b], [w, h], [0, h], [-g, h - b], [-g, b], [0, 0]]
  const pl: [P, P][] = [[[0, 0], [w, 0]], [[w, 0], [w, h]], [[0, 0], [0, h]]]
  return { piezas: [{ nombre: "Funda", cortes: [limpiar(pts)], pliegues: pl }], errores: [], avisos: ["Dobla el frente sobre el fondo y pega las pestañas laterales por detrás."] }
}

// Sobre de cuatro puntas
function sobrePuntas(d: Datos): Resultado {
  const w = d.largo + 4
  const h = d.ancho + 4
  const pts: P[] = [[0, 0], [w / 2, -h * 0.55], [w, 0], [w + w * 0.42, h / 2], [w, h], [w / 2, h + h * 0.55], [0, h], [-w * 0.42, h / 2]]
  const pl: [P, P][] = [[[0, 0], [w, 0]], [[w, 0], [w, h]], [[w, h], [0, h]], [[0, h], [0, 0]]]
  return { piezas: [{ nombre: "Sobre de puntas", cortes: [pts], pliegues: pl }], errores: [], avisos: ["Dobla primero los lados, luego abajo y al final la punta de arriba; se cierra con un sello o listón."] }
}

// Tarjeta doblada
function tarjeta(d: Datos): Resultado {
  const w = d.largo
  const h = d.ancho
  return { piezas: [{ nombre: "Tarjeta", cortes: [rect(0, 0, 2 * w, h)], pliegues: [[[w, 0], [w, h]]] }], errores: [], avisos: [] }
}

// Caja con solapas + ventana en el frente
function cajaVentana(d: Datos): Resultado {
  const r = cajaSolapas(d)
  const { largo: L, alto: H } = d
  const m = Math.max(5, d.margen)
  if (L - 2 * m < 5 || H - 2 * m < 5) return { piezas: [], errores: ["La ventana no cabe: baja el marco."], avisos: [] }
  const g = Math.min(d.pestana, L * 0.4)
  r.piezas[0].cortes.push(rectRedondo(g + m, m, L - 2 * m, H - 2 * m, Math.min(6, m)))
  r.avisos.push("Pega una mica o acetato por dentro de la ventana.")
  return r
}

// Caja tipo cajón: funda + charola
function cajon(d: Datos): Resultado {
  const { largo: L, ancho: W, alto: H } = d
  const hol = Math.max(0, d.holgura) + 0.5
  const g = Math.min(d.pestana, (H + hol) * 0.8)
  const f = franja([W + 2 * hol, H + 2 * hol, W + 2 * hol, H + 2 * hol], L, g, [null, null, null, null], [null, null, null, null])
  return {
    piezas: [bandejaPieza(L, W, H, d.pestana, "Cajón"), { nombre: "Funda", cortes: [f.contorno], pliegues: f.pliegues }],
    errores: [],
    avisos: ["La funda queda abierta por los dos extremos; el cajón se desliza por dentro."],
  }
}

// Caja con tapa unida (bisagra): pizza, pastel, regalo
function bisagra(d: Datos): Resultado {
  const { largo: L, ancho: W, alto: H } = d
  const g = Math.min(d.pestana, H * 0.8)
  const b = Math.min(g, H * 0.3)
  const f = Math.max(5, H - 1.5) // solapas de la tapa, entran por dentro
  const bf = Math.min(f * 0.5, W * 0.1)
  const ft = Math.max(5, H * 0.9)
  const c = Math.min(ft, L * 0.1)
  const y1 = W + H // doblez pared trasera / tapa
  const y2 = y1 + W // doblez tapa / solapa frontal
  const pts: P[] = [
    [0, -H], [L, -H], [L, 0],
    [L + b, -g], [L + H - b, -g], [L + H, 0], [L + H, W], [L + H - b, W + g], [L + b, W + g], [L, W],
    [L, y1], [L + f, y1 + bf], [L + f, y2 - bf], [L, y2],
    [L - c, y2 + ft], [c, y2 + ft], [0, y2],
    [-f, y2 - bf], [-f, y1 + bf], [0, y1],
    [0, W], [-b, W + g], [-H + b, W + g], [-H, W], [-H, 0], [-H + b, -g], [-b, -g], [0, 0],
  ]
  const pl: [P, P][] = [
    [[0, 0], [L, 0]], [[L, 0], [L, W]], [[L, W], [0, W]], [[0, W], [0, 0]],
    [[L, 0], [L + H, 0]], [[L, W], [L + H, W]], [[0, 0], [-H, 0]], [[0, W], [-H, W]],
    [[0, y1], [L, y1]], [[0, y2], [L, y2]], [[L, y1], [L, y2]], [[0, y1], [0, y2]],
  ]
  return { piezas: [{ nombre: "Caja con tapa unida", cortes: [limpiar(pts)], pliegues: pl }], errores: [], avisos: ["Las solapas de la tapa entran por dentro de las paredes; no necesita pegamento al cerrar."] }
}

// Inserto con huecos redondos (cupcakes, velas, frascos)
function inserto(d: Datos): Resultado {
  const { largo: L, ancho: W } = d
  const cols = Math.max(1, Math.round(d.columnas))
  const fil = Math.max(1, Math.round(d.filas))
  const D = d.diametro
  if (!(D > 0)) return { piezas: [], errores: ["Escribe el diámetro de los huecos."], avisos: [] }
  if (cols * D > L - 4 || fil * D > W - 4) return { piezas: [], errores: ["Los huecos no caben: baja el diámetro o la cantidad."], avisos: [] }
  const cortes: P[][] = [rect(0, 0, L, W)]
  for (let i = 0; i < cols; i++) for (let j = 0; j < fil; j++) cortes.push(circulo((L * (i + 0.5)) / cols, (W * (j + 0.5)) / fil, D / 2))
  return { piezas: [{ nombre: "Inserto", cortes, pliegues: [] }], errores: [], avisos: ["Córtalo en cartulina gruesa o MDF de 3 mm; se apoya dentro de la caja."] }
}


// Caja de envío autoarmable (mailer): base, paredes laterales dobles que
// atrapan las orejas del frente y de atrás, tapa unida con solapas y lengüeta
// que entra detrás del frente. Se arma sin pegamento.
function envio(d: Datos): Resultado {
  const { largo: L, ancho: W, alto: H } = d
  const t = 1 // holgura por el grosor del cartón
  const e = Math.min(W * 0.45, H * 2) // orejas
  const be = Math.min(e * 0.3, H * 0.25)
  const ch = Math.min(H * 0.5, W * 0.12) // biseles de la pared interior
  const dH = Math.max(5, H - t) // solapas de la tapa
  const cc = Math.min(dH * 0.5, W * 0.15)
  const Hf = Math.max(5, H - t) // frente de la tapa
  const T = Math.min(Hf * 0.9, W * 0.35) // lengüeta
  const ct = Math.min(T * 0.6, L * 0.15)
  const y1 = W + H
  const y2 = y1 + W
  const y3 = y2 + Hf
  const pts: P[] = [
    [0, -H], [L, -H],
    [L + e, -H + be], [L + e, -be], [L, 0],
    [L + H, 0], [L + 2 * H - t, ch], [L + 2 * H - t, W - ch], [L + H, W], [L, W],
    [L + e, W + be], [L + e, y1 - be], [L, y1],
    [L + dH, y1 + cc], [L + dH, y2 - cc], [L, y2],
    [L, y3], [L - ct, y3 + T], [ct, y3 + T], [0, y3],
    [0, y2], [-dH, y2 - cc], [-dH, y1 + cc], [0, y1],
    [-e, y1 - be], [-e, W + be], [0, W],
    [-H, W], [-2 * H + t, W - ch], [-2 * H + t, ch], [-H, 0], [0, 0],
    [-e, -be], [-e, -H + be],
  ]
  const pl: [P, P][] = [
    [[0, 0], [L, 0]], [[L, 0], [L, W]], [[0, W], [L, W]], [[0, 0], [0, W]],
    [[L + H, 0], [L + H, W]], [[-H, 0], [-H, W]],
    [[0, -H], [0, 0]], [[L, -H], [L, 0]], [[0, W], [0, y1]], [[L, W], [L, y1]],
    [[0, y1], [L, y1]], [[0, y1], [0, y2]], [[L, y1], [L, y2]], [[0, y2], [L, y2]], [[0, y3], [L, y3]],
  ]
  return {
    piezas: [{ nombre: "Caja de envío", cortes: [limpiar(pts)], pliegues: pl }],
    errores: [],
    avisos: [
      "Se arma sin pegamento: dobla las orejas hacia dentro, luego la pared lateral doble encima de ellas, y cierra metiendo la lengüeta detrás del frente.",
      "Las medidas son por dentro. Para envíos usa cartón corrugado y dobleces perforados o marcados.",
    ],
  }
}

// Caja de leche (techo a dos aguas): cuatro paredes, fondo con lengüeta y
// techo con fuelles triangulares en los lados y aleta de cierre arriba.
function leche(d: Datos): Resultado {
  const { largo: L, ancho: W, alto: H } = d
  const g = Math.min(d.pestana, L * 0.4)
  const R = W / 2
  const fin = Math.min(15, Math.max(8, W * 0.2))
  const dp = Math.min(W * 0.7, L / 2 - 1)
  const polvo = trapecio(W, dp, Math.min(dp * 0.4, W * 0.2))
  const f = franja([L, W, L, W], H + R + fin, g, [tapa(L, W), polvo, null, polvo], [null, null, null, null])
  const xs = f.xs
  const pl = [...f.pliegues]
  for (let i = 0; i < 4; i++) {
    const [a, b] = [xs[i], xs[i + 1]]
    pl.push([[a, H], [b, H]], [[a, H + R], [b, H + R]])
    if (i % 2 === 1) {
      const m = (a + b) / 2
      pl.push([[a, H], [m, H + R]], [[b, H], [m, H + R]], [[m, H + R], [m, H + R + fin]])
    }
  }
  return {
    piezas: [{ nombre: "Caja de leche", cortes: [f.contorno], pliegues: pl }],
    errores: [],
    avisos: ["Los lados del techo se doblan hacia dentro por las diagonales. Cierra la aleta de arriba con pegamento, un broche o una perforación con listón."],
  }
}

// Exhibidor de mostrador: charola con frente bajo, lados inclinados y
// respaldo alto para el letrero. Pestañas de pegado en frente y respaldo.
function exhibidor(d: Datos): Resultado {
  const { largo: L, ancho: W, alto: Hb } = d
  const hF = d.altoTapa
  if (hF >= Hb) return { piezas: [], errores: ["El frente debe ser más bajo que el respaldo."], avisos: [] }
  const hS = Math.max(hF, Math.min(Hb, hF + W * 0.6)) // alto de los lados atrás
  const g = Math.min(d.pestana, W * 0.4)
  const b = Math.min(g * 0.6, hF * 0.3)
  const bs = Math.min(g * 0.6, hS * 0.3)
  const r = Math.min(10, L * 0.1) // esquinas del respaldo
  const top = W + Hb
  const pts: P[] = [
    [0, -hF], [L, -hF],
    [L + g, -hF + b], [L + g, -b], [L, 0],
    [L + hF, 0], [L + hS, W], [L, W],
    [L + g, W + bs], [L + g, W + hS - bs], [L, W + hS],
    [L, top - r], [L - r, top], [r, top], [0, top - r],
    [0, W + hS], [-g, W + hS - bs], [-g, W + bs], [0, W],
    [-hS, W], [-hF, 0], [0, 0],
    [-g, -b], [-g, -hF + b],
  ]
  const pl: [P, P][] = [
    [[0, 0], [L, 0]], [[L, 0], [L, W]], [[0, W], [L, W]], [[0, 0], [0, W]],
    [[0, -hF], [0, 0]], [[L, -hF], [L, 0]], [[0, W], [0, W + hS]], [[L, W], [L, W + hS]],
  ]
  return {
    piezas: [{ nombre: "Exhibidor", cortes: [limpiar(pts)], pliegues: pl }],
    errores: [],
    avisos: ["Pega las pestañas del frente y del respaldo por dentro de los lados. El respaldo queda libre para tu logo o letrero."],
  }
}

// Caja para cartas o tarjetas: caja con solapas y muesca para el pulgar en el frente
function cartas(d: Datos): Resultado {
  const r = cajaSolapas(d)
  const { largo: L, alto: H } = d
  const g = Math.min(d.pestana, L * 0.4)
  const c = r.piezas[0].cortes[0]
  const i = c.findIndex((q, k) => {
    const n = c[(k + 1) % c.length]
    return Math.abs(q[0] - (g + L)) < 1e-3 && Math.abs(q[1] - H) < 1e-3 && Math.abs(n[0] - g) < 1e-3 && Math.abs(n[1] - H) < 1e-3
  })
  const rad = Math.min(L * 0.18, 12, H * 0.2)
  if (i >= 0) {
    const cx = g + L / 2
    const arco: P[] = Array.from({ length: 17 }, (_, j) => [cx + rad * Math.cos((-PI * j) / 16), H + rad * Math.sin((-PI * j) / 16)] as P)
    c.splice(i + 1, 0, ...arco)
    r.piezas[0].cortes[0] = limpiar(c)
  }
  r.piezas[0].nombre = "Caja para cartas"
  return r
}

// Rebanada de pastel: prisma triangular. Las tapas (triángulos) van unidas a
// un lado; el respaldo y el otro lado llevan pestañas para pegarlas.
function rebanada(d: Datos): Resultado {
  const R = d.largo
  const H = d.alto
  const n = Math.round(d.lados)
  if (n < 3 || n > 24) return { piezas: [], errores: ["Las rebanadas por pastel van de 3 a 24."], avisos: [] }
  const th = (2 * PI) / n
  const cuerda = 2 * R * Math.sin(th / 2)
  const g = Math.min(d.pestana, H * 0.4)
  const tri: Solapa = { puntos: [[R * Math.cos(th), R * Math.sin(th)]] }
  const f = franja(
    [R, cuerda, R],
    H,
    g,
    [tri, trapecio(cuerda, Math.min(g, cuerda * 0.3), g * 0.6), trapecio(R, g, g)],
    [tri, trapecio(cuerda, Math.min(g, cuerda * 0.3), g * 0.6), trapecio(R, g, g)],
  )
  return {
    piezas: [{ nombre: "Rebanada", cortes: [f.contorno], pliegues: f.pliegues }],
    errores: [],
    avisos: [`Ángulo de la punta: ${r3((360 / n) * 10) / 10}°. Las pestañas del respaldo y del lado se pegan por dentro de los triángulos.`],
  }
}

// Caja sorpresa (explosiva): cruz de base y cuatro paredes que se abren al
// quitar la tapa, más la tapa suelta.
function explosiva(d: Datos): Resultado {
  const { largo: L, alto: H } = d
  const hol = Math.max(0, d.holgura) + 0.4
  const tapaAlto = Math.min(d.altoTapa, H)
  const pts: P[] = [[0, -H], [L, -H], [L, 0], [L + H, 0], [L + H, L], [L, L], [L, L + H], [0, L + H], [0, L], [-H, L], [-H, 0], [0, 0]]
  const pl: [P, P][] = [[[0, 0], [L, 0]], [[L, 0], [L, L]], [[0, L], [L, L]], [[0, 0], [0, L]]]
  return {
    piezas: [
      { nombre: "Base y paredes", cortes: [limpiar(pts)], pliegues: pl },
      bandejaPieza(L + 2 * hol, L + 2 * hol, tapaAlto, d.pestana, "Tapa"),
    ],
    errores: [],
    avisos: ["Las paredes no se pegan: la tapa las mantiene cerradas y al quitarla se abren. Decora el interior con fotos o mensajes."],
  }
}

// ---------- Cajas de contorno (redonda, ovalada, corazón, estrella) ----------
// Base con la figura y pestañas alrededor, una tira de pared del largo del
// perímetro con pestaña de pegado, y la tapa igual pero un poco más grande.
// Las curvas se aproximan con tramos rectos: cada tramo es un doblez de la base.

const areaFirmada = (c: P[]) => {
  let s = 0
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) s += (c[j][0] - c[i][0]) * (c[j][1] + c[i][1])
  return s / 2
}
// a la medida largo × ancho, centrada en el origen y antihoraria
function ajustarFigura(pts: P[], L: number, W: number): P[] {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const q = pts.map(([x, y]) => [((x - (x0 + x1) / 2) * L) / (x1 - x0 || 1), ((y - (y0 + y1) / 2) * W) / (y1 - y0 || 1)] as P)
  // al voltear se conserva el punto 0 (la tira de pared empieza ahí)
  return areaFirmada(q) < 0 ? [q[0], ...q.slice(1).reverse()] : q
}
// reparte n puntos a la misma distancia sobre un contorno cerrado (empieza en el punto 0)
function remuestrear(pts: P[], n: number): P[] {
  const c = [...pts, pts[0]]
  const acum = [0]
  for (let i = 1; i < c.length; i++) acum.push(acum[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]))
  const L = acum[acum.length - 1]
  const out: P[] = []
  let i = 1
  for (let k = 0; k < n; k++) {
    const s = (L * k) / n
    while (i < acum.length - 1 && acum[i] < s) i++
    const t = (s - acum[i - 1]) / (acum[i] - acum[i - 1] || 1)
    out.push([c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t])
  }
  return out
}
const perimetro = (c: P[]) => c.reduce((s, p, i) => s + Math.hypot(c[(i + 1) % c.length][0] - p[0], c[(i + 1) % c.length][1] - p[1]), 0)

type Figura = (L: number, W: number) => P[]
const figuraElipse: Figura = (L, W) => {
  // tramos del mismo largo (en una elipse, repartir por ángulo deja tramos cortos en las puntas)
  const fino = ajustarFigura(Array.from({ length: 720 }, (_, j) => [Math.cos((2 * PI * j) / 720), Math.sin((2 * PI * j) / 720)] as P), L, W)
  const n = Math.max(20, Math.min(60, Math.round(perimetro(fino) / 14)))
  return remuestrear(fino, n)
}
const figuraCorazon: Figura = (L, W) => {
  const fino = Array.from({ length: 720 }, (_, j) => {
    const t = (2 * PI * j) / 720
    return [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)] as P
  })
  const base = ajustarFigura(fino, L, W)
  let n = Math.max(24, Math.min(60, Math.round(perimetro(base) / 14)))
  n += n % 2 // par: así la punta de abajo también es vértice
  return remuestrear(base, n)
}
const figuraEstrella: Figura = (L, W) =>
  ajustarFigura(
    Array.from({ length: 10 }, (_, j) => {
      const a = PI / 2 + (PI * j) / 5
      const r = j % 2 ? 0.45 : 1
      return [r * Math.cos(a), r * Math.sin(a)] as P
    }),
    L,
    W,
  )

// segmentos de un contorno que se cruzan (sin contar los vecinos)
function primerCruce(c: P[]): [number, number] | null {
  const o = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  const n = c.length
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const [a, b, d, e] = [c[i], c[(i + 1) % n], c[j], c[(j + 1) % n]]
      if (o(a, b, d) * o(a, b, e) < 0 && o(d, e, a) * o(d, e, b) < 0) return [i, j]
    }
  return null
}

// Base (o tapa) con pestañas hacia afuera en cada tramo. Quita las pestañas
// que chocan entre sí (en las partes cóncavas, como el centro del corazón).
function baseConPestanas(fig: P[], prof: number, nombre: string): Plantilla {
  const n = fig.length
  const con = fig.map(() => true)
  const armar = () => {
    const pts: P[] = []
    const dueno: number[] = []
    for (let i = 0; i < n; i++) {
      const [p, q] = [fig[i], fig[(i + 1) % n]]
      pts.push(p)
      dueno.push(i)
      if (con[i]) {
        const largo = Math.hypot(q[0] - p[0], q[1] - p[1])
        for (const r of pestana(p, q, Math.min(prof, largo * 0.8), Math.min(prof * 0.9, largo * 0.3))) {
          pts.push(r)
          dueno.push(i)
        }
      }
    }
    return { pts, dueno }
  }
  for (let vuelta = 0; vuelta < n; vuelta++) {
    const { pts, dueno } = armar()
    const x = primerCruce(pts)
    if (!x) break
    const cand = [dueno[x[0]], dueno[x[1]]].filter((i) => con[i])
    if (!cand.length) break
    con[cand[vuelta % cand.length]] = false
  }
  const { pts } = armar()
  const pliegues: [P, P][] = []
  for (let i = 0; i < n; i++) if (con[i]) pliegues.push([fig[i], fig[(i + 1) % n]])
  return { nombre, cortes: [pts], pliegues }
}

// Tira de pared: largo del perímetro, con pestaña de pegado al final y
// dobleces en las esquinas de la figura (índices de vértice; la tira empieza
// en el vértice 0, así que ese no lleva doblez)
function tiraPared(fig: P[], alto: number, pegado: number, nombre: string, esquinas: number[]): Plantilla {
  const n = fig.length
  const P_ = perimetro(fig)
  const g = Math.min(pegado, alto * 0.8)
  const b = Math.min(g, alto * 0.25)
  const pts: P[] = [[0, 0], [P_, 0], [P_ + g, b], [P_ + g, alto - b], [P_, alto], [0, alto]]
  const pliegues: [P, P][] = [[[P_, 0], [P_, alto]]]
  let s = 0
  for (let i = 0; i < n; i++) {
    const [p, q] = [fig[i], fig[(i + 1) % n]]
    if (i > 0 && esquinas.includes(i)) pliegues.push([[s, 0], [s, alto]])
    s += Math.hypot(q[0] - p[0], q[1] - p[1])
  }
  return { nombre, cortes: [pts], pliegues }
}

function cajaContorno(d: Datos, figura: Figura, nombre: string, esquinas: (n: number) => number[] = () => []): Resultado {
  const { largo: L, ancho: W, alto: H } = d
  const hol = Math.max(0, d.holgura) + 0.5
  const tapaAlto = Math.min(d.altoTapa, H)
  const prof = Math.min(d.pestana, Math.min(L, W) / 6, H * 0.6)
  const fig = figura(L, W)
  const figTapa = figura(L + 2 * hol, W + 2 * hol)
  return {
    piezas: [
      baseConPestanas(fig, prof, `Base de ${nombre}`),
      tiraPared(fig, H, d.pestana, "Pared", esquinas(fig.length)),
      baseConPestanas(figTapa, Math.min(prof, tapaAlto * 0.6), "Tapa"),
      tiraPared(figTapa, tapaAlto, d.pestana, "Pared de la tapa", esquinas(figTapa.length)),
    ],
    errores: [],
    avisos: [
      "Dobla las pestañas de la base hacia arriba y pega la pared por fuera de ellas, siguiendo el contorno. La tapa se arma igual.",
      `La pared mide ${Math.round(perimetro(fig))} mm de largo; si no cabe en tu hoja, elige una hoja más grande o imprime en mosaico.`,
    ],
  }
}
const redonda = (d: Datos) => cajaContorno(d, figuraElipse, "caja redonda")
// corazón: la tira empieza en el centro de arriba (vértice 0); la punta de abajo es el vértice n/2
const corazon = (d: Datos) => cajaContorno(d, figuraCorazon, "corazón", (n) => [n / 2])
const estrella = (d: Datos) => cajaContorno(d, figuraEstrella, "estrella", (n) => Array.from({ length: n }, (_, i) => i))

// quita puntos repetidos consecutivos y puntos en línea recta
function limpiar(pts: P[]): P[] {
  let p = pts.map(([x, y]) => [r3(x), r3(y)] as P)
  p = p.filter((q, i) => {
    const r = p[(i + p.length - 1) % p.length]
    return !(q[0] === r[0] && q[1] === r[1])
  })
  let cambio = true
  while (cambio && p.length > 3) {
    cambio = false
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length]
      const b = p[i]
      const c = p[(i + 1) % p.length]
      const cruz = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      const punto = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])
      if (Math.abs(cruz) < 1e-6 && punto > 0) {
        p.splice(i, 1)
        cambio = true
        break
      }
    }
  }
  return p
}

export type Grupo = "Cajas" | "Bolsas y sobres" | "Formas" | "Tarjetas e insertos"

export type FormaDef = {
  id: Forma
  nombre: string
  grupo: Grupo
  gen: Gen
  campos: (keyof Datos)[]
  inicio: Partial<Datos>
  detalle?: string
}

const C = {
  caja: ["largo", "ancho", "alto", "pestana"] as (keyof Datos)[],
}

// Las 30+ plantillas que ve el usuario. Varias comparten generador.
export const FORMAS: FormaDef[] = [
  // Cajas
  { id: "caja", nombre: "Caja con solapas", grupo: "Cajas", gen: "caja", campos: C.caja, inicio: { largo: 80, ancho: 50, alto: 120, pestana: 12 }, detalle: "Cierre de lengüeta, la clásica" },
  { id: "caja-ventana", nombre: "Caja con ventana", grupo: "Cajas", gen: "cajaVentana", campos: [...C.caja, "margen"], inicio: { largo: 100, ancho: 60, alto: 120, pestana: 12, margen: 12 }, detalle: "Para que se vea el producto" },
  { id: "tapa-fondo", nombre: "Caja de regalo con tapa", grupo: "Cajas", gen: "tapaFondo", campos: ["largo", "ancho", "alto", "altoTapa", "holgura", "pestana"], inicio: { largo: 120, ancho: 90, alto: 50, altoTapa: 25, holgura: 1, pestana: 12 }, detalle: "Base y tapa suelta" },
  { id: "caja-taza", nombre: "Caja para taza", grupo: "Cajas", gen: "tapaFondo", campos: ["largo", "ancho", "alto", "altoTapa", "holgura", "pestana"], inicio: { largo: 125, ancho: 125, alto: 110, altoTapa: 40, holgura: 1.5, pestana: 15 } },
  { id: "bandeja", nombre: "Charola abierta", grupo: "Cajas", gen: "bandeja", campos: C.caja, inicio: { largo: 150, ancho: 100, alto: 40, pestana: 15 }, detalle: "Bandeja sin tapa" },
  { id: "bisagra", nombre: "Caja con tapa unida", grupo: "Cajas", gen: "bisagra", campos: C.caja, inicio: { largo: 120, ancho: 90, alto: 50, pestana: 15 }, detalle: "La tapa va pegada a la caja" },
  { id: "pizza", nombre: "Caja para pizza", grupo: "Cajas", gen: "bisagra", campos: C.caja, inicio: { largo: 300, ancho: 300, alto: 40, pestana: 25 } },
  { id: "pastel", nombre: "Caja para pastel", grupo: "Cajas", gen: "bisagra", campos: C.caja, inicio: { largo: 250, ancho: 250, alto: 130, pestana: 25 } },
  { id: "cupcakes", nombre: "Caja para 6 cupcakes", grupo: "Cajas", gen: "cajaVentana", campos: [...C.caja, "margen"], inicio: { largo: 250, ancho: 170, alto: 90, pestana: 20, margen: 20 }, detalle: "Combínala con el inserto de 6" },
  { id: "pillow", nombre: "Caja almohada", grupo: "Cajas", gen: "pillow", campos: ["largo", "ancho", "pestana"], inicio: { largo: 100, ancho: 70, pestana: 10 }, detalle: "Pillow box, cierra sin pegar" },
  { id: "jabon", nombre: "Caja para jabón", grupo: "Cajas", gen: "pillow", campos: ["largo", "ancho", "pestana"], inicio: { largo: 95, ancho: 65, pestana: 10 } },
  { id: "cajon", nombre: "Caja tipo cajón", grupo: "Cajas", gen: "cajon", campos: [...C.caja, "holgura"], inicio: { largo: 100, ancho: 60, alto: 25, pestana: 10, holgura: 1 }, detalle: "Como caja de cerillos: funda y cajón" },
  { id: "hexagonal", nombre: "Caja hexagonal", grupo: "Cajas", gen: "hexagonal", campos: ["ancho", "alto", "pestana"], inicio: { ancho: 40, alto: 80, pestana: 12 } },
  { id: "octagonal", nombre: "Caja octagonal", grupo: "Cajas", gen: "prisma", campos: ["lados", "ancho", "alto", "pestana"], inicio: { lados: 8, ancho: 35, alto: 70, pestana: 12 } },
  { id: "triangular", nombre: "Caja triangular", grupo: "Cajas", gen: "prisma", campos: ["lados", "ancho", "alto", "pestana"], inicio: { lados: 3, ancho: 60, alto: 150, pestana: 12 }, detalle: "Tipo chocolate suizo" },
  { id: "prisma", nombre: "Prisma de N lados", grupo: "Cajas", gen: "prisma", campos: ["lados", "ancho", "alto", "pestana"], inicio: { lados: 5, ancho: 45, alto: 90, pestana: 12 } },
  { id: "cilindro", nombre: "Tubo con tapas", grupo: "Cajas", gen: "cilindro", campos: ["ancho", "alto", "pestana"], inicio: { ancho: 70, alto: 120, pestana: 12 }, detalle: "Cilindro para velas, té, dulces" },
  { id: "envio", nombre: "Caja de envío autoarmable", grupo: "Cajas", gen: "envio", campos: ["largo", "ancho", "alto"], inicio: { largo: 250, ancho: 180, alto: 80 }, detalle: "Mailer para tienda en línea, sin pegamento" },
  { id: "cartas", nombre: "Caja para cartas", grupo: "Cajas", gen: "cartas", campos: C.caja, inicio: { largo: 64, ancho: 23, alto: 90, pestana: 12 }, detalle: "Baraja o tarjetas, con muesca para el pulgar" },
  { id: "cerillos", nombre: "Caja de cerillos", grupo: "Cajas", gen: "cajon", campos: [...C.caja, "holgura"], inicio: { largo: 55, ancho: 36, alto: 15, pestana: 8, holgura: 0.6 }, detalle: "Funda y cajón pequeños" },
  { id: "leche", nombre: "Caja de leche", grupo: "Cajas", gen: "leche", campos: C.caja, inicio: { largo: 70, ancho: 70, alto: 120, pestana: 12 }, detalle: "Techo a dos aguas, para dulces o recuerdos" },
  { id: "explosiva", nombre: "Caja sorpresa (explosiva)", grupo: "Cajas", gen: "explosiva", campos: ["largo", "alto", "altoTapa", "holgura", "pestana"], inicio: { largo: 100, alto: 100, altoTapa: 30, holgura: 1, pestana: 12 }, detalle: "Al quitar la tapa se abren las paredes" },
  { id: "exhibidor", nombre: "Exhibidor de mostrador", grupo: "Cajas", gen: "exhibidor", campos: ["largo", "ancho", "alto", "altoTapa", "pestana"], inicio: { largo: 220, ancho: 160, alto: 220, altoTapa: 50, pestana: 20 }, detalle: "Charola con respaldo alto para punto de venta" },
  { id: "rebanada", nombre: "Rebanada de pastel", grupo: "Cajas", gen: "rebanada", campos: ["largo", "alto", "lados", "pestana"], inicio: { largo: 110, alto: 70, lados: 8, pestana: 10 }, detalle: "Varias forman un pastel completo" },
  { id: "redonda", nombre: "Caja redonda con tapa", grupo: "Cajas", gen: "redonda", campos: ["largo", "alto", "altoTapa", "holgura", "pestana"], inicio: { largo: 100, ancho: 100, alto: 60, altoTapa: 25, holgura: 1, pestana: 10 }, detalle: "Sombrerera para regalos, velas o dulces" },
  { id: "ovalada", nombre: "Caja ovalada con tapa", grupo: "Cajas", gen: "redonda", campos: ["largo", "ancho", "alto", "altoTapa", "holgura", "pestana"], inicio: { largo: 140, ancho: 90, alto: 50, altoTapa: 20, holgura: 1, pestana: 10 } },
  { id: "corazon", nombre: "Caja corazón con tapa", grupo: "Cajas", gen: "corazon", campos: ["largo", "ancho", "alto", "altoTapa", "holgura", "pestana"], inicio: { largo: 130, ancho: 120, alto: 50, altoTapa: 20, holgura: 1, pestana: 10 }, detalle: "Para chocolates o San Valentín" },
  { id: "estrella", nombre: "Caja estrella con tapa", grupo: "Cajas", gen: "estrella", campos: ["largo", "ancho", "alto", "altoTapa", "holgura", "pestana"], inicio: { largo: 130, ancho: 124, alto: 45, altoTapa: 20, holgura: 1, pestana: 10 } },
  { id: "poster", nombre: "Tubo para póster", grupo: "Cajas", gen: "cilindro", campos: ["ancho", "alto", "pestana"], inicio: { ancho: 60, alto: 450, pestana: 15 } },
  // Bolsas y sobres
  { id: "bolsa", nombre: "Bolsa con fuelle", grupo: "Bolsas y sobres", gen: "bolsa", campos: C.caja, inicio: { largo: 160, ancho: 80, alto: 220, pestana: 15 } },
  { id: "bolsa-asa", nombre: "Bolsa con asas", grupo: "Bolsas y sobres", gen: "bolsaAsa", campos: C.caja, inicio: { largo: 180, ancho: 80, alto: 230, pestana: 15 }, detalle: "Ojales para listón o cordón" },
  { id: "bolsa-plana", nombre: "Bolsa plana con solapa", grupo: "Bolsas y sobres", gen: "bolsaPlana", campos: ["largo", "alto", "pestana"], inicio: { largo: 120, alto: 180, pestana: 12 } },
  { id: "sobre", nombre: "Sobre clásico", grupo: "Bolsas y sobres", gen: "sobre", campos: ["largo", "ancho"], inicio: { largo: 150, ancho: 100 } },
  { id: "sobre-puntas", nombre: "Sobre de cuatro puntas", grupo: "Bolsas y sobres", gen: "sobrePuntas", campos: ["largo", "ancho"], inicio: { largo: 140, ancho: 100 }, detalle: "Para invitaciones" },
  { id: "funda", nombre: "Funda abierta", grupo: "Bolsas y sobres", gen: "sobreBolsillo", campos: ["largo", "ancho", "pestana"], inicio: { largo: 110, ancho: 160, pestana: 12 }, detalle: "Bolsillo abierto por arriba" },
  { id: "funda-cd", nombre: "Sobre para CD / DVD", grupo: "Bolsas y sobres", gen: "sobreBolsillo", campos: ["largo", "ancho", "pestana"], inicio: { largo: 125, ancho: 125, pestana: 12 } },
  { id: "funda-tarjetas", nombre: "Funda para tarjetas", grupo: "Bolsas y sobres", gen: "sobreBolsillo", campos: ["largo", "ancho", "pestana"], inicio: { largo: 90, ancho: 58, pestana: 10 }, detalle: "Tarjetas de presentación o regalo" },
  // Formas
  { id: "piramide", nombre: "Pirámide", grupo: "Formas", gen: "piramide", campos: ["lados", "ancho", "alto", "pestana"], inicio: { lados: 4, ancho: 60, alto: 80, pestana: 10 } },
  { id: "tetra", nombre: "Pirámide de regalo", grupo: "Formas", gen: "tetra", campos: ["ancho", "alto"], inicio: { ancho: 70, alto: 90 }, detalle: "Se cierra con listón" },
  { id: "cono", nombre: "Cono", grupo: "Formas", gen: "cono", campos: ["ancho", "diametroSup", "alto", "pestana", "conBase"], inicio: { ancho: 60, diametroSup: 0, alto: 100, pestana: 10 } },
  { id: "cono-flores", nombre: "Cono para flores o dulces", grupo: "Formas", gen: "cono", campos: ["ancho", "diametroSup", "alto", "pestana", "conBase"], inicio: { ancho: 90, diametroSup: 0, alto: 180, pestana: 10 } },
  { id: "vaso", nombre: "Vaso / cubeta", grupo: "Formas", gen: "cono", campos: ["ancho", "diametroSup", "alto", "pestana", "conBase"], inicio: { ancho: 80, diametroSup: 60, alto: 90, pestana: 10, conBase: true }, detalle: "Cono truncado con base; la base es el lado ancho" },
  { id: "maceta", nombre: "Maceta de N lados", grupo: "Formas", gen: "maceta", campos: ["lados", "ancho", "diametroSup", "alto", "pestana"], inicio: { lados: 4, ancho: 60, diametroSup: 85, alto: 80, pestana: 12 }, detalle: "Pirámide truncada, abierta arriba" },
  // Tarjetas e insertos
  { id: "tarjeta", nombre: "Tarjeta doblada", grupo: "Tarjetas e insertos", gen: "tarjeta", campos: ["largo", "ancho"], inicio: { largo: 105, ancho: 148 }, detalle: "Doblez vertical al centro" },
  { id: "inserto", nombre: "Inserto con huecos", grupo: "Tarjetas e insertos", gen: "inserto", campos: ["largo", "ancho", "columnas", "filas", "diametro"], inicio: { largo: 250, ancho: 170, columnas: 3, filas: 2, diametro: 55 }, detalle: "Para cupcakes, velas o frascos" },
  { id: "inserto-12", nombre: "Inserto 12 cupcakes mini", grupo: "Tarjetas e insertos", gen: "inserto", campos: ["largo", "ancho", "columnas", "filas", "diametro"], inicio: { largo: 250, ancho: 190, columnas: 4, filas: 3, diametro: 42 } },
]

export const GRUPOS: Grupo[] = ["Cajas", "Bolsas y sobres", "Formas", "Tarjetas e insertos"]

const ETIQUETA_BASE: Partial<Record<keyof Datos, string>> = {
  largo: "Largo", ancho: "Ancho", alto: "Alto", pestana: "Pestaña de pegado", lados: "Lados de la base",
  diametroSup: "Diámetro de arriba (0 = punta)", conBase: "Con base", altoTapa: "Alto de la tapa", holgura: "Holgura",
  margen: "Marco de la ventana", filas: "Filas", columnas: "Columnas", diametro: "Diámetro de los huecos",
}

const ETIQUETAS_GEN: Partial<Record<Gen, Partial<Record<keyof Datos, string>>>> = {
  piramide: { ancho: "Lado de la base", alto: "Altura" },
  cono: { ancho: "Diámetro de la base", alto: "Altura" },
  sobre: { largo: "Ancho de la tarjeta", ancho: "Alto de la tarjeta" },
  sobrePuntas: { largo: "Ancho de la tarjeta", ancho: "Alto de la tarjeta" },
  sobreBolsillo: { largo: "Ancho del contenido", ancho: "Alto del contenido" },
  bolsa: { ancho: "Fuelle (fondo)" },
  bolsaAsa: { ancho: "Fuelle (fondo)" },
  hexagonal: { ancho: "Lado del hexágono" },
  prisma: { ancho: "Lado del polígono", lados: "Número de lados" },
  cilindro: { ancho: "Diámetro", alto: "Largo del tubo" },
  tetra: { ancho: "Lado de la base", alto: "Altura" },
  maceta: { ancho: "Lado de abajo", diametroSup: "Lado de arriba", alto: "Altura", lados: "Número de lados" },
  tarjeta: { largo: "Ancho cerrada", ancho: "Alto" },
  pillow: { largo: "Largo", ancho: "Ancho" },
  cajaVentana: { margen: "Marco alrededor de la ventana" },
  envio: { largo: "Largo (por dentro)", ancho: "Fondo (por dentro)", alto: "Alto (por dentro)" },
  exhibidor: { largo: "Ancho del frente", ancho: "Fondo", alto: "Alto del respaldo", altoTapa: "Alto del frente" },
  rebanada: { largo: "Largo de la rebanada (radio)", lados: "Rebanadas por pastel" },
  explosiva: { largo: "Lado de la base", alto: "Alto de las paredes" },
  redonda: { largo: "Diámetro (o largo)", ancho: "Ancho", alto: "Alto de la pared" },
  corazon: { alto: "Alto de la pared" },
  estrella: { alto: "Alto de la pared" },
}

// Etiqueta de cada campo según la plantilla
export const ETIQUETAS: Record<string, Partial<Record<keyof Datos, string>>> = Object.fromEntries(
  FORMAS.map((f) => [f.id, { ...ETIQUETA_BASE, ...(ETIQUETAS_GEN[f.gen] || {}) }])
)

export const formaPorId = (id: string) => FORMAS.find((f) => f.id === id)

const GENERADORES: Record<Gen, (d: Datos) => Resultado> = {
  caja: cajaSolapas, piramide, cono, sobre, bolsa, hexagonal,
  bandeja, tapaFondo, pillow, bolsaAsa, bolsaPlana, prisma, cilindro,
  tetra, maceta, sobreBolsillo, sobrePuntas, tarjeta, cajaVentana, cajon, bisagra, inserto,
  envio, leche, exhibidor, cartas, rebanada, explosiva,
  redonda, corazon, estrella,
}

export function generarEmpaque(forma: Forma, d: Datos): Resultado {
  const def = formaPorId(forma)
  if (!def) return { piezas: [], errores: ["Plantilla desconocida."], avisos: [] }
  for (const c of def.campos) {
    if (c === "conBase" || c === "diametroSup" || c === "holgura") continue
    const v = d[c] as number
    if (!Number.isFinite(v) || v <= 0) return { piezas: [], errores: ["Todas las medidas deben ser mayores que cero."], avisos: [] }
    if (!["lados", "filas", "columnas"].includes(c) && v < 5) return { piezas: [], errores: ["Cada medida debe ser de al menos 5 mm."], avisos: [] }
  }
  if (def.gen === "cono" && !(d.diametroSup >= 0)) return { piezas: [], errores: ["El diámetro de arriba debe ser 0 o mayor."], avisos: [] }
  if (!(d.holgura >= 0)) d = { ...d, holgura: 0 }
  // caja redonda: sólo se pide el diámetro
  if (def.gen === "redonda" && !def.campos.includes("ancho")) d = { ...d, ancho: d.largo }
  return GENERADORES[def.gen](d)
}

// ---------- Acomodo y exportación ----------

function caja(pl: Plantilla) {
  const todos = [...pl.cortes.flat(), ...pl.pliegues.flat()]
  const xs = todos.map((p) => p[0])
  const ys = todos.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

// coloca las piezas en una fila; devuelve el desplazamiento de cada una
export function acomodarPlantillas(piezas: Plantilla[], sep = 8) {
  let x = 0
  let alto = 0
  const pos = piezas.map((p) => {
    const b = caja(p)
    const dx = x - b.x0
    const dy = -b.y0
    x += b.x1 - b.x0 + sep
    alto = Math.max(alto, b.y1 - b.y0)
    return { dx, dy, ancho: b.x1 - b.x0, alto: b.y1 - b.y0 }
  })
  return { pos, ancho: Math.max(0, x - sep), alto }
}

const f = (x: number) => String(r3(x))

// Cómo salen las líneas de doblez en el archivo:
//  - marcar: línea continua en la capa DOBLEZ (marcador del plotter o láser a baja potencia)
//  - perforado: cortes cortos separados por puentes, en la capa PERFORADO. Es lo
//    que se usa en cartón: la máquina corta "por distancias" y el cartón dobla
//    limpio por la línea sin separarse.
//  - ninguno: sin líneas de doblez.
export type ModoDoblez = "marcar" | "perforado" | "ninguno"
export type OpcionesDoblez = { modo: ModoDoblez; corte: number; puente: number }
export const DOBLEZ_MARCAR: OpcionesDoblez = { modo: "marcar", corte: 6, puente: 3 }

// Parte una polilínea en tramos de corte separados por puentes. Siempre deja
// un puente completo (o más) en cada punta: si un corte tocara el contorno, la
// solapa se desprendería. El sobrante se reparte igual en las dos puntas.
export function perforar(pts: P[], corte: number, puente: number): P[][] {
  if (pts.length < 2 || !(corte > 0) || !(puente >= 0)) return []
  const acum = [0]
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const L = acum[acum.length - 1]
  const n = Math.floor((L - puente) / (corte + puente) + 1e-9)
  if (n < 1) return []
  const inicio = puente + (L - n * corte - (n + 1) * puente) / 2
  const punto = (s: number): P => {
    let i = 1
    while (i < acum.length - 1 && acum[i] < s) i++
    const t = (s - acum[i - 1]) / (acum[i] - acum[i - 1] || 1)
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
  }
  const tramos: P[][] = []
  for (let k = 0; k < n; k++) {
    const a = inicio + k * (corte + puente)
    const b = a + corte
    const tramo: P[] = [punto(a)]
    for (let i = 1; i < acum.length - 1; i++) if (acum[i] > a && acum[i] < b) tramo.push(pts[i])
    tramo.push(punto(b))
    tramos.push(tramo)
  }
  return tramos
}

// Los dobleces curvos (caja almohada) vienen en muchos segmentos cortos. Se
// juntan en una sola polilínea cuando un segmento sigue al anterior con un
// giro suave; si no, cada segmento sería más corto que un corte y quedaría sin
// perforar. Nunca se juntan en un punto que toca una línea de corte: ahí un
// tramo de perforado cruzaría el contorno y la solapa se desprendería.
const distSeg = (q: P, a: P, b: P) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy)
}
const tocaCorte = (q: P, cortes: P[][]) =>
  cortes.some((c) => c.some((a, i) => distSeg(q, a, c[(i + 1) % c.length]) < 0.05))

export function cadenasDoblez(pliegues: [P, P][], cortes: P[][] = []): P[][] {
  const cadenas: P[][] = []
  for (const [a, b] of pliegues) {
    const c = cadenas[cadenas.length - 1]
    if (c) {
      const u = c[c.length - 1]
      const v = c[c.length - 2]
      const giro = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.atan2(u[1] - v[1], u[0] - v[0]))
      const g = Math.min(giro, 2 * Math.PI - giro)
      if (Math.hypot(a[0] - u[0], a[1] - u[1]) < 0.01 && g > 0.005 && g < 0.6 && !tocaCorte(u, cortes)) {
        c.push(b)
        continue
      }
    }
    cadenas.push([a, b])
  }
  return cadenas
}

// Parte un doblez en cada punto donde lo toca un corte (las muescas en V de
// las pestañas de un tubo llegan hasta la línea de doblez). Cada tramo
// resultante lleva su propio puente en las puntas.
export function partirEnCortes(c: P[], cortes: P[][]): P[][] {
  const acum = [0]
  for (let i = 1; i < c.length; i++) acum.push(acum[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]))
  const L = acum[acum.length - 1]
  const marcas: number[] = []
  for (const cc of cortes)
    for (const q of cc)
      for (let i = 1; i < c.length; i++) {
        const [a, b] = [c[i - 1], c[i]]
        if (distSeg(q, a, b) < 0.05) {
          const s = acum[i - 1] + Math.hypot(q[0] - a[0], q[1] - a[1])
          if (s > 0.05 && s < L - 0.05) marcas.push(s)
          break
        }
      }
  if (!marcas.length) return [c]
  marcas.sort((x, y) => x - y)
  const punto = (s: number): P => {
    let i = 1
    while (i < acum.length - 1 && acum[i] < s) i++
    const t = (s - acum[i - 1]) / (acum[i] - acum[i - 1] || 1)
    return [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]
  }
  const salida: P[][] = []
  const lim = [0, ...marcas, L]
  for (let k = 1; k < lim.length; k++) {
    const [a, b] = [lim[k - 1], lim[k]]
    if (b - a < 0.05) continue
    const tramo: P[] = [punto(a)]
    for (let i = 1; i < c.length - 1; i++) if (acum[i] > a && acum[i] < b) tramo.push(c[i])
    tramo.push(punto(b))
    salida.push(tramo)
  }
  return salida
}

// Dobleces tan cortos que no les cabe ni un tramo de corte con sus puentes
export const doblecesSinPerforar = (piezas: Plantilla[], d: OpcionesDoblez) =>
  d.modo !== "perforado"
    ? 0
    : piezas.reduce((n, p) => n + cadenasDoblez(p.pliegues, p.cortes).flatMap((c) => partirEnCortes(c, p.cortes)).filter((c) => !perforar(c, d.corte, d.puente).length).length, 0)

const perforaciones = (p: Plantilla, d: OpcionesDoblez) =>
  cadenasDoblez(p.pliegues, p.cortes).flatMap((c) => partirEnCortes(c, p.cortes)).flatMap((c) => perforar(c, d.corte, d.puente))

// ---------- Hojas ----------
// Una hoja es un tamaño de papel o de material con las piezas ya colocadas
// (coordenadas en mm, origen abajo a la izquierda de la hoja).
export type Hoja = { ancho: number; alto: number; piezas: Plantilla[] }
export type TamanoHoja = { id: string; nombre: string; ancho: number; alto: number; grupo: string }

// Tamaños comunes de impresora, plotter de corte, láser y material (vertical: ancho ≤ alto)
export const TAMANOS_HOJA: TamanoHoja[] = [
  { id: "carta", nombre: "Carta", ancho: 215.9, alto: 279.4, grupo: "Impresora" },
  { id: "oficio", nombre: "Oficio", ancho: 215.9, alto: 340, grupo: "Impresora" },
  { id: "a4", nombre: "A4", ancho: 210, alto: 297, grupo: "Impresora" },
  { id: "a3", nombre: "A3", ancho: 297, alto: 420, grupo: "Impresora" },
  { id: "tabloide", nombre: "Tabloide", ancho: 279.4, alto: 431.8, grupo: "Impresora" },
  { id: "p12x12", nombre: "Plotter 12×12 in", ancho: 304.8, alto: 304.8, grupo: "Plotter de corte" },
  { id: "p12x24", nombre: "Plotter 12×24 in", ancho: 304.8, alto: 609.6, grupo: "Plotter de corte" },
  { id: "glowforge", nombre: "Glowforge", ancho: 279, alto: 495, grupo: "Láser" },
  { id: "l600", nombre: "Láser 400×600", ancho: 400, alto: 600, grupo: "Láser" },
  { id: "l900", nombre: "Láser 600×900", ancho: 600, alto: 900, grupo: "Láser" },
  { id: "l1300", nombre: "Láser 900×1300", ancho: 900, alto: 1300, grupo: "Láser" },
  { id: "carton", nombre: "Cartón 1200×2400", ancho: 1200, alto: 2400, grupo: "Material" },
  { id: "mdf", nombre: "Tablero 1220×2440", ancho: 1220, alto: 2440, grupo: "Material" },
]

const mover = (pl: Plantilla, t: (q: P) => P): Plantilla => ({
  nombre: pl.nombre,
  cortes: pl.cortes.map((c) => c.map(t)),
  pliegues: pl.pliegues.map(([a, b]) => [t(a), t(b)] as [P, P]),
})

// Todas las piezas en una fila, en una hoja del tamaño justo del dibujo
export function hojaAjustada(piezas: Plantilla[], margen = 3): Hoja {
  const { pos, ancho, alto } = acomodarPlantillas(piezas)
  return {
    ancho: ancho + 2 * margen,
    alto: alto + 2 * margen,
    piezas: piezas.map((p, i) => mover(p, ([x, y]) => [x + pos[i].dx + margen, y + pos[i].dy + margen])),
  }
}

// Acomoda las piezas en hojas de un tamaño fijo, por renglones. Gira una pieza
// 90° si así cabe. Las que no caben ni giradas se reportan en noCaben.
export function acomodarEnHojas(piezas: Plantilla[], ancho: number, alto: number, margen = 5, sep = 8) {
  const uw = ancho - 2 * margen
  const uh = alto - 2 * margen
  const hojas: Hoja[] = []
  const noCaben: string[] = []
  type Estado = { hoja: Hoja; x: number; y: number; renglon: number }
  let actual: Estado | null = null
  const nueva = (): Estado => {
    const h: Hoja = { ancho, alto, piezas: [] }
    hojas.push(h)
    return { hoja: h, x: 0, y: 0, renglon: 0 }
  }
  const orden = piezas.map((p, i) => ({ p, i, b: caja(p) })).sort((a, b) => (b.b.y1 - b.b.y0) - (a.b.y1 - a.b.y0) || a.i - b.i)
  for (const { p } of orden) {
    const opciones = [p, mover(p, ([x, y]) => [-y, x])]
      .map((q) => ({ q, b: caja(q) }))
      .filter(({ b }) => b.x1 - b.x0 <= uw + 1e-6 && b.y1 - b.y0 <= uh + 1e-6)
    if (!opciones.length) {
      const b = caja(p)
      noCaben.push(`${p.nombre} (${r3(b.x1 - b.x0)} × ${r3(b.y1 - b.y0)} mm)`)
      continue
    }
    const intentar = (e: Estado) => {
      for (const { q, b } of opciones) {
        const w = b.x1 - b.x0
        const h = b.y1 - b.y0
        let { x, y, renglon } = e
        if (x > 0 && x + w > uw + 1e-6) {
          y += renglon + sep
          x = 0
          renglon = 0
        }
        if (x + w <= uw + 1e-6 && y + h <= uh + 1e-6) {
          e.hoja.piezas.push(mover(q, ([px, py]) => [px - b.x0 + margen + x, py - b.y0 + margen + y]))
          e.x = x + w + sep
          e.y = y
          e.renglon = Math.max(renglon, h)
          return true
        }
      }
      return false
    }
    if (!actual || !intentar(actual)) {
      actual = nueva()
      intentar(actual)
    }
  }
  return { hojas, noCaben }
}

// Qué tanto de la hoja usan las piezas (área de los contornos exteriores)
export function aprovechamiento(h: Hoja) {
  let a = 0
  for (const p of h.piezas) {
    const c = p.cortes[0]
    if (!c) continue
    let s = 0
    for (let i = 0, j = c.length - 1; i < c.length; i = i + 1) {
      s += (c[j][0] + c[i][0]) * (c[j][1] - c[i][1])
      j = i
    }
    a += Math.abs(s / 2)
  }
  return a / (h.ancho * h.alto)
}

// Elementos SVG de una hoja. modo "vista": para la pantalla · "corte": para la
// máquina (sin estilos de línea punteada: Cricut, LightBurn y casi todos los
// programas los ignoran y cortarían la línea completa) · "imprimir": papel,
// doblez punteado. ox/oy: dónde va la hoja dentro del SVG (Y hacia abajo).
function elementosHoja(h: Hoja, modo: "corte" | "vista" | "imprimir", dob: OpcionesDoblez, ox = 0, oy = 0) {
  const vista = modo === "vista"
  const X = (x: number) => f(ox + x)
  const Y = (y: number) => f(oy + h.alto - y)
  const corte = vista
    ? `fill="#FDEEE1" fill-opacity="0.55" stroke="#C2560A" stroke-width="1.4" vector-effect="non-scaling-stroke"`
    : modo === "imprimir"
      ? `fill="none" stroke="#000000" stroke-width="0.3"`
      : `fill="none" stroke="#FF0000" stroke-width="0.1"`
  const doblez = vista
    ? `stroke="#1F5FBF" stroke-width="1.1" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"`
    : modo === "imprimir"
      ? `stroke="#0000FF" stroke-width="0.3" stroke-dasharray="3 2"`
      : `stroke="#0000FF" stroke-width="0.1"`
  const perforado = vista
    ? `fill="none" stroke="#B0127A" stroke-width="1.4" stroke-linecap="butt" vector-effect="non-scaling-stroke"`
    : `fill="none" stroke="#FF00FF" stroke-width="${modo === "imprimir" ? 0.3 : 0.1}"`
  const capas = { corte: [] as string[], doblez: [] as string[], perforado: [] as string[] }
  for (const p of h.piezas) {
    for (const pts of p.cortes) capas.corte.push(`<path d="${pts.map(([x, y], j) => `${j ? "L" : "M"}${X(x)} ${Y(y)}`).join(" ")} Z" ${corte}/>`)
    if (dob.modo === "marcar")
      for (const [a, b] of p.pliegues) capas.doblez.push(`<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" ${doblez}/>`)
    if (dob.modo === "perforado") {
      const d = perforaciones(p, dob).map((t) => t.map(([x, y], j) => `${j ? "L" : "M"}${X(x)} ${Y(y)}`).join(" ")).join(" ")
      if (d) capas.perforado.push(`<path d="${d}" ${perforado}/>`)
    }
  }
  return capas
}

const grupoSVG = (id: string, l: string[]) => (l.length ? `<g id="${id}">\n${l.join("\n")}\n</g>\n` : "")

// SVG de una hoja, al tamaño real en mm
export function hojaSVG(h: Hoja, modo: "corte" | "vista" | "imprimir" = "corte", dob: OpcionesDoblez = DOBLEZ_MARCAR) {
  const c = elementosHoja(h, modo, dob)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(h.ancho)}mm" height="${f(h.alto)}mm" viewBox="0 0 ${f(h.ancho)} ${f(h.alto)}">\n${grupoSVG("CORTE", c.corte)}${grupoSVG("DOBLEZ", c.doblez)}${grupoSVG("PERFORADO", c.perforado)}</svg>\n`
}

// Vista de pantalla de varias hojas, una junto a otra, con el borde de cada hoja
export function hojasVistaSVG(hojas: Hoja[], dob: OpcionesDoblez = DOBLEZ_MARCAR, conBorde = true) {
  const gap = hojas.length > 1 ? Math.max(...hojas.map((h) => h.ancho)) * 0.06 : 0
  const H = Math.max(...hojas.map((h) => h.alto))
  let ox = 0
  const partes: string[] = []
  for (const h of hojas) {
    if (conBorde) partes.push(`<rect x="${f(ox)}" y="0" width="${f(h.ancho)}" height="${f(h.alto)}" fill="#FFFFFF" fill-opacity="0.06" stroke="#8A97AB" stroke-width="1" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`)
    const c = elementosHoja(h, "vista", dob, ox, 0)
    partes.push(...c.corte, ...c.doblez, ...c.perforado)
    ox += h.ancho + gap
  }
  const W = ox - gap
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}">\n${partes.join("\n")}\n</svg>\n`
}

// ---------- Impresión en mosaico ----------
// Parte una hoja grande en páginas de impresora que se unen con cinta o
// pegamento. Cada página imprime su parte dentro del área segura (margen) y
// se encima con la vecina "traslape" mm:
//  - Línea continua gris en el borde derecho/inferior del área: ahí llega la
//    página de al lado.
//  - Línea punteada a "traslape" mm del borde izquierdo/superior: se recorta
//    por ahí y ese borde se alinea con la línea continua de la página anterior.
// Las páginas se nombran por fila (A, B…) y columna (1, 2…).
export function paginasMosaico(
  h: Hoja,
  papelAncho: number,
  papelAlto: number,
  dob: OpcionesDoblez = DOBLEZ_MARCAR,
  margen = 10,
  traslape = 10,
) {
  const aw = papelAncho - 2 * margen
  const ah = papelAlto - 2 * margen
  const sx = aw - traslape
  const sy = ah - traslape
  const cols = Math.max(1, Math.ceil((h.ancho - traslape) / sx - 1e-9))
  const filas = Math.max(1, Math.ceil((h.alto - traslape) / sy - 1e-9))
  const fila = (r: number) => String.fromCharCode(65 + (r % 26))
  const nombre = (r: number, c: number) => `${fila(r)}${c + 1}`
  const texto = (x: number, y: number, t: string, tam = 3, ancla = "start") =>
    `<text x="${f(x)}" y="${f(y)}" font-family="Arial, sans-serif" font-size="${tam}" fill="#555" text-anchor="${ancla}">${t}</text>`
  const guia = `stroke="#888" stroke-width="0.25" fill="none"`
  const paginas: { nombre: string; svg: string }[] = []
  for (let r = 0; r < filas; r++)
    for (let c = 0; c < cols; c++) {
      const id = `m${r}_${c}`
      const capas = elementosHoja(h, "imprimir", dob, margen - c * sx, margen - r * sy)
      const partes: string[] = [
        `<defs><clipPath id="${id}"><rect x="${f(margen)}" y="${f(margen)}" width="${f(aw)}" height="${f(ah)}"/></clipPath></defs>`,
        `<g clip-path="url(#${id})">${capas.corte.join("")}${capas.doblez.join("")}${capas.perforado.join("")}</g>`,
      ]
      // bordes donde llega la página vecina (derecha y abajo)
      if (c < cols - 1) partes.push(`<line x1="${f(margen + aw)}" y1="${f(margen)}" x2="${f(margen + aw)}" y2="${f(margen + ah)}" ${guia}/>`)
      if (r < filas - 1) partes.push(`<line x1="${f(margen)}" y1="${f(margen + ah)}" x2="${f(margen + aw)}" y2="${f(margen + ah)}" ${guia}/>`)
      // líneas de recorte (izquierda y arriba)
      if (c > 0) partes.push(`<line x1="${f(margen + traslape)}" y1="${f(margen)}" x2="${f(margen + traslape)}" y2="${f(margen + ah)}" ${guia} stroke-dasharray="2 1.5"/>`, texto(margen + traslape + 1.5, margen + ah / 2, `✂ recorta y encima sobre ${nombre(r, c - 1)}`, 2.8))
      if (r > 0) partes.push(`<line x1="${f(margen)}" y1="${f(margen + traslape)}" x2="${f(margen + aw)}" y2="${f(margen + traslape)}" ${guia} stroke-dasharray="2 1.5"/>`, texto(margen + aw / 2, margen + traslape - 1.5, `✂ recorta y encima sobre ${nombre(r - 1, c)}`, 2.8, "middle"))
      // etiqueta y escala de comprobación
      partes.push(texto(margen, margen - 3, `Página ${nombre(r, c)} · fila ${fila(r)}, columna ${c + 1} · ${filas * cols} páginas (${filas} × ${cols})`, 3.2))
      if (r === 0 && c === 0)
        partes.push(
          `<line x1="${f(papelAncho - margen - 50)}" y1="${f(papelAlto - margen / 2)}" x2="${f(papelAncho - margen)}" y2="${f(papelAlto - margen / 2)}" stroke="#000" stroke-width="0.4"/>`,
          texto(papelAncho - margen - 52, papelAlto - margen / 2 + 1, "Esta línea debe medir 50 mm", 2.8, "end"),
        )
      paginas.push({
        nombre: nombre(r, c),
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${f(papelAncho)}mm" height="${f(papelAlto)}mm" viewBox="0 0 ${f(papelAncho)} ${f(papelAlto)}">\n${partes.join("\n")}\n</svg>\n`,
      })
    }
  // Mapa: el dibujo completo con la cuadrícula de páginas, en una sola hoja
  const esc = Math.min(aw / h.ancho, (ah - 20) / h.alto, 1)
  const cuerpo = elementosHoja(h, "imprimir", dob, 0, 0)
  const celdas: string[] = []
  for (let r = 0; r < filas; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * sx
      const y = r * sy
      const w = Math.min(aw, h.ancho - x)
      const hh = Math.min(ah, h.alto - y)
      celdas.push(
        `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(hh)}" fill="none" stroke="#C2560A" stroke-width="${f(0.5 / esc)}"/>`,
        `<text x="${f(x + w / 2)}" y="${f(y + hh / 2)}" font-family="Arial, sans-serif" font-size="${f(Math.min(w, hh, sx, sy) / 4)}" fill="#C2560A" fill-opacity="0.7" text-anchor="middle" dominant-baseline="middle">${nombre(r, c)}</text>`,
      )
    }
  const mapa =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(papelAncho)}mm" height="${f(papelAlto)}mm" viewBox="0 0 ${f(papelAncho)} ${f(papelAlto)}">\n` +
    texto(margen, margen + 4, `Mapa de armado: ${filas * cols === 1 ? "1 página" : `${filas * cols} páginas`} (${filas} ${filas === 1 ? "fila" : "filas"} × ${cols} ${cols === 1 ? "columna" : "columnas"})`, 4.5) +
    texto(margen, margen + 10, `Imprime todo al 100%, recorta por la línea punteada de cada página y encímala sobre la anterior. Traslape: ${f(traslape)} mm.`, 2.8) +
    `<g transform="translate(${f(margen)} ${f(margen + 16)}) scale(${f(esc)})">${cuerpo.corte.join("")}${cuerpo.doblez.join("")}${cuerpo.perforado.join("")}${celdas.join("")}</g>\n</svg>\n`
  return { filas, cols, paginas, mapa }
}

// SVG de todas las piezas en una fila (hoja ajustada al dibujo)
export function plantillaSVG(piezas: Plantilla[], modo: "corte" | "vista" | "imprimir" = "corte", dob: OpcionesDoblez = DOBLEZ_MARCAR) {
  return hojaSVG(hojaAjustada(piezas), modo, dob)
}

// DXF R12: capa CORTE (rojo, polilíneas cerradas), DOBLEZ (azul, líneas para
// marcar) y PERFORADO (magenta, tramos de corte con puentes)
export function hojaDXF(h: Hoja, dob: OpcionesDoblez = DOBLEZ_MARCAR) {
  const l: string[] = []
  const par = (c: number | string, v: number | string) => l.push(String(c), String(v))
  par(0, "SECTION"); par(2, "HEADER"); par(9, "$ACADVER"); par(1, "AC1009"); par(9, "$INSUNITS"); par(70, 4); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "TABLES"); par(0, "TABLE"); par(2, "LAYER"); par(70, 3)
  for (const [nombre, color] of [["CORTE", 1], ["DOBLEZ", 5], ["PERFORADO", 6]] as const) {
    par(0, "LAYER"); par(2, nombre); par(70, 0); par(62, color); par(6, "CONTINUOUS")
  }
  par(0, "ENDTAB"); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  const linea = (capa: string, a: P, b: P) => {
    par(0, "LINE"); par(8, capa)
    par(10, f(a[0])); par(20, f(a[1])); par(30, 0)
    par(11, f(b[0])); par(21, f(b[1])); par(31, 0)
  }
  for (const p of h.piezas) {
    for (const pts of p.cortes) {
      par(0, "POLYLINE"); par(8, "CORTE"); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, 1)
      for (const [x, y] of pts) { par(0, "VERTEX"); par(8, "CORTE"); par(10, f(x)); par(20, f(y)); par(30, 0) }
      par(0, "SEQEND"); par(8, "CORTE")
    }
    if (dob.modo === "marcar") for (const [a, b] of p.pliegues) linea("DOBLEZ", a, b)
    if (dob.modo === "perforado")
      for (const t of perforaciones(p, dob)) for (let k = 1; k < t.length; k++) linea("PERFORADO", t[k - 1], t[k])
  }
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}

// DXF de todas las piezas en una fila, desde el origen (como antes)
export function plantillaDXF(piezas: Plantilla[], dob: OpcionesDoblez = DOBLEZ_MARCAR) {
  return hojaDXF(hojaAjustada(piezas, 0), dob)
}
