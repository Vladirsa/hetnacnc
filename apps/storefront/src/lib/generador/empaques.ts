// Plantillas de empaque (troqueles) para imprimir, cortar con plotter o láser.
// Todo en milímetros, calculado en el navegador.
//  - Líneas de CORTE: contornos cerrados.
//  - Líneas de DOBLEZ: segmentos sueltos (marcar o grabar a baja potencia).

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

export function plantillaSVG(piezas: Plantilla[], modo: "corte" | "vista" = "corte") {
  const { pos, ancho, alto } = acomodarPlantillas(piezas)
  const m = 3
  const W = ancho + 2 * m
  const H = alto + 2 * m
  const vista = modo === "vista"
  const X = (x: number, i: number) => f(m + x + pos[i].dx)
  const Y = (y: number, i: number) => f(H - m - (y + pos[i].dy)) // Y hacia abajo
  const corte = vista
    ? `fill="#FDEEE1" fill-opacity="0.55" stroke="#C2560A" stroke-width="1.4" vector-effect="non-scaling-stroke"`
    : `fill="none" stroke="#FF0000" stroke-width="0.1"`
  const doblez = vista
    ? `stroke="#1F5FBF" stroke-width="1.1" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"`
    : `stroke="#0000FF" stroke-width="0.1" stroke-dasharray="3 2"`
  const cuerpo = piezas
    .map((p, i) => {
      const c = p.cortes
        .map((pts) => `<path d="${pts.map(([x, y], j) => `${j ? "L" : "M"}${X(x, i)} ${Y(y, i)}`).join(" ")} Z" ${corte}/>`)
        .join("")
      const d = p.pliegues.map(([a, b]) => `<line x1="${X(a[0], i)}" y1="${Y(a[1], i)}" x2="${X(b[0], i)}" y2="${Y(b[1], i)}" ${doblez}/>`).join("")
      return c + d
    })
    .join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">\n${cuerpo}\n</svg>\n`
}

// DXF R12: capa CORTE (rojo) con polilíneas cerradas y capa DOBLEZ (azul) con líneas
export function plantillaDXF(piezas: Plantilla[]) {
  const { pos } = acomodarPlantillas(piezas)
  const l: string[] = []
  const par = (c: number | string, v: number | string) => l.push(String(c), String(v))
  par(0, "SECTION"); par(2, "HEADER"); par(9, "$ACADVER"); par(1, "AC1009"); par(9, "$INSUNITS"); par(70, 4); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "TABLES"); par(0, "TABLE"); par(2, "LAYER"); par(70, 2)
  for (const [nombre, color] of [["CORTE", 1], ["DOBLEZ", 5]] as const) {
    par(0, "LAYER"); par(2, nombre); par(70, 0); par(62, color); par(6, "CONTINUOUS")
  }
  par(0, "ENDTAB"); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  piezas.forEach((p, i) => {
    const { dx, dy } = pos[i]
    for (const pts of p.cortes) {
      par(0, "POLYLINE"); par(8, "CORTE"); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, 1)
      for (const [x, y] of pts) { par(0, "VERTEX"); par(8, "CORTE"); par(10, f(x + dx)); par(20, f(y + dy)); par(30, 0) }
      par(0, "SEQEND"); par(8, "CORTE")
    }
    for (const [a, b] of p.pliegues) {
      par(0, "LINE"); par(8, "DOBLEZ")
      par(10, f(a[0] + dx)); par(20, f(a[1] + dy)); par(30, 0)
      par(11, f(b[0] + dx)); par(21, f(b[1] + dy)); par(31, 0)
    }
  })
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}
