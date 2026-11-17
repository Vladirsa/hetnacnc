// Generador de caja con juntas de dedo (finger joints) para láser y router CNC.
// Todo se calcula en milímetros y en el navegador: no usa servidor ni IA.
//
// Cómo encajan las piezas:
//  - Frente y atrás: todos sus bordes son tipo A (dedo afuera en las esquinas).
//  - Laterales: borde de abajo/arriba tipo A; bordes verticales tipo B.
//  - Base y tapa: todos sus bordes tipo B (hueco en las esquinas).
// Cada borde tipo A encaja con uno tipo B del mismo largo y mismo número de dedos.

export type Punto = [number, number]

export type TipoCaja = "cerrada" | "abierta" | "sobrepuesta" | "cajonera" | "corrediza"

export type OpcionesCaja = {
  ancho: number // eje X, mm
  fondo: number // eje Y, mm
  alto: number // eje Z, mm
  espesor: number // espesor del material, mm
  dedo: number // ancho deseado de cada dedo, mm (0 = automático, 4 × espesor)
  kerf: number // grosor del corte (láser ~0.1-0.2 mm; router: 0), mm
  fresa: number // diámetro de la fresa, mm (router: agrega alivio de esquina "dogbone"; láser/plasma: 0)
  medidas: "exteriores" | "interiores"
  // compatibilidad: tapa=true es "cerrada", false es "abierta"
  tapa?: boolean
  tipo?: TipoCaja
  // alto de la tapa sobrepuesta (por fuera), mm
  altoTapa?: number
  // compartimentos: columnas a lo ancho y filas a lo fondo (1 = sin divisores)
  columnas?: number
  filas?: number
  // agujeros para agarrar en los laterales
  asas?: boolean
  // ranura para monedas en la tapa (alcancía)
  ranura?: boolean
}

export type Vec3 = [number, number, number]
// Dónde va la pieza en la caja armada: punto (x, y) del contorno y z del
// espesor -> origen + x·ux + y·uy + z·uz (Y es arriba, Z es el fondo).
export type Ubicacion = { origen: Vec3; ux: Vec3; uy: Vec3; uz: Vec3 }

export type Pieza = {
  nombre: string
  ancho: number
  alto: number
  contorno: Punto[] // polígono cerrado, en mm, con la esquina inferior izquierda en (0,0)
  huecos?: Punto[][] // cortes interiores (asas, ranura), mismas coordenadas
  ubicacion?: Ubicacion
}

export type ResultadoCaja = {
  piezas: Pieza[]
  errores: string[]
  avisos: string[]
  exterior: { ancho: number; fondo: number; alto: number }
  interior: { ancho: number; fondo: number; alto: number }
  dedos: { ancho: number; fondo: number; alto: number } // número de segmentos por lado
  dedoUsado: number // ancho de dedo con el que se calculó, mm
  // medidas de todo armado (con la tapa sobrepuesta puesta)
  armado: { ancho: number; fondo: number; alto: number }
}

type TipoBorde = "A" | "B" | "L" // L = liso (sin dedos)

// número impar de segmentos, lo más cercano al ancho de dedo pedido, mínimo 3
const segmentos = (largo: number, dedo: number) => {
  const r = largo / dedo
  let n = Math.round(r)
  if (n % 2 === 0) n = Math.abs(n + 1 - r) <= Math.abs(n - 1 - r) ? n + 1 : n - 1
  return Math.max(3, n)
}

// profundidad hacia adentro del segmento i
const profundidad = (tipo: TipoBorde, i: number, t: number) => {
  if (tipo === "L") return 0
  const afuera = tipo === "A" ? i % 2 === 0 : i % 2 === 1
  return afuera ? 0 : t
}

// Contorno de una cara rectangular de w × h con un tipo de borde por lado.
// Bordes en orden: abajo, derecha, arriba, izquierda (sentido antihorario, Y hacia arriba).
function cara(
  w: number,
  h: number,
  bordes: [TipoBorde, TipoBorde, TipoBorde, TipoBorde],
  nW: number,
  nH: number,
  t: number
): Punto[] {
  const lados = [
    { inicio: [0, 0], u: [1, 0], v: [0, 1], largo: w, n: nW, tipo: bordes[0] },
    { inicio: [w, 0], u: [0, 1], v: [-1, 0], largo: h, n: nH, tipo: bordes[1] },
    { inicio: [w, h], u: [-1, 0], v: [0, -1], largo: w, n: nW, tipo: bordes[2] },
    { inicio: [0, h], u: [0, -1], v: [1, 0], largo: h, n: nH, tipo: bordes[3] },
  ]
  const pts: Punto[] = []
  for (let k = 0; k < 4; k++) {
    const L = lados[k]
    const prev = lados[(k + 3) % 4]
    const s = L.largo / L.n
    // esquina: desplazada según el último segmento del lado anterior y el primero de este
    const dPrev = profundidad(prev.tipo, prev.n - 1, t)
    const d0 = profundidad(L.tipo, 0, t)
    pts.push([
      L.inicio[0] + prev.v[0] * dPrev + L.v[0] * d0,
      L.inicio[1] + prev.v[1] * dPrev + L.v[1] * d0,
    ])
    for (let j = 1; j < L.n; j++) {
      const a = profundidad(L.tipo, j - 1, t)
      const b = profundidad(L.tipo, j, t)
      if (a === b) continue
      const bx = L.inicio[0] + L.u[0] * j * s
      const by = L.inicio[1] + L.u[1] * j * s
      pts.push([bx + L.v[0] * a, by + L.v[1] * a])
      pts.push([bx + L.v[0] * b, by + L.v[1] * b])
    }
  }
  return limpiar(pts)
}

// Puntos de un borde con dedos que va de `inicio` en la dirección `u` (con `v`
// hacia adentro de la pieza): cada segmento queda a profundidad 0 ó t.
// Sirve para armar contornos que no son un rectángulo simple (laterales de la
// tapa corrediza); limpiar() quita después los puntos que sobran.
function bordeDedos(inicio: Punto, u: Punto, v: Punto, largo: number, n: number, tipo: TipoBorde, t: number): Punto[] {
  const s = largo / n
  const pts: Punto[] = []
  for (let j = 0; j < n; j++) {
    const d = profundidad(tipo, j, t)
    pts.push([inicio[0] + u[0] * j * s + v[0] * d, inicio[1] + u[1] * j * s + v[1] * d])
    pts.push([inicio[0] + u[0] * (j + 1) * s + v[0] * d, inicio[1] + u[1] * (j + 1) * s + v[1] * d])
  }
  return pts
}

const redondear = (x: number) => Math.round(x * 1e6) / 1e6

// quita puntos repetidos y puntos en línea recta
function limpiar(pts: Punto[]): Punto[] {
  let p = pts.map(([x, y]) => [redondear(x), redondear(y)] as Punto)
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
      if (Math.abs(cruz) < 1e-9) {
        p.splice(i, 1)
        cambio = true
        break
      }
    }
  }
  return p
}

// Corre el contorno la mitad del kerf hacia afuera (polígono antihorario).
// Con kerf negativo lo encoge: así se compensan los huecos, que deben quedar
// más chicos en el archivo para salir a su medida. En esquinas de 90° es el
// mismo desplazamiento de siempre; en curvas (asas) usa la ingleta correcta.
function compensarKerf(pts: Punto[], kerf: number): Punto[] {
  if (!kerf) return pts
  const d = kerf / 2
  const n = pts.length
  const normal = (p: Punto, q: Punto): Punto => {
    const dx = q[0] - p[0]
    const dy = q[1] - p[1]
    const l = Math.hypot(dx, dy) || 1
    return [dy / l, -dx / l] // hacia afuera en sentido antihorario
  }
  return pts.map((b, i) => {
    const n1 = normal(pts[(i + n - 1) % n], b)
    const n2 = normal(b, pts[(i + 1) % n])
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1]
    const m = k > 0.2 ? d / k : d / 0.2
    return [redondear(b[0] + (n1[0] + n2[0]) * m), redondear(b[1] + (n1[1] + n2[1]) * m)]
  })
}

// Alivio de esquina "dogbone": en cada esquina interior (cóncava) de un contorno de
// ángulos rectos, cambia el vértice por un arco que una fresa redonda sí puede cortar
// por completo, para que la pieza que entra ahí quede a tope en su esquina cuadrada.
// Solo tiene sentido en router (kerf=0); en láser el corte ya saca esquinas vivas.
function alivioEsquinas(pts: Punto[], r: number): Punto[] {
  if (!r) return pts
  const n = pts.length
  const pasos = 8
  const out: Punto[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n]
    const c = pts[i]
    const b = pts[(i + 1) % n]
    const dIn = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1
    const dOut = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1
    const eIn: Punto = [(c[0] - a[0]) / dIn, (c[1] - a[1]) / dIn]
    const eOut: Punto = [(b[0] - c[0]) / dOut, (b[1] - c[1]) / dOut]
    const cruz = eIn[0] * eOut[1] - eIn[1] * eOut[0]
    if (cruz >= -1e-9) {
      out.push(c)
      continue
    }
    const e1: Punto = [(eOut[0] - eIn[0]) / Math.SQRT2, (eOut[1] - eIn[1]) / Math.SQRT2] // hacia el hueco
    const e2: Punto = [(eIn[0] + eOut[0]) / Math.SQRT2, (eIn[1] + eOut[1]) / Math.SQRT2]
    const centro: Punto = [c[0] + r * e1[0], c[1] + r * e1[1]]
    // el arco barre hacia -e1 (hacia el material): entra y sale por los mismos puntos
    // que tocarían las paredes originales, pasando por la esquina original a la mitad
    for (let k = 0; k <= pasos; k++) {
      const t = -Math.PI / 2 + (Math.PI * k) / pasos
      const co = -Math.cos(t), si = Math.sin(t)
      out.push([centro[0] + r * co * e1[0] + r * si * e2[0], centro[1] + r * co * e1[1] + r * si * e2[1]])
    }
  }
  return limpiar(out)
}

// deja la esquina inferior izquierda del contorno en (0,0) (y mueve los huecos igual)
function aOrigen(pts: Punto[], huecos: Punto[][] = []) {
  const minX = Math.min(...pts.map((p) => p[0]))
  const minY = Math.min(...pts.map((p) => p[1]))
  const mover = (l: Punto[]) => l.map(([x, y]) => [redondear(x - minX), redondear(y - minY)] as Punto)
  const q = mover(pts)
  return {
    contorno: q,
    ...(huecos.length ? { huecos: huecos.map(mover) } : {}),
    ancho: redondear(Math.max(...q.map((p) => p[0]))),
    alto: redondear(Math.max(...q.map((p) => p[1]))),
    desfase: [minX, minY] as Punto,
  }
}

// Ranura redondeada (asa) centrada en (cx, cy), antihoraria
function ranuraRedonda(cx: number, cy: number, largo: number, alto: number): Punto[] {
  const r = alto / 2
  const m = Math.max(0, largo / 2 - r)
  const pts: Punto[] = []
  const pasos = 10
  for (let k = 0; k <= pasos; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / pasos
    pts.push([cx + m + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  for (let k = 0; k <= pasos; k++) {
    const a = Math.PI / 2 + (Math.PI * k) / pasos
    pts.push([cx - m + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

const rect = (x0: number, y0: number, x1: number, y1: number): Punto[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

// Divisor con ranuras a media altura (se cruzan como "huacal de huevo").
// ranuras: centros de las ranuras a lo largo; desdeArriba: la ranura entra por arriba.
function divisor(largo: number, alto: number, ranuras: number[], ancho: number, desdeArriba: boolean): Punto[] {
  const h = alto / 2
  const pts: Punto[] = []
  if (desdeArriba) {
    pts.push([0, 0], [largo, 0], [largo, alto])
    for (const c of [...ranuras].sort((a, b) => b - a)) {
      pts.push([c + ancho / 2, alto], [c + ancho / 2, h], [c - ancho / 2, h], [c - ancho / 2, alto])
    }
    pts.push([0, alto])
  } else {
    pts.push([0, 0])
    for (const c of [...ranuras].sort((a, b) => a - b)) {
      pts.push([c - ancho / 2, 0], [c - ancho / 2, h], [c + ancho / 2, h], [c + ancho / 2, 0])
    }
    pts.push([largo, 0], [largo, alto], [0, alto])
  }
  return limpiar(pts)
}

// Centros de los divisores para que todos los compartimentos midan igual
function centros(interior: number, partes: number, t: number): number[] {
  if (partes <= 1) return []
  const hueco = (interior - (partes - 1) * t) / partes
  return Array.from({ length: partes - 1 }, (_, j) => (j + 1) * hueco + j * t + t / 2)
}

// Ubicación en la caja armada de cada cara (W ancho, D fondo, H alto)
function ubicar(nombre: string, t: number, W: number, D: number, H: number): Ubicacion {
  switch (nombre) {
    case "Base":
      return { origen: [0, 0, 0], ux: [1, 0, 0], uy: [0, 0, 1], uz: [0, 1, 0] }
    case "Tapa":
      return { origen: [0, H - t, 0], ux: [1, 0, 0], uy: [0, 0, 1], uz: [0, 1, 0] }
    case "Frente":
      return { origen: [0, 0, 0], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] }
    case "Atrás":
      return { origen: [0, 0, D - t], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] }
    case "Lateral izquierdo":
      return { origen: [0, 0, 0], ux: [0, 0, 1], uy: [0, 1, 0], uz: [1, 0, 0] }
    case "Lateral derecho":
      return { origen: [W - t, 0, 0], ux: [0, 0, 1], uy: [0, 1, 0], uz: [1, 0, 0] }
    default:
      return { origen: [0, 0, 0], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] }
  }
}

type Cruda = { nombre: string; pts: Punto[]; huecos?: Punto[][]; ubicacion: Ubicacion; conDedos: boolean }

// Las caras de una caja de W × D × H (medidas exteriores) con juntas de dedo
function caras(W: number, D: number, H: number, t: number, dedo: number, cerrada: boolean, prefijo = "") {
  const nW = segmentos(W, dedo)
  const nD = segmentos(D, dedo)
  const nH = segmentos(H, dedo)
  const arriba: TipoBorde = cerrada ? "A" : "L"
  const lista: { nombre: string; pts: Punto[] }[] = [
    { nombre: "Base", pts: cara(W, D, ["B", "B", "B", "B"], nW, nD, t) },
    ...(cerrada ? [{ nombre: "Tapa", pts: cara(W, D, ["B", "B", "B", "B"], nW, nD, t) }] : []),
    { nombre: "Frente", pts: cara(W, H, ["A", "A", arriba, "A"], nW, nH, t) },
    { nombre: "Atrás", pts: cara(W, H, ["A", "A", arriba, "A"], nW, nH, t) },
    { nombre: "Lateral izquierdo", pts: cara(D, H, ["A", "B", arriba, "B"], nD, nH, t) },
    { nombre: "Lateral derecho", pts: cara(D, H, ["A", "B", arriba, "B"], nD, nH, t) },
  ]
  return {
    nW,
    nD,
    nH,
    minSeg: Math.min(W / nW, D / nD, H / nH),
    crudas: lista.map(
      (p): Cruda => ({ nombre: prefijo + p.nombre, pts: p.pts, ubicacion: ubicar(p.nombre, t, W, D, H), conDedos: true })
    ),
  }
}

export const dedoAutomatico = (espesor: number) => Math.max(8, 4 * espesor)

export function generarCaja(o: OpcionesCaja): ResultadoCaja {
  const errores: string[] = []
  const avisos: string[] = []
  const t = o.espesor
  const tipo: TipoCaja = o.tipo || (o.tapa === false ? "abierta" : "cerrada")
  const cerrada = tipo === "cerrada"
  const cajonera = tipo === "cajonera"
  const corrediza = tipo === "corrediza"
  const extra = o.medidas === "interiores" ? 2 * t : 0
  const W = o.ancho + extra
  // la carcasa de la cajonera no tiene frente: por dentro le falta un solo espesor a lo fondo
  const D = o.fondo + (cajonera ? extra / 2 : extra)
  const H = o.alto + (o.medidas === "interiores" ? (cerrada || cajonera ? 2 * t : t) : 0)
  // Cajonera: el cajón deja 1 mm por lado contra la carcasa (y 1 mm atrás)
  const juego = 1
  const cajon = { ancho: W - 2 * t - 2 * juego, fondo: D - t - juego, alto: H - 2 * t - 2 * juego }
  // Tapa corrediza: la tapa corre por una ranura abierta al frente en los
  // laterales (riel); arriba de la ranura queda una franja amarrada al frente
  // por un travesaño. El frente es más bajo para que la tapa pase encima.
  const ranuraCorr = t + 0.4 // alto de la ranura: espesor + juego para que corra
  const franja = Math.max(5 * t, 15) // franja de lateral arriba de la ranura (y alto del travesaño)
  const altoFrente = H - ranuraCorr - franja
  const finRanura = D - 2 * t // la ranura no llega a la pared de atrás: el lateral queda entero ahí
  const interior = cajonera
    ? { ancho: cajon.ancho - 2 * t, fondo: cajon.fondo - 2 * t, alto: cajon.alto - t }
    : corrediza
      ? { ancho: W - 2 * t, fondo: D - 2 * t, alto: altoFrente - t }
      : { ancho: W - 2 * t, fondo: D - 2 * t, alto: H - (cerrada ? 2 : 1) * t }
  const holgura = 0.5 // por lado, para la tapa sobrepuesta y los divisores
  const Ht = Math.max(o.altoTapa || 0, 0)
  const Wt = W + 2 * holgura + 2 * t
  const Dt = D + 2 * holgura + 2 * t
  const armado = tipo === "sobrepuesta" ? { ancho: Wt, fondo: Dt, alto: H + t } : { ancho: W, fondo: D, alto: H }

  const autoDedo = !(o.dedo > 0)
  let dedo = autoDedo ? dedoAutomatico(t) : o.dedo

  const vacio = (): ResultadoCaja => ({
    piezas: [],
    errores,
    avisos,
    exterior: { ancho: W, fondo: D, alto: H },
    interior,
    dedos: { ancho: 0, fondo: 0, alto: 0 },
    dedoUsado: dedo,
    armado,
  })

  if (![o.ancho, o.fondo, o.alto, t].every((x) => Number.isFinite(x) && x > 0)) {
    errores.push("Todas las medidas deben ser mayores que cero.")
    return vacio()
  }
  if (!(o.kerf >= 0 && o.kerf < t)) errores.push("El kerf debe ser 0 o mayor, y menor que el espesor.")
  if (Math.min(W, D, H) < 6 * t) errores.push("La caja es muy pequeña para ese espesor: cada lado debe medir al menos 6 veces el espesor.")
  if (Math.max(W, D, H) > 3000) errores.push("La caja es demasiado grande: ningún lado puede pasar de 3 metros.")
  if (tipo === "sobrepuesta" && Ht < 4 * t) errores.push(`La tapa debe medir al menos ${r(4 * t)} mm de alto con ese espesor.`)
  if (tipo === "sobrepuesta" && Ht > H) errores.push("La tapa no puede ser más alta que la caja.")
  if (corrediza && altoFrente < Math.max(4 * t, 20))
    errores.push(`Para la tapa corrediza la caja debe medir al menos ${r(Math.max(4 * t, 20) + ranuraCorr + franja)} mm de alto con ese espesor.`)
  if (cajonera && Math.min(cajon.ancho, cajon.fondo, cajon.alto) < 6 * t)
    errores.push("La carcasa es muy chica para un cajón con ese espesor: hazla más grande o usa material más delgado.")
  if (errores.length) return vacio()

  // Cajonera: una carcasa (caja abierta girada, la boca al frente) y un cajón
  // (caja abierta normal) que entra en ella con juego.
  const armarCajonera = (d: number) => {
    // carcasa: caja abierta de W × H × D con la boca arriba, girada para que
    // la boca quede al frente: (x, y, z) local -> (x, z, D - y) en la caja
    const carcasa = caras(W, H, D, t, d, false, "Carcasa · ")
    const nombres: Record<string, string> = { "Carcasa · Base": "Carcasa · Atrás", "Carcasa · Frente": "Carcasa · Piso", "Carcasa · Atrás": "Carcasa · Techo" }
    const giro = (v: Vec3): Vec3 => [v[0], v[2], -v[1]]
    for (const c of carcasa.crudas) {
      const u = c.ubicacion
      c.nombre = nombres[c.nombre] || c.nombre
      c.ubicacion = { origen: [u.origen[0], u.origen[2], D - u.origen[1]], ux: giro(u.ux), uy: giro(u.uy), uz: giro(u.uz) }
    }
    const caj = caras(cajon.ancho, cajon.fondo, cajon.alto, t, d, false, "Cajón · ")
    for (const c of caj.crudas) {
      const u = c.ubicacion
      c.ubicacion = { ...u, origen: [u.origen[0] + t + juego, u.origen[1] + t + juego, u.origen[2]] }
      // jaladera: hueco para los dedos en el frente del cajón
      if (c.nombre === "Cajón · Frente" && cajon.ancho >= 70 && cajon.alto >= 40) {
        c.huecos = [ranuraRedonda(cajon.ancho / 2, cajon.alto * 0.62, Math.min(70, cajon.ancho * 0.4), Math.min(22, cajon.alto * 0.25))]
      }
    }
    return { nW: carcasa.nW, nD: carcasa.nD, nH: carcasa.nH, minSeg: Math.min(carcasa.minSeg, caj.minSeg), crudas: [...carcasa.crudas, ...caj.crudas] }
  }
  const armarCorrediza = (d: number) => {
    const nW = segmentos(W, d)
    const nD = segmentos(D, d)
    const nH = segmentos(H, d)
    const nF = segmentos(altoFrente, d) // unión lateral-frente
    const nT = segmentos(franja, d) // unión lateral-travesaño
    const yRanura = altoFrente
    const yFranja = altoFrente + ranuraCorr
    // Lateral (D × H, el frente en x = 0): abajo A, atrás B, arriba liso; al
    // frente, unión con el travesaño, la ranura abierta y unión con el frente.
    const lateral = (): Punto[] =>
      limpiar([
        ...bordeDedos([0, 0], [1, 0], [0, 1], D, nD, "A", t),
        ...bordeDedos([D, 0], [0, 1], [-1, 0], H, nH, "B", t),
        [D, H],
        [0 + t, H],
        ...bordeDedos([0, H], [0, -1], [1, 0], franja, nT, "B", t),
        [finRanura, yFranja],
        [finRanura, yRanura],
        ...bordeDedos([0, yRanura], [0, -1], [1, 0], altoFrente, nF, "B", t),
      ])
    const tapaAncho = W - 0.4
    const tapaLargo = finRanura - 0.5
    const lista: Cruda[] = [
      { nombre: "Base", pts: cara(W, D, ["B", "B", "B", "B"], nW, nD, t), ubicacion: ubicar("Base", t, W, D, H), conDedos: true },
      { nombre: "Atrás", pts: cara(W, H, ["A", "A", "L", "A"], nW, nH, t), ubicacion: ubicar("Atrás", t, W, D, H), conDedos: true },
      { nombre: "Frente", pts: cara(W, altoFrente, ["A", "A", "L", "A"], nW, nF, t), ubicacion: ubicar("Frente", t, W, D, H), conDedos: true },
      {
        nombre: "Travesaño",
        pts: cara(W, franja, ["L", "A", "L", "A"], nW, nT, t),
        ubicacion: { origen: [0, yFranja, 0], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] },
        conDedos: true,
      },
      { nombre: "Lateral izquierdo", pts: lateral(), ubicacion: ubicar("Lateral izquierdo", t, W, D, H), conDedos: true },
      { nombre: "Lateral derecho", pts: lateral(), ubicacion: ubicar("Lateral derecho", t, W, D, H), conDedos: true },
      {
        nombre: "Tapa corrediza",
        pts: rect(0, 0, tapaAncho, tapaLargo),
        // muesca para jalarla con el dedo, cerca del frente
        huecos: tapaAncho >= 60 && tapaLargo >= 40 ? [ranuraRedonda(tapaAncho / 2, 14, Math.min(40, tapaAncho * 0.3), 10)] : [],
        ubicacion: { origen: [0.2, yRanura + (ranuraCorr - t) / 2, 0], ux: [1, 0, 0], uy: [0, 0, 1], uz: [0, 1, 0] },
        conDedos: false,
      },
    ]
    return { nW, nD, nH, minSeg: Math.min(W / nW, D / nD, H / nH, altoFrente / nF, franja / nT), crudas: lista }
  }
  const armar = (d: number) => (cajonera ? armarCajonera(d) : corrediza ? armarCorrediza(d) : caras(W, D, H, t, d, cerrada))

  // En automático, el dedo se agranda solo si no cabe; a mano se avisa
  let base = armar(dedo)
  if (autoDedo) {
    for (let i = 0; i < 8 && base.minSeg < 1.5 * t; i++) {
      dedo *= 1.4
      base = armar(dedo)
    }
  }
  if (base.minSeg < 1.5 * t) {
    errores.push(`Los dedos quedan muy angostos (${base.minSeg.toFixed(1)} mm). Usa un dedo de al menos ${(2 * t).toFixed(1)} mm o déjalo en automático.`)
    return vacio()
  }
  if (!autoDedo && o.dedo < 2 * t) avisos.push("Con dedos menores a 2 veces el espesor la unión queda débil.")
  if (o.kerf === 0 && o.fresa === 0) avisos.push("Sin kerf las uniones quedan sueltas en láser. Si cortas con router, pon el diámetro de tu fresa para agregar alivio de esquina.")
  if (o.fresa < 0) errores.push("La fresa no puede ser negativa.")
  if (o.fresa > 0 && o.fresa > base.minSeg) {
    errores.push(`La fresa (${o.fresa} mm) es más ancha que el dedo (${base.minSeg.toFixed(1)} mm); usa una fresa más delgada o dedos más anchos.`)
  }
  if (errores.length) return vacio()

  const crudas: Cruda[] = [...base.crudas]

  if (cajonera && (o.asas || o.ranura || (o.columnas || 1) > 1 || (o.filas || 1) > 1))
    avisos.push("La cajonera todavía no lleva asas, ranura ni divisiones: se dejaron fuera.")
  if (corrediza && (o.asas || o.ranura))
    avisos.push("La caja de tapa corrediza no lleva asas ni ranura de alcancía: se dejaron fuera.")

  // ---- Asas en los laterales
  if (o.asas && !cajonera && !corrediza) {
    const largo = Math.min(100, D * 0.45, D - 6 * t)
    const altoAsa = Math.min(28, H * 0.22)
    const techo = H - (cerrada ? t : 0)
    const cy = techo - Math.max(altoAsa / 2 + 2 * t, H * 0.16)
    if (largo < 2 * altoAsa || altoAsa < 12 || cy - altoAsa / 2 < 2 * t) {
      avisos.push("La caja es muy chica para asas: se dejaron fuera.")
    } else {
      for (const c of crudas) if (c.nombre.startsWith("Lateral")) c.huecos = [ranuraRedonda(D / 2, cy, largo, altoAsa)]
    }
  }

  // ---- Ranura para monedas en la tapa
  if (o.ranura && !cajonera && !corrediza) {
    const tapa = crudas.find((c) => c.nombre === "Tapa")
    if (!tapa) avisos.push("La ranura para monedas va en la tapa: elige una caja cerrada.")
    else if (W < 70 || D < 30) avisos.push("La tapa es muy chica para la ranura de monedas.")
    else tapa.huecos = [rect(W / 2 - 22, D / 2 - 2.5, W / 2 + 22, D / 2 + 2.5)]
  }

  // ---- Divisores (sueltos, se meten desde arriba)
  const cols = Math.max(1, Math.min(12, Math.round(o.columnas || 1)))
  const filas = Math.max(1, Math.min(12, Math.round(o.filas || 1)))
  if (!cajonera && (cols > 1 || filas > 1)) {
    const hd = interior.alto - (cerrada ? 1 : 0)
    const cx = centros(interior.ancho, cols, t)
    const cz = centros(interior.fondo, filas, t)
    const minComp = Math.min((interior.ancho - (cols - 1) * t) / cols, (interior.fondo - (filas - 1) * t) / filas)
    if (minComp < 15) {
      errores.push(`Los compartimentos quedan de ${minComp.toFixed(0)} mm: pon menos divisiones o una caja más grande.`)
      return vacio()
    }
    const largoX = interior.ancho - 2 * holgura
    const largoZ = interior.fondo - 2 * holgura
    // ranura un poco más ancha que el espesor para que entren sin forzar
    const ancho = t + 0.1
    cz.forEach((z, i) =>
      crudas.push({
        nombre: `Divisor a lo ancho ${i + 1}`,
        pts: divisor(largoX, hd, cx.map((x) => x - holgura), ancho, true),
        ubicacion: { origen: [t + holgura, t, t + z - t / 2], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] },
        conDedos: false,
      })
    )
    cx.forEach((x, j) =>
      crudas.push({
        nombre: `Divisor a lo fondo ${j + 1}`,
        pts: divisor(largoZ, hd, cz.map((z) => z - holgura), ancho, cz.length > 0 ? false : true),
        ubicacion: { origen: [t + x - t / 2, t, t + holgura], ux: [0, 0, 1], uy: [0, 1, 0], uz: [1, 0, 0] },
        conDedos: false,
      })
    )
    if (cx.length && cz.length) avisos.push("Los divisores se cruzan a media altura: mete primero los de a lo fondo (ranura abajo) y luego los de a lo ancho.")
  }

  // ---- Tapa sobrepuesta: otra caja abierta, un poco más grande, de cabeza
  if (tipo === "sobrepuesta") {
    let tapa = caras(Wt, Dt, Ht, t, dedo, false, "Tapa · ")
    if (autoDedo) for (let i = 0; i < 8 && tapa.minSeg < 1.5 * t; i++) tapa = caras(Wt, Dt, Ht, t, (dedo *= 1.25), false, "Tapa · ")
    if (tapa.minSeg < 1.5 * t) {
      errores.push("La tapa queda muy baja para esos dedos: súbele altura o usa dedos más chicos.")
      return vacio()
    }
    // se pone de cabeza encima de la caja, centrada (reflexión en Y)
    const off = t + holgura
    // la base de la tapa descansa sobre las paredes de la caja
    const techo = H + t
    for (const c of tapa.crudas) {
      const u = c.ubicacion
      c.ubicacion = {
        origen: [u.origen[0] - off, techo - u.origen[1], u.origen[2] - off],
        ux: [u.ux[0], -u.ux[1], u.ux[2]],
        uy: [u.uy[0], -u.uy[1], u.uy[2]],
        uz: [u.uz[0], -u.uz[1], u.uz[2]],
      }
      crudas.push(c)
    }
  }

  const piezas = crudas.map(({ nombre, pts, huecos, ubicacion, conDedos }) => {
    const exterior = conDedos ? alivioEsquinas(compensarKerf(pts, o.kerf), o.fresa / 2) : compensarKerf(pts, o.kerf)
    const hs = (huecos || []).map((h) => compensarKerf(h, -o.kerf))
    const { desfase, ...resto } = aOrigen(exterior, hs)
    // el contorno se movió a (0,0): la ubicación se corrige para que la pieza no se recorra
    const u = ubicacion
    const origen: Vec3 = [
      u.origen[0] + desfase[0] * u.ux[0] + desfase[1] * u.uy[0],
      u.origen[1] + desfase[0] * u.ux[1] + desfase[1] * u.uy[1],
      u.origen[2] + desfase[0] * u.ux[2] + desfase[1] * u.uy[2],
    ]
    return { nombre, ...resto, ubicacion: { ...u, origen } }
  })
  return {
    piezas,
    errores,
    avisos,
    exterior: { ancho: W, fondo: D, alto: H },
    interior,
    dedos: { ancho: base.nW, fondo: base.nD, alto: base.nH },
    dedoUsado: dedo,
    armado,
  }
}

const r = (x: number) => Math.round(x * 10) / 10

// Par de prueba para ajustar el kerf antes de cortar la caja: dos tiras con
// dedos que encajan (A con B). Si entran justas, el kerf es el bueno.
export function piezasPrueba(espesor: number, kerf: number, dedo: number): Pieza[] {
  const t = espesor
  const d = dedo > 0 ? dedo : dedoAutomatico(t)
  const n = 5
  const largo = n * Math.max(d, 2 * t)
  const ancho = Math.max(25, 6 * t)
  return [
    { nombre: "Prueba A", pts: cara(largo, ancho, ["A", "L", "L", "L"], n, 3, t) },
    { nombre: "Prueba B", pts: cara(largo, ancho, ["B", "L", "L", "L"], n, 3, t) },
  ].map(({ nombre, pts }) => {
    const { desfase: _d, ...resto } = aOrigen(compensarKerf(pts, kerf))
    return { nombre, ...resto }
  })
}

// ---------- Acomodo y exportación ----------

export type Colocada = Pieza & { x: number; y: number }

// Acomoda las piezas en repisas (de la más alta a la más baja), buscando una
// hoja lo más cuadrada posible, con separación (mm)
export function acomodar(piezas: Pieza[], separacion = 5) {
  const colocadas: Colocada[] = []
  if (!piezas.length) return { colocadas, ancho: 0, alto: 0 }
  const area = piezas.reduce((s, p) => s + (p.ancho + separacion) * (p.alto + separacion), 0)
  const limite = Math.max(...piezas.map((p) => p.ancho), Math.sqrt(area) * 1.25)
  const orden = [...piezas].sort((a, b) => b.alto - a.alto)
  let x = 0
  let y = 0
  let altoFila = 0
  let anchoTotal = 0
  for (const p of orden) {
    if (x > 0 && x + p.ancho > limite) {
      y += altoFila + separacion
      x = 0
      altoFila = 0
    }
    colocadas.push({ ...p, x, y })
    x += p.ancho + separacion
    altoFila = Math.max(altoFila, p.alto)
    anchoTotal = Math.max(anchoTotal, x - separacion)
  }
  return { colocadas, ancho: anchoTotal, alto: y + altoFila }
}

const f = (x: number) => String(Math.round(x * 1000) / 1000)

// SVG en milímetros.
//  - modo "corte": rojo 0.1 mm = línea de corte (LightBurn, RDWorks, Inkscape), sin textos
//  - modo "vista": para la pantalla, con el nombre de cada pieza
export function aSVG(piezas: Pieza[], modo: "corte" | "vista" = "corte") {
  const { colocadas, ancho, alto } = acomodar(piezas)
  const m = 2 // margen
  const W = ancho + 2 * m
  const H = alto + 2 * m
  const vista = modo === "vista"
  const trazo = vista
    ? `fill="#FDEEE1" fill-opacity="0.55" fill-rule="evenodd" stroke="#C2560A" stroke-width="1.4" vector-effect="non-scaling-stroke"`
    : `fill="none" stroke="#FF0000" stroke-width="0.1"`
  const cuerpos = colocadas
    .map((p) => {
      // el SVG tiene Y hacia abajo: cada pieza se voltea en su lugar
      const camino = (l: Punto[]) => l.map(([x, y], i) => `${i ? "L" : "M"}${f(m + p.x + x)} ${f(m + p.y + p.alto - y)}`).join(" ") + " Z"
      const d = [p.contorno, ...(p.huecos || [])].map(camino).join(" ")
      const etiqueta = vista
        ? `<text x="${f(m + p.x + p.ancho / 2)}" y="${f(m + p.y + p.alto / 2)}" font-size="${f(Math.max(3, Math.min(10, p.alto / 7, (0.8 * p.ancho) / (0.6 * p.nombre.length))))}" text-anchor="middle" dominant-baseline="middle" fill="#6B6A63" font-family="sans-serif">${p.nombre}</text>`
        : ""
      return `<path d="${d}" ${trazo}/>${etiqueta}`
    })
    .join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">\n${cuerpos}\n</svg>\n`
}

// DXF R12 con polilíneas cerradas en la capa CORTE (huecos en CORTE_INTERIOR,
// para cortarlos primero), unidades mm
export function aDXF(piezas: Pieza[]) {
  const { colocadas } = acomodar(piezas)
  const l: string[] = []
  const par = (c: number | string, v: number | string) => l.push(String(c), String(v))
  par(0, "SECTION"); par(2, "HEADER")
  par(9, "$ACADVER"); par(1, "AC1009")
  par(9, "$INSUNITS"); par(70, 4)
  par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  const poli = (p: Colocada, pts: Punto[], capa: string) => {
    par(0, "POLYLINE"); par(8, capa); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, 1)
    for (const [x, y] of pts) {
      par(0, "VERTEX"); par(8, capa); par(10, f(p.x + x)); par(20, f(p.y + y)); par(30, 0)
    }
    par(0, "SEQEND"); par(8, capa)
  }
  for (const p of colocadas) for (const h of p.huecos || []) poli(p, h, "CORTE_INTERIOR")
  for (const p of colocadas) poli(p, p.contorno, "CORTE")
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}

// Área de material que ocupan las piezas (m²), para cotizar
export const areaMaterial = (piezas: Pieza[]) =>
  piezas.reduce((s, p) => s + p.ancho * p.alto, 0) / 1e6
