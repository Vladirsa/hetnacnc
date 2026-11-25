// Generador de moldes (3D Studio): de un modelo 3D (STL u OBJ) al molde para
// vaciar silicona, resina, yeso, concreto, jabón o chocolate. Tres tipos:
//   - dos_partes: bloque alrededor de la pieza partido en dos a la altura que
//     se elija, con llaves de registro (esferas) para que embonen, bebedero con
//     embudo para vaciar y respiraderos para que salga el aire.
//   - abierto: molde de una pieza, abierto por arriba (para piezas con una
//     cara plana: jabones, velas, posavasos, macetas).
//   - caja_silicona: la caja para colar silicona alrededor de tu pieza, con la
//     pieza pegada al piso (se imprimen juntas); luego haces el molde de
//     silicona dentro.
// Usa manifold-3d (el mismo de Partir 3D): restas y cortes exactos en el
// navegador. Todo en milímetros. Z hacia arriba.
import { aMalla, aManifold, cargarManifold } from "@/lib/generador/partir3d"
import type { Malla } from "@/lib/generador/vectores"

export type TipoMolde = "dos_partes" | "abierto" | "caja_silicona"
/** Qué lado del modelo queda hacia arriba en el molde. */
export type Arriba = "z" | "-z" | "y" | "-y" | "x" | "-x"

export type OpcionesMolde = {
  tipo: TipoMolde
  arriba: Arriba
  pared: number // mm de material alrededor de la pieza (en la caja: grosor de sus paredes)
  particion: number // % de la altura de la pieza donde se parte (dos_partes)
  llaves: boolean
  diametroLlave: number
  holgura: number // mm entre la llave y su hueco
  bebedero: boolean
  diametroBebedero: number
  respiraderos: number // cuántos (0–4)
  diametroRespiradero: number
  espacio: number // mm de silicona alrededor de la pieza (caja_silicona)
}

export const OPCIONES_MOLDE: OpcionesMolde = {
  tipo: "dos_partes",
  arriba: "z",
  pared: 10,
  particion: 50,
  llaves: true,
  diametroLlave: 8,
  holgura: 0.3,
  bebedero: true,
  diametroBebedero: 8,
  respiraderos: 2,
  diametroRespiradero: 3,
  espacio: 10,
}

export type PiezaMolde = {
  nombre: string
  malla: Malla
  tam: [number, number, number]
  /** Se imprime volteada (la cara de partición sobre la cama). */
  voltear: boolean
}
export type ResultadoMolde = {
  piezas: PiezaMolde[]
  /** Pieza ya orientada, para la vista. */
  modelo: Malla
  /** ml que se vacían: resina/yeso en los moldes, silicona en la caja. */
  colado: number
  /** Altura (mm) del plano de partición, para separar las mitades en la vista. */
  particionZ: number | null
  avisos: string[]
}

const acotar = (x: number, min: number, max: number, omision: number) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : omision)
const r1 = (n: number) => Math.round(n * 10) / 10
const SEG = 32

/** Gira el modelo para que el lado elegido quede hacia +Z (matriz 4×4 en columnas, como manifold). */
const GIROS: Record<Arriba, [number, number, number]> = { z: [0, 0, 0], "-z": [180, 0, 0], y: [-90, 0, 0], "-y": [90, 0, 0], x: [0, 90, 0], "-x": [0, -90, 0] }

/**
 * Puntos más altos de la pieza (para el bebedero y los respiraderos): el más
 * alto y luego los más altos que estén lejos de los ya elegidos.
 */
export function puntosAltos(tris: number[], n: number, separacion: number): [number, number, number][] {
  const vs: [number, number, number][] = []
  for (let i = 0; i < tris.length; i += 3) vs.push([tris[i], tris[i + 1], tris[i + 2]])
  vs.sort((a, b) => b[2] - a[2])
  const elegidos: [number, number, number][] = []
  for (const v of vs) {
    if (elegidos.length >= n) break
    if (elegidos.every((e) => Math.hypot(e[0] - v[0], e[1] - v[1]) >= separacion)) elegidos.push(v)
  }
  return elegidos
}

export async function hacerMolde(entrada: Malla, o0: Partial<OpcionesMolde>): Promise<ResultadoMolde> {
  const o: OpcionesMolde = { ...OPCIONES_MOLDE, ...o0 }
  const tipo = o.tipo
  const pared = acotar(o.pared, 2, 100, tipo === "caja_silicona" ? 3 : 10)
  const particion = acotar(o.particion, 5, 95, 50)
  const holgura = acotar(o.holgura, 0, 2, 0.3)
  const espacio = acotar(o.espacio, 3, 100, 10)
  const avisos: string[] = []

  const w = await cargarManifold()
  const { Manifold } = w
  const basura: any[] = []
  const g = <T,>(x: T): T => { basura.push(x); return x }
  try {
    // 1. La pieza, orientada y con su base en z = 0, centrada en x/y
    let pieza = g(aManifold(w, entrada))
    if (pieza.isEmpty()) throw new Error("El modelo quedó vacío al leerlo. Revisa que sea un sólido cerrado.")
    const [gx, gy, gz] = GIROS[o.arriba] || GIROS.z
    if (gx || gy || gz) pieza = g(pieza.rotate([gx, gy, gz]))
    const b0 = pieza.boundingBox()
    pieza = g(pieza.translate([-(b0.min[0] + b0.max[0]) / 2, -(b0.min[1] + b0.max[1]) / 2, -b0.min[2]]))
    const b = pieza.boundingBox()
    const [x0, y0] = [b.min[0], b.min[1]]
    const [x1, y1, H] = [b.max[0], b.max[1], b.max[2]]
    const volPieza = pieza.volume()
    const modelo = aMalla(pieza)
    if (Math.max(x1 - x0, y1 - y0, H) < 5) avisos.push("La pieza mide menos de 5 mm: revisa que el archivo esté en milímetros.")

    const piezas: PiezaMolde[] = []
    const salida = (nombre: string, s: any, voltear = false) => {
      const bb = s.boundingBox()
      piezas.push({ nombre, malla: aMalla(s), tam: [0, 1, 2].map((e) => r1(bb.max[e] - bb.min[e])) as [number, number, number], voltear })
    }
    let colado = volPieza
    let particionZ: number | null = null

    if (tipo === "caja_silicona") {
      // Caja abierta: piso + 4 paredes; la pieza pegada al piso (se imprimen juntas)
      const ix0 = x0 - espacio, iy0 = y0 - espacio, ix1 = x1 + espacio, iy1 = y1 + espacio
      const alto = H + espacio
      const fuera = g(Manifold.cube([ix1 - ix0 + 2 * pared, iy1 - iy0 + 2 * pared, alto + pared]).translate([ix0 - pared, iy0 - pared, -pared]))
      const hueco = g(Manifold.cube([ix1 - ix0, iy1 - iy0, alto + 1]).translate([ix0, iy0, 0]))
      // la pieza baja 0.2 mm dentro del piso para que quede unida
      const caja = g(g(fuera.subtract(hueco)).add(g(pieza.translate([0, 0, -0.2]))))
      salida("caja-silicona", caja)
      colado = (ix1 - ix0) * (iy1 - iy0) * alto - volPieza
      avisos.push(`Llena la caja hasta ${r1(alto)} mm de alto: cubre la pieza con ${r1(espacio)} mm de silicona encima.`)
    } else if (tipo === "abierto") {
      // Bloque hasta un pelo abajo del tope de la pieza: la cara de arriba queda abierta
      const bloque = g(Manifold.cube([x1 - x0 + 2 * pared, y1 - y0 + 2 * pared, H + pared - 0.01]).translate([x0 - pared, y0 - pared, -pared]))
      salida("molde", g(bloque.subtract(pieza)))
      avisos.push("Molde abierto: la cara de arriba de la pieza es la que queda al aire. Sirve para piezas que salen hacia arriba sin atorarse (sin partes que se metan por debajo).")
    } else {
      // Dos partes
      const zp = (H * particion) / 100
      particionZ = zp
      const bloque = g(Manifold.cube([x1 - x0 + 2 * pared, y1 - y0 + 2 * pared, H + 2 * pared]).translate([x0 - pared, y0 - pared, -pared]))
      const zTope = H + pared
      let molde = g(bloque.subtract(pieza))
      // Bebedero (con embudo) y respiraderos: de los puntos más altos de la pieza a la cara de arriba
      const rb = acotar(o.diametroBebedero, 2, 40, 8) / 2
      const rv = acotar(o.diametroRespiradero, 1, 20, 3) / 2
      const nv = Math.round(acotar(o.respiraderos, 0, 4, 2))
      const altos = puntosAltos(modelo.tris, (o.bebedero ? 1 : 0) + nv, Math.max(10, 4 * rb))
      const canales: any[] = []
      altos.forEach((p, i) => {
        const esBebedero = o.bebedero && i === 0
        const r = esBebedero ? rb : rv
        const desde = Math.max(zp + 0.5, p[2] - 0.8)
        canales.push(g(Manifold.cylinder(zTope - desde + 0.1, r, r, SEG).translate([p[0], p[1], desde])))
        if (esBebedero) {
          const alto = Math.min(pared * 0.6, 3 * rb)
          canales.push(g(Manifold.cylinder(alto + 0.1, r, 2 * r, SEG).translate([p[0], p[1], zTope - alto])))
        }
      })
      if (o.bebedero && !altos.length) avisos.push("No se encontró dónde poner el bebedero: hazlo a mano en tu programa.")
      if (nv && altos.length < (o.bebedero ? 1 : 0) + nv) avisos.push("La pieza es chica: cupieron menos respiraderos de los pedidos.")
      if (canales.length) molde = g(molde.subtract(g(Manifold.union(canales))))
      // Partir por el plano
      let abajo = g(molde.trimByPlane([0, 0, -1], -zp))
      let arriba = g(molde.trimByPlane([0, 0, 1], zp))
      // Llaves de registro: esferas en las cuatro esquinas, dentro de la pared
      if (o.llaves) {
        const rk = Math.min(acotar(o.diametroLlave, 2, 30, 8) / 2, pared / 2 - 1.5)
        if (rk < 1.5) avisos.push(`La pared es muy delgada para las llaves de registro: súbela a ${Math.ceil(2 * (1.5 + 1.5))} mm o más.`)
        else {
          if (rk < acotar(o.diametroLlave, 2, 30, 8) / 2) avisos.push(`Las llaves se achicaron a ${r1(2 * rk)} mm para que quepan en la pared de ${pared} mm.`)
          const m = pared / 2
          const esquinas: [number, number][] = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]]
          for (const [x, y] of esquinas) {
            const bola = g(g(Manifold.sphere(rk, SEG)).translate([x, y, zp]))
            abajo = g(abajo.add(g(bola.trimByPlane([0, 0, 1], zp))))
            arriba = g(arriba.subtract(g(g(Manifold.sphere(rk + holgura, SEG)).translate([x, y, zp]))))
          }
        }
      }
      if (abajo.isEmpty() || arriba.isEmpty()) throw new Error("No se pudo partir el molde a esa altura. Prueba otra altura de partición.")
      salida("molde-abajo", abajo)
      salida("molde-arriba", arriba, true)
      avisos.push(`El molde se parte a ${r1(zp)} mm de la base de la pieza. Si la pieza se atora al abrirlo, mueve la partición a la parte más ancha.`)
    }

    return { piezas, modelo, colado: r1(colado / 1000), particionZ, avisos }
  } finally {
    for (const x of basura) { try { (x as any)?.delete?.() } catch {} }
  }
}

/** La malla girada 180° en X y apoyada en z = 0 (para imprimir la mitad de arriba con la cara de partición sobre la cama). */
export function volteada(m: Malla): Malla {
  const t = m.tris
  let zMax = -Infinity
  for (let i = 2; i < t.length; i += 3) zMax = Math.max(zMax, t[i])
  const out = new Array(t.length)
  // girar 180° en X: (x, y, z) → (x, −y, −z); conserva la orientación de las caras
  for (let i = 0; i < t.length; i += 3) {
    out[i] = t[i]
    out[i + 1] = -t[i + 1]
    out[i + 2] = zMax - t[i + 2]
  }
  return { tris: out, avisos: [] }
}
