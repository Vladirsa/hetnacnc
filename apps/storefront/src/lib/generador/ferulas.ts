// Férulas termoformables para impresión 3D (HETNA 3D Studio).
//
// Se imprime PLANA (rápido, sin soportes) y después se calienta y se moldea sobre
// la persona o el animal: es la técnica de las férulas ventiladas que se ven en
// clínicas. Aquí sólo se arma la pieza plana a partir de las medidas:
//   - el contorno sale de "desenrollar" el brazo, dedo o pata: el ancho en cada punto
//     es la circunferencia (más la holgura del acolchado) por la parte que cubre
//   - ventilación (hexágonos, círculos u óvalos) dentro de un margen sólido
//   - ranuras para las correas de velcro, con una franja sin huecos alrededor
//   - en antebrazo y muñeca, el hueco del pulgar del lado elegido
// Uso bajo indicación de un profesional de la salud o veterinario: no es tratamiento.
import { extruir } from "./extruir"
import { type Dibujo, type Malla, type P, type Trazo } from "./vectores"

export type TipoFerula = "antebrazo" | "dedo" | "pata"
export type Ventilacion = "hexagonos" | "circulos" | "ovalos" | "ninguna"

export type OpcionesFerula = {
  tipo: TipoFerula
  lado: "derecho" | "izquierdo" // sólo antebrazo (dónde va el hueco del pulgar)
  // Medidas del paciente (mm): circunferencias de inicio a fin y largos de cada tramo
  circunferencias: number[] // antebrazo: [codo-lado, muñeca, palma]; dedo y pata: [base, punta]
  largos: number[] // antebrazo: [antebrazo, mano]; dedo y pata: [largo]
  cobertura: number // parte de la circunferencia que cubre (0.4 a 0.8): abierta para ponerla y quitarla
  holgura: number // mm que se suman a la circunferencia por el acolchado o la venda
  grosor: number // mm (3 es lo común en PLA)
  margen: number // mm de borde sólido
  ventilacion: Ventilacion
  hueco: number // tamaño de cada hueco (mm)
  puente: number // mm entre huecos
  correas: number // cuántas correas
  anchoCorrea: number // mm (velcro de 20 o 25 mm)
}

export const FERULAS: { id: TipoFerula; nombre: string; detalle: string }[] = [
  { id: "antebrazo", nombre: "Antebrazo y muñeca", detalle: "Con hueco para el pulgar" },
  { id: "dedo", nombre: "Dedo", detalle: "Para un dedo de la mano" },
  { id: "pata", nombre: "Pata de perro o gato", detalle: "Tramo recto de la pata" },
]

/** Valores de partida razonables de cada tipo (el profesional los cambia por los del paciente). */
export const MEDIDAS_INICIALES: Record<TipoFerula, { circunferencias: number[]; largos: number[]; cobertura: number; hueco: number; correas: number; anchoCorrea: number; margen: number }> = {
  antebrazo: { circunferencias: [240, 165, 200], largos: [170, 70], cobertura: 0.6, hueco: 16, correas: 3, anchoCorrea: 25, margen: 8 },
  dedo: { circunferencias: [65, 55], largos: [60], cobertura: 0.6, hueco: 6, correas: 2, anchoCorrea: 12, margen: 3.5 },
  pata: { circunferencias: [110, 85], largos: [120], cobertura: 0.55, hueco: 10, correas: 2, anchoCorrea: 20, margen: 5 },
}

export type ResultadoFerula = {
  dibujo: Dibujo
  malla: Malla
  largo: number // mm (largo de la pieza plana)
  ancho: number // mm (lo más ancho)
  huecos: number
  correas: number
  errores: string[]
  avisos: string[]
}

const PASO = 2 // mm entre puntos del contorno

/** Ancho de la pieza plana en la posición y (interpola entre las estaciones de medida). Pura. */
export function anchoEn(y: number, estaciones: [number, number][]): number {
  if (y <= estaciones[0][0]) return estaciones[0][1]
  for (let i = 1; i < estaciones.length; i++) {
    const [y0, w0] = estaciones[i - 1]
    const [y1, w1] = estaciones[i]
    if (y <= y1) {
      const t = (y - y0) / Math.max(1e-6, y1 - y0)
      const s = t * t * (3 - 2 * t) // curva suave: sin quiebre en la muñeca
      return w0 + (w1 - w0) * s
    }
  }
  return estaciones[estaciones.length - 1][1]
}

function validar(o: OpcionesFerula): string[] {
  const e: string[] = []
  const nC = o.tipo === "antebrazo" ? 3 : 2
  const nL = o.tipo === "antebrazo" ? 2 : 1
  if (o.circunferencias.length < nC || o.circunferencias.slice(0, nC).some((c) => !(c > 0))) e.push("Faltan circunferencias.")
  if (o.largos.length < nL || o.largos.slice(0, nL).some((l) => !(l > 0))) e.push("Faltan largos.")
  const maxC = o.tipo === "dedo" ? 150 : 600
  if (o.circunferencias.some((c) => c > maxC)) e.push(`Una circunferencia es muy grande para este tipo (máximo ${maxC} mm).`)
  if (o.tipo === "dedo" && o.circunferencias.some((c) => c > 0 && c < 25)) e.push("Las circunferencias del dedo deben ser de 25 mm o más.")
  if (o.tipo !== "dedo" && o.circunferencias.some((c) => c > 0 && c < 40)) e.push("Las circunferencias deben ser de 40 mm o más.")
  const largo = o.largos.reduce((a, b) => a + b, 0)
  if (largo > 500) e.push("La férula sale de más de 50 cm: revisa los largos.")
  if (largo > 0 && largo < 25) e.push("La férula es muy corta: revisa los largos.")
  if (!(o.cobertura >= 0.3 && o.cobertura <= 0.85)) e.push("La cobertura debe estar entre 30 % y 85 % de la circunferencia.")
  if (!(o.grosor >= 1.5 && o.grosor <= 6)) e.push("El grosor debe estar entre 1.5 y 6 mm.")
  return e
}

export function hacerFerula(o: OpcionesFerula): ResultadoFerula {
  const errores = validar(o)
  const vacio: ResultadoFerula = { dibujo: { trazos: [], avisos: [], unidades: "mm" }, malla: { tris: [], avisos: [] }, largo: 0, ancho: 0, huecos: 0, correas: 0, errores, avisos: [] }
  if (errores.length) return vacio
  const avisos: string[] = []
  const w = (c: number) => (c + o.holgura) * o.cobertura

  // Estaciones (y, ancho) a lo largo de la pieza: y = 0 en el extremo cercano al cuerpo
  const est: [number, number][] =
    o.tipo === "antebrazo"
      ? [[0, w(o.circunferencias[0])], [o.largos[0], w(o.circunferencias[1])], [o.largos[0] + o.largos[1], w(o.circunferencias[2])]]
      : [[0, w(o.circunferencias[0])], [o.largos[0], w(o.circunferencias[1])]]
  const L = est[est.length - 1][0]
  const ancho = Math.max(...est.map((e) => e[1]))
  const R = Math.min(o.tipo === "dedo" ? 6 : 15, L / 4, Math.min(...est.map((e) => e[1])) / 4) // esquinas redondas

  // Hueco del pulgar (antebrazo): media elipse en el borde, empieza poco antes de la muñeca
  const pulgar = o.tipo === "antebrazo" ? { yc: o.largos[0] + Math.min(38, o.largos[1] * 0.45), a: Math.min(26, o.largos[1] * 0.4), b: Math.min(est[1][1] * 0.22, 22) } : null
  const ladoPulgar = o.lado === "derecho" ? 1 : -1 // +1 = borde derecho de la pieza plana
  const muesca = (y: number) => (pulgar && Math.abs(y - pulgar.yc) < pulgar.a ? pulgar.b * Math.sqrt(1 - ((y - pulgar.yc) / pulgar.a) ** 2) : 0)
  const xDer = (y: number) => anchoEn(y, est) / 2 - (ladoPulgar === 1 ? muesca(y) : 0)
  const xIzq = (y: number) => -anchoEn(y, est) / 2 + (ladoPulgar === -1 ? muesca(y) : 0)

  // Contorno (sentido antihorario): borde derecho hacia arriba, arco, borde superior, arco, borde izquierdo hacia abajo…
  const ptsY = (a: number, b: number) => {
    const n = Math.max(2, Math.ceil(Math.abs(b - a) / PASO))
    return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n)
  }
  const arco = (cx: number, cy: number, a0: number, a1: number): P[] => {
    const n = 10
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as P
    })
  }
  const contorno: P[] = [
    ...ptsY(R, L - R).map((y) => [xDer(y), y] as P),
    ...arco(xDer(L - R) - R, L - R, 0, Math.PI / 2).slice(1),
    ...arco(xIzq(L - R) + R, L - R, Math.PI / 2, Math.PI).slice(1),
    ...ptsY(L - R, R).map((y) => [xIzq(y), y] as P).slice(1),
    ...arco(xIzq(R) + R, R, Math.PI, (3 * Math.PI) / 2).slice(1),
    ...arco(xDer(R) - R, R, (3 * Math.PI) / 2, 2 * Math.PI).slice(1, -1),
  ]

  // Correas: repartidas a lo largo (sin pegarse a los extremos ni al pulgar)
  const ranura = 4 // mm de ancho de la ranura
  const largoRanura = o.anchoCorrea + 2
  const posCorreas: number[] = []
  for (let k = 0; k < o.correas; k++) {
    let y = L * ((k + 0.5) / o.correas)
    y = Math.min(L - R - largoRanura / 2 - 2, Math.max(R + largoRanura / 2 + 2, y))
    if (pulgar && Math.abs(y - pulgar.yc) < pulgar.a + largoRanura / 2) y = pulgar.yc - pulgar.a - largoRanura / 2 - 4
    posCorreas.push(y)
  }
  const rectRedondo = (cx: number, cy: number, wx: number, hy: number): P[] => {
    const r = Math.min(wx, hy) / 2
    const pts: P[] = []
    const esquinas: [number, number, number][] = [
      [cx + wx / 2 - r, cy + hy / 2 - r, 0],
      [cx - wx / 2 + r, cy + hy / 2 - r, Math.PI / 2],
      [cx - wx / 2 + r, cy - hy / 2 + r, Math.PI],
      [cx + wx / 2 - r, cy - hy / 2 + r, (3 * Math.PI) / 2],
    ]
    for (const [x, y, a0] of esquinas) for (let i = 0; i <= 6; i++) pts.push([x + r * Math.cos(a0 + (i / 6) * (Math.PI / 2)), y + r * Math.sin(a0 + (i / 6) * (Math.PI / 2))])
    return pts
  }
  const ranuras: P[][] = []
  const cajas: { cx: number; cy: number; w: number; h: number }[] = []
  for (const y of posCorreas) {
    const sep = ranura / 2 + Math.max(4, o.margen * 0.6)
    for (const cx of [xDer(y) - sep, xIzq(y) + sep]) {
      ranuras.push(rectRedondo(cx, y, ranura, largoRanura))
      cajas.push({ cx, cy: y, w: ranura, h: largoRanura })
    }
  }

  // Ventilación: cada hueco debe quedar completo dentro del margen y fuera de las franjas de las correas
  const huecos: P[][] = []
  if (o.ventilacion !== "ninguna" && o.hueco > 0) {
    const h = o.hueco
    const forma = (cx: number, cy: number): P[] => {
      if (o.ventilacion === "hexagonos") return Array.from({ length: 6 }, (_, i) => [cx + (h / 2) * Math.cos((i * Math.PI) / 3 + Math.PI / 6), cy + (h / 2) * Math.sin((i * Math.PI) / 3 + Math.PI / 6)] as P)
      const rx = h / 2
      const ry = o.ventilacion === "ovalos" ? h * 0.9 : h / 2
      return Array.from({ length: 16 }, (_, i) => [cx + rx * Math.cos((i * 2 * Math.PI) / 16), cy + ry * Math.sin((i * 2 * Math.PI) / 16)] as P)
    }
    const dx = h + o.puente
    const dy = (o.ventilacion === "ovalos" ? h * 1.8 : h * 0.87) + o.puente
    const libre = Math.max(2.5, o.puente) // material alrededor de cada ranura
    const cercaDeRanura = ([x, y]: P) => cajas.some((c) => Math.abs(x - c.cx) < c.w / 2 + libre && Math.abs(y - c.cy) < c.h / 2 + libre)
    const valido = ([x, y]: P) =>
      y > o.margen && y < L - o.margen && x < xDer(y) - o.margen && x > xIzq(y) + o.margen && !cercaDeRanura([x, y])
    let fila = 0
    for (let y = o.margen + h / 2; y < L; y += dy, fila++) {
      const desfase = fila % 2 ? dx / 2 : 0
      for (let x = -ancho / 2 + desfase; x < ancho / 2; x += dx) {
        const p = forma(x, y)
        if (p.every(valido)) huecos.push(p)
      }
    }
    if (!huecos.length) avisos.push("Con estas medidas no caben huecos de ventilación: baja el tamaño del hueco o el margen.")
  }

  // La pieza se arma con el lado del pulgar del lado correcto: se ve desde el lado que toca la piel
  const trazos: Trazo[] = [
    { pts: contorno, cerrado: true, capa: "CORTE" },
    ...ranuras.map((pts) => ({ pts, cerrado: true, capa: "CORTE" })),
    ...huecos.map((pts) => ({ pts, cerrado: true, capa: "CORTE" })),
  ]
  const dibujo: Dibujo = { trazos, avisos: [], unidades: "mm" }
  const ex = extruir(dibujo, { alto: o.grosor, base: 0, margenBase: 0, redondearBase: 0, espejo: false })
  if (ex.errores.length) return { ...vacio, errores: ex.errores }

  const mayor = Math.max(L, ancho)
  if (mayor > 250) avisos.push(`La pieza mide ${Math.round(mayor)} mm: necesitas una cama de impresión de ese tamaño (o acomódala en diagonal).`)
  if (o.cobertura > 0.75) avisos.push("Con más de 75 % de cobertura puede costar trabajo ponerla y quitarla.")
  return { dibujo, malla: ex.malla, largo: L, ancho, huecos: huecos.length, correas: posCorreas.length, errores: [], avisos }
}

// ── Con forma, en 2 piezas (28 nov 2026, Vlado) ─────────────────────────────
// En vez de imprimirla plana y moldearla con calor, sale ya curva con la forma
// del brazo, el dedo o la pata: una mitad de arriba y una de abajo que cierran
// alrededor con las correas. Cada mitad es la misma pieza plana (huecos,
// ranuras, pulgar) con media circunferencia, doblada sobre el círculo de la
// medida en cada punto: el ancho de la pieza se vuelve el arco.

/** Parte los triángulos hasta que ningún lado mida más de `max` mm (para doblar sin que se note el quiebre).
 *  Con `soloX`, sólo cuenta lo que avanza el lado en X (la dirección que se dobla). Pura. */
export function subdividir(t: number[], max: number, soloX = false): number[] {
  const out: number[] = []
  const pila: number[][] = []
  for (let i = 0; i < t.length; i += 9) pila.push(t.slice(i, i + 9))
  const d2 = (a: number[], b: number[]) => (soloX ? (a[0] - b[0]) ** 2 : (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
  while (pila.length) {
    const s = pila.pop()!
    const A = s.slice(0, 3), B = s.slice(3, 6), C = s.slice(6, 9)
    const l = [d2(A, B), d2(B, C), d2(C, A)]
    const k = l.indexOf(Math.max(...l))
    if (l[k] <= max * max) {
      out.push(...s)
      continue
    }
    // se parte el lado más largo por la mitad (los vecinos también lo parten: no quedan huecos)
    const [P, Q, R] = k === 0 ? [A, B, C] : k === 1 ? [B, C, A] : [C, A, B]
    const M = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2]
    pila.push([...P, ...M, ...R], [...M, ...Q, ...R])
  }
  return out
}

export type ResultadoFerula3D = { malla: Malla; largo: number; diametro: number; huecos: number; correas: number; errores: string[]; avisos: string[] }

/**
 * La férula con forma: dos mitades (arriba y abajo) dobladas sobre el radio de
 * cada medida, cerradas alrededor del brazo con una abertura de `abertura` mm
 * entre ellas a cada lado (para ponerla y apretarla con las correas).
 */
export function hacerFerula3D(o: OpcionesFerula, abertura = 4): ResultadoFerula3D {
  const vacio = (e: string[]): ResultadoFerula3D => ({ malla: { tris: [], avisos: [] }, largo: 0, diametro: 0, huecos: 0, correas: 0, errores: e, avisos: [] })
  // cada mitad cubre media circunferencia menos la abertura de los lados
  const circMedia = (c: number) => c + o.holgura
  const cob = (c: number) => Math.max(0.3, (circMedia(c) / 2 - abertura) / circMedia(c))
  const cobertura = cob(Math.min(...o.circunferencias.filter((c) => c > 0)))
  const arriba = hacerFerula({ ...o, cobertura })
  if (arriba.errores.length) return vacio(arriba.errores)
  // la de abajo lleva el hueco del pulgar del otro lado: así los dos medios huecos coinciden
  const abajo = hacerFerula({ ...o, cobertura, lado: o.lado === "derecho" ? "izquierdo" : "derecho" })
  if (abajo.errores.length) return vacio(abajo.errores)

  // radio (por dentro) en cada punto del largo, con las mismas estaciones que la pieza plana
  const est: [number, number][] =
    o.tipo === "antebrazo"
      ? [[0, circMedia(o.circunferencias[0])], [o.largos[0], circMedia(o.circunferencias[1])], [o.largos[0] + o.largos[1], circMedia(o.circunferencias[2])]]
      : [[0, circMedia(o.circunferencias[0])], [o.largos[0], circMedia(o.circunferencias[1])]]
  const radio = (y: number) => anchoEn(y, est) / (2 * Math.PI)
  // la pieza plana: x a lo ancho (centrada), y a lo largo, z = grosor (0 por dentro, grosor por fuera)
  const doblar = (t: number[], giro: number) => {
    // sólo a lo ancho (lo que se dobla), cada 5 mm: en un radio de 4 cm la cuerda se aparta 0.08 mm del arco
    const fina = subdividir(subdividir(t, 5, true), 12)
    const r: number[] = new Array(fina.length)
    for (let i = 0; i < fina.length; i += 3) {
      const x = fina[i], y = fina[i + 1], z = fina[i + 2]
      const R0 = radio(y)
      const a = x / R0 + giro // el ancho se vuelve arco sobre el radio interior
      const R = R0 + z
      r[i] = R * Math.sin(a)
      r[i + 1] = y
      r[i + 2] = R * Math.cos(a)
    }
    // al girar 180° la pieza queda del revés: se invierte el orden para que las caras miren hacia afuera
    if (Math.cos(giro) < 0) for (let i = 0; i < r.length; i += 9) for (let k = 0; k < 3; k++) [r[i + 3 + k], r[i + 6 + k]] = [r[i + 6 + k], r[i + 3 + k]]
    return r
  }
  const tA = doblar(arriba.malla.tris, 0)
  const tB = doblar(abajo.malla.tris, Math.PI)
  // de pie sobre la mesa como en el brazo: z hacia arriba, el largo en y
  const dmax = 2 * (Math.max(...est.map((e) => e[1])) / (2 * Math.PI) + o.grosor)
  const subir = (t: number[]) => t.map((v, i) => (i % 3 === 2 ? v + dmax / 2 : v))
  const malla: Malla = { tris: [...subir(tA), ...subir(tB)], avisos: [], partes: [{ nombre: "Mitad de arriba", triangulos: tA.length / 9 }, { nombre: "Mitad de abajo", triangulos: tB.length / 9 }] }
  const avisos = [...arriba.avisos.filter((a) => !a.includes("cama de impresión") && !a.includes("cobertura"))]
  avisos.push("Imprime cada mitad por separado, con soportes en árbol del lado de afuera, y ciérralas con las correas.")
  if (arriba.largo > 250) avisos.push(`Cada mitad mide ${Math.round(arriba.largo)} mm de largo: necesitas una cama de ese tamaño.`)
  return { malla, largo: arriba.largo, diametro: dmax, huecos: arriba.huecos + abajo.huecos, correas: arriba.correas, errores: [], avisos }
}
