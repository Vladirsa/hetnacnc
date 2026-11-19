// Partir un modelo 3D en piezas que quepan en la impresora (hetnacnc.com/mx/disenar/partir-3d).
//
// Usa manifold-3d (Apache-2.0, WASM ~540 KB en /wasm/manifold-<versión>.wasm): corta con
// planos y tapa las caras del corte de forma exacta, y hace las uniones
// (booleanas) de los conectores. Todo corre en el navegador.
//
// Conectores en cada cara de corte, colocados dentro del material (la sección
// se encoge el radio del agujero + 2 mm de pared) y lejos de los otros cortes:
//   · pernos: agujero en las dos caras + pernos sueltos para imprimir aparte
//   · integrado: perno pegado a una pieza y agujero en la otra
//   · imanes: hueco del imán en las dos caras
//   · ninguno: caras planas para pegar
import type { Malla } from "./vectores"

export type Eje = 0 | 1 | 2
export type Corte = { eje: Eje; pos: number }
export type TipoConector = "pernos" | "integrado" | "imanes" | "ninguno"
export type OpcionesPartir = {
  cortes: Corte[]
  conector: TipoConector
  diametro: number // perno (mm)
  largo: number // perno completo (mm), mitad en cada pieza
  holgura: number // juego radial (mm)
  imanD: number
  imanH: number
}
export type Pieza = { nombre: string; malla: Malla; tam: [number, number, number] }
export type Resultado = { piezas: Pieza[]; conectores: number; perno: Malla | null; pernoLargo: number; avisos: string[] }

export const OPCIONES_BASE: Omit<OpcionesPartir, "cortes"> = { conector: "pernos", diametro: 5, largo: 12, holgura: 0.2, imanD: 6, imanH: 3 }
// mismo nombre que copia scripts/copiar-wasm-replicad.mjs (versión de manifold-3d en package.json)
export const MANIFOLD_WASM = "/wasm/manifold-3.5.5.wasm"
const PARED = 2
const EJES = ["X", "Y", "Z"]

type Wasm = any
let cargando: Promise<Wasm> | null = null
/** Carga manifold-3d (una sola vez). En pruebas se puede pasar el módulo ya cargado. */
export function cargarManifold(listo?: Wasm): Promise<Wasm> {
  if (listo) cargando = Promise.resolve(listo)
  if (!cargando) {
    cargando = (async () => {
      const { default: Module } = await import("manifold-3d")
      const w = await Module({ locateFile: () => MANIFOLD_WASM })
      w.setup()
      return w
    })()
    cargando.catch(() => { cargando = null })
  }
  return cargando
}

/** Cortes repartidos parejo para que cada pieza mida como máximo la cama (menos un margen). */
export function cortesParaCama(min: number[], max: number[], cama: [number, number, number], margen = 4): Corte[] {
  const cortes: Corte[] = []
  for (const eje of [0, 1, 2] as Eje[]) {
    const largo = max[eje] - min[eje]
    const util = Math.max(10, cama[eje] - margen)
    const n = Math.max(1, Math.ceil((largo - 0.01) / util))
    for (let i = 1; i < n; i++) cortes.push({ eje, pos: redondear(min[eje] + (largo * i) / n) })
  }
  return cortes
}
const redondear = (n: number) => Math.round(n * 10) / 10
const r1 = redondear

/** ¿Cabe una caja en la cama, girándola como sea? */
export function cabe(tam: number[], cama: number[]) {
  const a = [...tam].sort((x, y) => x - y)
  const b = [...cama].sort((x, y) => x - y)
  return a.every((v, i) => v <= b[i] + 0.01)
}

// ── Malla <-> Manifold ────────────────────────────────────────────────────
function aManifold(w: Wasm, m: Malla) {
  const t = m.tris
  const idx = new Map<string, number>()
  const verts: number[] = []
  const tri = new Uint32Array(t.length / 3)
  for (let i = 0; i < t.length; i += 3) {
    const k = `${Math.round(t[i] * 1e4)},${Math.round(t[i + 1] * 1e4)},${Math.round(t[i + 2] * 1e4)}`
    let v = idx.get(k)
    if (v === undefined) {
      v = verts.length / 3
      verts.push(t[i], t[i + 1], t[i + 2])
      idx.set(k, v)
    }
    tri[i / 3] = v
  }
  // quita triángulos degenerados (dos vértices iguales)
  const buenos: number[] = []
  for (let i = 0; i < tri.length; i += 3) if (tri[i] !== tri[i + 1] && tri[i + 1] !== tri[i + 2] && tri[i] !== tri[i + 2]) buenos.push(tri[i], tri[i + 1], tri[i + 2])
  const mesh = new w.Mesh({ numProp: 3, vertProperties: new Float32Array(verts), triVerts: new Uint32Array(buenos) })
  mesh.merge()
  let s
  try {
    s = new w.Manifold(mesh)
  } catch {
    throw new Error("El modelo no es un sólido cerrado (tiene huecos o caras sueltas). Repáralo en tu programa (p. ej. Meshmixer, PrusaSlicer → Reparar) y vuelve a subirlo.")
  }
  return s
}

function aMalla(s: any): Malla {
  const mesh = s.getMesh()
  const p = mesh.vertProperties as Float32Array
  const n = mesh.numProp as number
  const tv = mesh.triVerts as Uint32Array
  const tris: number[] = new Array(tv.length * 3)
  for (let i = 0; i < tv.length; i++) {
    const v = tv[i] * n
    tris[i * 3] = p[v]
    tris[i * 3 + 1] = p[v + 1]
    tris[i * 3 + 2] = p[v + 2]
  }
  return { tris, avisos: [] }
}

// Permutación cíclica para que el eje del corte quede como Z (det +1, no voltea caras).
// eje 0: (x,y,z) → (y,z,x) · eje 1: (x,y,z) → (z,x,y) · eje 2: igual
const MATRIZ: Record<Eje, number[]> = {
  0: [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  1: [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1],
  2: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
}
/** Punto (u, v) de la sección en el plano del corte → coordenadas del modelo. */
function a3D(eje: Eje, u: number, v: number, w: number): [number, number, number] {
  if (eje === 0) return [w, u, v]
  if (eje === 1) return [v, w, u]
  return [u, v, w]
}

function dentro(px: number, py: number, polis: [number, number][][]) {
  let c = false
  for (const p of polis) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j]
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
    }
  }
  return c
}

/** Puntos para conectores en una sección (u, v): dentro del material, separados entre sí. */
function puntosConector(seccion: any, radio: number, separacion: number, evitar: (u: number, v: number) => boolean): [number, number][] {
  const out: [number, number][] = []
  for (const region of seccion.decompose()) {
    const area = region.area()
    const chica = region.offset(-(radio + PARED), "Round")
    if (chica.isEmpty()) continue
    const polis = chica.toPolygons() as [number, number][][]
    const b = chica.bounds()
    const pasos = 18
    const cand: [number, number][] = []
    for (let i = 0; i <= pasos; i++) {
      for (let j = 0; j <= pasos; j++) {
        const u = b.min[0] + ((b.max[0] - b.min[0]) * i) / pasos
        const v = b.min[1] + ((b.max[1] - b.min[1]) * j) / pasos
        if (dentro(u, v, polis) && !evitar(u, v)) cand.push([u, v])
      }
    }
    if (!cand.length) continue
    const quiero = area < 900 ? 1 : area < 4000 ? 2 : area < 12000 ? 3 : 4
    // el primero, el más cercano al centro de la región encogida; luego, el más lejos de los ya elegidos
    const cu = (b.min[0] + b.max[0]) / 2, cv = (b.min[1] + b.max[1]) / 2
    cand.sort((p, q) => Math.hypot(p[0] - cu, p[1] - cv) - Math.hypot(q[0] - cu, q[1] - cv))
    const elegidos: [number, number][] = [cand[0]]
    if (quiero > 1) {
      // con varios, mejor repartidos hacia las orillas: se descarta el del centro
      elegidos.length = 0
      let lejos = cand[0]
      for (const c of cand) if (Math.hypot(c[0] - cu, c[1] - cv) > Math.hypot(lejos[0] - cu, lejos[1] - cv)) lejos = c
      elegidos.push(lejos)
      while (elegidos.length < quiero) {
        let mejor: [number, number] | null = null, dMejor = 0
        for (const c of cand) {
          const d = Math.min(...elegidos.map((e) => Math.hypot(c[0] - e[0], c[1] - e[1])))
          if (d > dMejor) { dMejor = d; mejor = c }
        }
        if (!mejor || dMejor < separacion) break
        elegidos.push(mejor)
      }
    }
    out.push(...elegidos)
  }
  return out
}

/** Parte la malla con los cortes y pone los conectores. */
export async function partir(m: Malla, op: OpcionesPartir): Promise<Resultado> {
  const w = await cargarManifold()
  const { Manifold } = w
  const basura: any[] = []
  const guarda = <T,>(x: T): T => { basura.push(x); return x }
  const avisos: string[] = []
  try {
    const todo = guarda(aManifold(w, m))
    if (todo.isEmpty()) throw new Error("El modelo quedó vacío al leerlo. Revisa que sea un sólido cerrado.")
    const caja = todo.boundingBox()
    const min = caja.min as number[], max = caja.max as number[]
    const cortes = op.cortes
      .filter((c) => c.pos > min[c.eje] + 0.5 && c.pos < max[c.eje] - 0.5)
      .sort((a, b) => a.eje - b.eje || a.pos - b.pos)

    // Medidas del conector
    const imanes = op.conector === "imanes"
    const rAguj = imanes ? op.imanD / 2 + op.holgura : op.diametro / 2 + op.holgura
    // mitad del perno: no más del 40 % del tramo más corto junto a cada corte
    let mitad = imanes ? op.imanH + 0.3 : op.largo / 2
    for (const c of cortes) {
      const vecinos = [min[c.eje], max[c.eje], ...cortes.filter((d) => d.eje === c.eje).map((d) => d.pos)]
      const antes = Math.max(...vecinos.filter((p) => p < c.pos - 1e-6))
      const despues = Math.min(...vecinos.filter((p) => p > c.pos + 1e-6))
      mitad = Math.min(mitad, 0.4 * (c.pos - antes), 0.4 * (despues - c.pos))
    }
    const conConector = op.conector !== "ninguno" && cortes.length > 0
    if (conConector && imanes && mitad < op.imanH + 0.3 - 1e-6) avisos.push("Algunas piezas son muy delgadas para el imán: el hueco quedó menos profundo.")
    if (conConector && !imanes && mitad < 3) avisos.push("Las piezas son delgadas junto al corte: los pernos quedaron cortos.")

    let piezas: any[] = [todo]
    let conectores = 0
    let sinConector = 0
    const seg = 24
    for (const c of cortes) {
      const otros = cortes.filter((d) => d.eje !== c.eje)
      const siguientes: any[] = []
      for (const p of piezas) {
        const b = p.boundingBox()
        if (!(b.min[c.eje] < c.pos - 1e-6 && b.max[c.eje] > c.pos + 1e-6)) { siguientes.push(p); continue }
        const [arriba, abajo] = p.splitByPlane(a3D(c.eje, 0, 0, 1), c.pos).map(guarda)
        if (arriba.isEmpty() || abajo.isEmpty()) { siguientes.push(p); continue }
        let A = arriba, B = abajo
        if (conConector) {
          const girada = guarda(p.transform(MATRIZ[c.eje]))
          const seccion = guarda(girada.slice(c.pos))
          // no poner conectores donde otro corte (de otro eje) los partiría
          const evitar = (u: number, v: number) => {
            const q = a3D(c.eje, u, v, c.pos)
            return otros.some((d) => Math.abs(q[d.eje] - d.pos) < rAguj + PARED)
          }
          const puntos = puntosConector(seccion, rAguj, Math.max(3 * rAguj * 2, 15), evitar)
          if (!puntos.length) sinConector++
          for (const [u, v] of puntos) {
            // cilindro a lo largo del eje del corte, centrado en el plano
            const cil = (r: number, largo: number, desde: number) => {
              const z = guarda(Manifold.cylinder(largo, r, r, seg, false))
              const t = guarda(z.translate([u, v, desde]))
              // de vuelta a coordenadas del modelo (inversa = transpuesta)
              return guarda(t.transform(transpuesta(MATRIZ[c.eje])))
            }
            if (op.conector === "integrado") {
              const perno = cil(op.diametro / 2, mitad, c.pos - 0.01)
              const aguj = cil(rAguj, mitad + 0.4, c.pos - 0.01)
              B = guarda(B.add(perno))
              A = guarda(A.subtract(aguj))
            } else {
              const prof = imanes ? mitad : mitad + 0.4
              const aguj = cil(rAguj, 2 * prof, c.pos - prof)
              A = guarda(A.subtract(aguj))
              B = guarda(B.subtract(aguj))
            }
            conectores++
          }
        }
        siguientes.push(A, B)
      }
      piezas = siguientes
    }

    // Las piezas que el corte separó en varias partes sueltas se entregan por separado
    const sueltas: any[] = []
    for (const p of piezas) {
      const partes = p.decompose().map(guarda)
      for (const q of partes) if (!q.isEmpty() && q.volume() > 1) sueltas.push(q)
    }

    // Nombre por posición en la rejilla de cortes: X1-Y2-Z1
    const posiciones = [0, 1, 2].map((e) => cortes.filter((c) => c.eje === e).map((c) => c.pos))
    const usados = new Map<string, number>()
    const res: Pieza[] = sueltas.map((s) => {
      const b = s.boundingBox()
      const centro = [0, 1, 2].map((e) => (b.min[e] + b.max[e]) / 2)
      const partes = [0, 1, 2]
        .filter((e) => posiciones[e].length)
        .map((e) => `${EJES[e]}${posiciones[e].filter((p) => p < centro[e]).length + 1}`)
      let nombre = partes.join("-") || "pieza"
      const n = (usados.get(nombre) || 0) + 1
      usados.set(nombre, n)
      if (n > 1) nombre += `-${String.fromCharCode(96 + n)}`
      return { nombre, malla: aMalla(s), tam: [0, 1, 2].map((e) => redondear(b.max[e] - b.min[e])) as [number, number, number] }
    })
    res.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }))

    // Perno suelto (con una pequeña punta achaflanada para que entre fácil)
    let perno: Malla | null = null
    const pernoLargo = redondear(2 * mitad)
    if (op.conector === "pernos" && conectores) {
      const r = op.diametro / 2
      const cuerpo = guarda(Manifold.cylinder(2 * mitad - 1, r, r, seg, false).translate([0, 0, 0.5]))
      const punta1 = guarda(Manifold.cylinder(0.5, r - 0.4, r, seg, false))
      const punta2 = guarda(Manifold.cylinder(0.5, r, r - 0.4, seg, false).translate([0, 0, 2 * mitad - 0.5]))
      perno = aMalla(guarda(Manifold.union([cuerpo, punta1, punta2])))
    }
    if (conConector && !conectores) avisos.push(`Las paredes son muy delgadas para ${imanes ? "estos imanes" : `pernos de ${op.diametro} mm`} (necesitan ${r1(2 * (rAguj + PARED))} mm de grosor): las caras quedaron planas para pegar. Prueba ${imanes ? "imanes más chicos" : "un diámetro menor"}.`)
    else if (conConector && sinConector) avisos.push(`${sinConector === 1 ? "Una unión quedó" : `${sinConector} uniones quedaron`} sin conector porque la pared es delgada (necesitan ${r1(2 * (rAguj + PARED))} mm de grosor): pégalas o prueba ${imanes ? "imanes más chicos" : "un diámetro menor"}.`)
    return { piezas: res, conectores, perno, pernoLargo, avisos }
  } finally {
    for (const x of basura) { try { x?.delete?.() } catch {} }
  }
}

function transpuesta(m: number[]) {
  const t = new Array(16)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) t[i * 4 + j] = m[j * 4 + i]
  return t
}
