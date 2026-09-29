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

export type Forma = "caja" | "piramide" | "cono" | "sobre" | "bolsa" | "hexagonal"

export type Datos = {
  largo: number // caja: largo · sobre: ancho del contenido · bolsa: ancho
  ancho: number // caja: ancho · sobre: alto del contenido · bolsa: fuelle · pirámide/hexagonal: lado · cono: diámetro base
  alto: number // altura (caja, pirámide, cono, bolsa, hexagonal)
  pestana: number // pestaña de pegado
  lados: number // pirámide: lados de la base (3 a 8)
  diametroSup: number // cono: diámetro superior (0 = punta)
  conBase: boolean // cono: agrega pestañas y tapa redonda
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

export const FORMAS: { id: Forma; nombre: string; campos: (keyof Datos)[] }[] = [
  { id: "caja", nombre: "Caja con solapas", campos: ["largo", "ancho", "alto", "pestana"] },
  { id: "piramide", nombre: "Pirámide", campos: ["lados", "ancho", "alto", "pestana"] },
  { id: "cono", nombre: "Cono", campos: ["ancho", "diametroSup", "alto", "pestana", "conBase"] },
  { id: "sobre", nombre: "Sobre", campos: ["largo", "ancho"] },
  { id: "bolsa", nombre: "Bolsa", campos: ["largo", "ancho", "alto", "pestana"] },
  { id: "hexagonal", nombre: "Caja hexagonal", campos: ["ancho", "alto", "pestana"] },
]

export const ETIQUETAS: Record<Forma, Partial<Record<keyof Datos, string>>> = {
  caja: { largo: "Largo", ancho: "Ancho", alto: "Alto", pestana: "Pestaña de pegado" },
  piramide: { lados: "Lados de la base", ancho: "Lado de la base", alto: "Altura", pestana: "Pestaña de pegado" },
  cono: { ancho: "Diámetro de la base", diametroSup: "Diámetro de arriba (0 = punta)", alto: "Altura", pestana: "Pestaña de pegado", conBase: "Con base" },
  sobre: { largo: "Ancho de la tarjeta", ancho: "Alto de la tarjeta" },
  bolsa: { largo: "Ancho", ancho: "Fuelle (fondo)", alto: "Alto", pestana: "Pestaña de pegado" },
  hexagonal: { ancho: "Lado del hexágono", alto: "Alto", pestana: "Pestaña de pegado" },
}

export function generarEmpaque(forma: Forma, d: Datos): Resultado {
  const campos = FORMAS.find((f) => f.id === forma)?.campos || []
  for (const c of campos) {
    if (c === "conBase" || c === "diametroSup") continue
    const v = d[c] as number
    if (!Number.isFinite(v) || v <= 0) return { piezas: [], errores: ["Todas las medidas deben ser mayores que cero."], avisos: [] }
    if (c !== "lados" && v < 5) return { piezas: [], errores: ["Cada medida debe ser de al menos 5 mm."], avisos: [] }
  }
  if (forma === "cono" && !(d.diametroSup >= 0)) return { piezas: [], errores: ["El diámetro de arriba debe ser 0 o mayor."], avisos: [] }
  if (forma === "caja") return cajaSolapas(d)
  if (forma === "hexagonal") return hexagonal(d)
  if (forma === "bolsa") return bolsa(d)
  if (forma === "sobre") return sobre(d)
  if (forma === "piramide") return piramide(d)
  return cono(d)
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
