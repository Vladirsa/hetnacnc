// Generador de moldes (3D Studio): de un modelo 3D (STL u OBJ) al molde para
// vaciar silicona, resina, yeso, concreto, jabón o chocolate. Tres tipos:
//   - dos_partes: bloque alrededor de la pieza partido en dos a la altura que
//     se elija, con llaves de registro (esferas) para que embonen, bebedero con
//     embudo para vaciar y respiraderos para que salga el aire.
//     Con orejas en la unión para cerrarlo con pinzas de papelería.
//   - abierto: molde de una pieza, abierto por arriba (para piezas con una
//     cara plana: jabones, velas, posavasos, macetas). Puede llevar núcleo
//     para que la pieza salga hueca (maceta de cemento boca abajo) y un perno
//     de drenaje que deja el agujero de desagüe.
//   - caja_silicona: la caja para colar silicona alrededor de tu pieza, con la
//     pieza pegada al piso (se imprimen juntas); luego haces el molde de
//     silicona dentro.
// Usa manifold-3d (el mismo de Partir 3D): restas y cortes exactos en el
// navegador. Todo en milímetros. Z hacia arriba.
import { aMalla, aManifold, cargarManifold } from "@/lib/generador/partir3d"
import { type Desmoldeo, nucleoAtorado, revisarDesmoldeo } from "@/lib/generador/desmoldeo"
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
  orejas: boolean // pestañas en la unión para cerrar con pinzas (dos_partes)
  hueco: boolean // núcleo para que la pieza salga hueca (abierto)
  grosorHueco: number // mm de pared de la pieza hueca
  drenaje: boolean // perno que deja el agujero de desagüe (con hueco)
  diametroDrenaje: number
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
  orejas: true,
  hueco: false,
  grosorHueco: 8,
  drenaje: true,
  diametroDrenaje: 10,
}

export type PiezaMolde = {
  nombre: string
  malla: Malla
  tam: [number, number, number]
  /** Se imprime volteada (la cara de afuera sobre la cama y la de partición hacia arriba). */
  voltear: boolean
  /** Qué va sobre la cama al imprimirla volteada: la cara de afuera (mitad de arriba) o la tapa (núcleo). */
  cama?: "afuera" | "tapa"
}
export type ResultadoMolde = {
  /** Con qué tipo se armó (las opciones pueden haber cambiado después). */
  tipo: TipoMolde
  piezas: PiezaMolde[]
  /** Pieza ya orientada, para la vista. */
  modelo: Malla
  /** ml que se vacían: resina/yeso en los moldes, silicona en la caja. */
  colado: number
  /** Altura (mm) del plano de partición, para separar las mitades en la vista. */
  particionZ: number | null
  /** ¿Sale sin atorarse? (abierto y dos partes; lib/generador/desmoldeo.ts) */
  desmoldeo: Desmoldeo | null
  avisos: string[]
}

const acotar = (x: number, min: number, max: number, omision: number) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : omision)
const r1 = (n: number) => Math.round(n * 10) / 10
const SEG = 32

/** Gira el modelo para que el lado elegido quede hacia +Z (matriz 4×4 en columnas, como manifold). */
const GIROS: Record<Arriba, [number, number, number]> = { z: [0, 0, 0], "-z": [180, 0, 0], y: [90, 0, 0], "-y": [-90, 0, 0], x: [0, -90, 0], "-x": [0, 90, 0] }

/**
 * Puntos para el bebedero y los respiraderos: primero las cimas (puntos más
 * altos que sus vecinos en una rejilla en XY), de la más alta a la más baja, y
 * luego el resto; siempre separados entre sí y lejos de las zonas a evitar.
 */
// candidatos de más por canal: algunos no tocan la cavidad y se descartan
const CANDIDATOS_POR_CANAL = 3

export function puntosAltos(
  tris: number[],
  n: number,
  separacion: number,
  { zMin = -Infinity, evitar = [] }: { zMin?: number; evitar?: [number, number, number][] } = {},
): [number, number, number][] {
  // Rejilla en XY con el punto más alto de cada celda; una celda es "cima" si
  // ninguna vecina es más alta. Así los respiraderos van a las crestas
  // (donde se atrapa el aire) y no a la ladera del punto más alto.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < tris.length; i += 3) {
    x0 = Math.min(x0, tris[i]); x1 = Math.max(x1, tris[i])
    y0 = Math.min(y0, tris[i + 1]); y1 = Math.max(y1, tris[i + 1])
  }
  if (!isFinite(x0)) return []
  const lado = Math.max(1, separacion / 3)
  const nx = Math.max(1, Math.ceil((x1 - x0) / lado) + 1), ny = Math.max(1, Math.ceil((y1 - y0) / lado) + 1)
  const celdas = new Map<number, [number, number, number]>()
  const anotar = (x: number, y: number, z: number) => {
    const k = Math.floor((x - x0) / lado) + nx * Math.floor((y - y0) / lado)
    const c = celdas.get(k)
    if (!c || z > c[2]) celdas.set(k, [x, y, z])
  }
  for (let i = 0; i < tris.length; i += 3) anotar(tris[i], tris[i + 1], tris[i + 2])
  // Además, el centro de cada celda sobre las caras que miran hacia arriba: en
  // piezas de pocos triángulos (un cubo) los vértices sólo están en las esquinas
  for (let t = 0; t < tris.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [tris[t], tris[t + 1], tris[t + 2], tris[t + 3], tris[t + 4], tris[t + 5], tris[t + 6], tris[t + 7], tris[t + 8]]
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if (d <= 1e-9) continue // de canto o mirando hacia abajo
    const i0 = Math.floor((Math.min(ax, bx, cx) - x0) / lado), i1 = Math.floor((Math.max(ax, bx, cx) - x0) / lado)
    const j0 = Math.floor((Math.min(ay, by, cy) - y0) / lado), j1 = Math.floor((Math.max(ay, by, cy) - y0) / lado)
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const x = x0 + (i + 0.5) * lado, y = y0 + (j + 0.5) * lado
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d
        const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d
        if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue
        anotar(x, y, l1 * az + l2 * bz + (1 - l1 - l2) * cz)
      }
  }
  const cimas: [number, number, number][] = []
  const resto: [number, number, number][] = []
  celdas.forEach((v, k) => {
    const cx = k % nx, cy = Math.floor(k / nx)
    let cima = true
    for (let dx = -1; dx <= 1 && cima; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if ((!dx && !dy) || cx + dx < 0 || cy + dy < 0 || cx + dx >= nx || cy + dy >= ny) continue
        const w = celdas.get(cx + dx + nx * (cy + dy))
        if (w && w[2] > v[2] + 1e-6) { cima = false; break }
      }
    ;(cima ? cimas : resto).push(v)
  })
  const porAltura = (a: [number, number, number], b: [number, number, number]) => b[2] - a[2]
  cimas.sort(porAltura)
  resto.sort(porAltura)
  const elegidos: [number, number, number][] = []
  for (const v of [...cimas, ...resto]) {
    if (elegidos.length >= n) break
    if (v[2] < zMin) continue
    if (evitar.some(([x, y, r]) => Math.hypot(x - v[0], y - v[1]) < r)) continue
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
    // la pieza ya leída y sin girar (caras orientadas hacia afuera), para revisar el desmoldeo
    const sinGirar = aMalla(pieza)
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
    const salida = (nombre: string, s: any, voltear = false, cama?: PiezaMolde["cama"]) => {
      const bb = s.boundingBox()
      piezas.push({ nombre, malla: aMalla(s), tam: [0, 1, 2].map((e) => r1(bb.max[e] - bb.min[e])) as [number, number, number], voltear, ...(cama ? { cama } : {}) })
    }
    let colado = volPieza
    let particionZ: number | null = null
    // con núcleo: la pieza que de verdad sale (hueca), para revisar el desmoldeo
    let hueca: { volume(): number } | null = null

    if (tipo === "caja_silicona") {
      // Caja abierta: piso + 4 paredes; la pieza pegada al piso (se imprimen juntas)
      const ix0 = x0 - espacio, iy0 = y0 - espacio, ix1 = x1 + espacio, iy1 = y1 + espacio
      const alto = H + espacio
      const fuera = g(g(Manifold.cube([ix1 - ix0 + 2 * pared, iy1 - iy0 + 2 * pared, alto + pared])).translate([ix0 - pared, iy0 - pared, -pared]))
      const hueco = g(g(Manifold.cube([ix1 - ix0, iy1 - iy0, alto + 1])).translate([ix0, iy0, 0]))
      // la pieza baja 0.2 mm dentro del piso para que quede unida
      const caja = g(g(fuera.subtract(hueco)).add(g(pieza.translate([0, 0, -0.2]))))
      salida("caja-silicona", caja)
      colado = (ix1 - ix0) * (iy1 - iy0) * alto - volPieza
      avisos.push(`Llena la caja hasta ${r1(alto)} mm de alto: cubre la pieza con ${r1(espacio)} mm de silicona encima.`)
    } else if (tipo === "abierto") {
      // Bloque hasta un pelo abajo del tope de la pieza: la cara de arriba queda abierta
      const bloque = g(g(Manifold.cube([x1 - x0 + 2 * pared, y1 - y0 + 2 * pared, H + pared - 0.01])).translate([x0 - pared, y0 - pared, -pared]))
      let molde = g(bloque.subtract(pieza))
      if (o.hueco) {
        // Pieza hueca (maceta de cemento): la pieza va boca arriba en el molde y
        // un núcleo aparte cuelga de una tapa que se apoya en el borde del molde
        // (con 4 pernos para centrarla). Se cuela el material, se mete el núcleo
        // y el sobrante sube por los agujeros de la tapa.
        const grosor = acotar(o.grosorHueco, 2, 60, 8)
        const ancho = x1 - x0, largo = y1 - y0
        if (ancho - 2 * grosor < 4 || largo - 2 * grosor < 4 || H - grosor < 4) {
          avisos.push(`La pieza es muy chica para hacerla hueca con pared de ${grosor} mm: baja el grosor.`)
        } else {
          // la pieza encogida desde su centro: pared = grosor en la parte más ancha, fondo = grosor
          const sx = (ancho - 2 * grosor) / ancho, sy = (largo - 2 * grosor) / largo
          // sube 0.2 mm arriba de H para entrar en la tapa y quedar unido a ella
          const nucleo = g(g(pieza.scale([sx, sy, (H - grosor + 0.2) / H])).translate([0, 0, grosor]))
          const huecaM = g(pieza.subtract(nucleo))
          // En piezas que no son simétricas (taza con asa, una "L") el núcleo
          // encogido desde el centro se sale de la pieza: entonces no sirve
          const fuera = g(g(nucleo.subtract(pieza)).trimByPlane([0, 0, -1], -(H - 0.01))).volume()
          if (fuera > Math.max(1, nucleo.volume() * 0.002)) {
            avisos.push("Esta forma no se puede hacer hueca con núcleo: no es pareja alrededor de su centro (asas, salientes o formas en L) y el núcleo se saldría por la pared. Funciona con macetas, vasos, cajas y formas así.")
          } else {
          hueca = huecaM
          colado = huecaM.volume()
          const tapaAlto = 4
          const huella = (z0: number, alto: number) => g(g(Manifold.cube([ancho + 2 * pared, largo + 2 * pared, alto])).translate([x0 - pared, y0 - pared, z0]))
          // el núcleo sube 0.2 mm dentro de la tapa para quedar unido
          let pieNucleo = g(g(nucleo.intersect(huella(grosor, H - grosor + 0.2))).add(huella(H, tapaAlto)))
          // pernos de centrado en las esquinas (en la pared del molde)
          const rp = Math.min(2.5, pared / 2 - 1)
          const m0 = pared / 2
          if (rp >= 1 && rp + holgura <= m0 - 1) {
            const m = pared / 2
            for (const [x, y] of [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]] as [number, number][]) {
              pieNucleo = g(pieNucleo.add(g(g(Manifold.cylinder(4.2, rp, rp * 0.8, SEG)).translate([x, y, H - 4]))))
              molde = g(molde.subtract(g(g(Manifold.cylinder(5.2, rp + holgura, rp + holgura, SEG)).translate([x, y, H - 5]))))
            }
          } else avisos.push("La pared del molde es muy delgada para los pernos que centran la tapa: súbela a 8 mm o más, o céntrala a ojo.")
          // agujeros en la tapa sobre la pared de la pieza, para que salga el sobrante
          const rh = Math.min(5, grosor * 0.45)
          let agujeros = 0
          for (const [x, y] of [[x1 - grosor / 2, 0], [x0 + grosor / 2, 0], [0, y1 - grosor / 2], [0, y0 + grosor / 2]] as [number, number][]) {
            const tubo = g(g(Manifold.cylinder(tapaAlto + 2, rh, rh, SEG)).translate([x, y, H - 1]))
            if (g(tubo.intersect(huecaM)).volume() < 0.01) continue // ahí no hay pared
            pieNucleo = g(pieNucleo.subtract(tubo))
            agujeros++
          }
          if (o.drenaje) {
            // perno un poco cónico (sale fácil) desde la punta del núcleo hasta el piso del molde
            const rd = Math.min(acotar(o.diametroDrenaje, 3, 40, 10) / 2, (Math.min(ancho, largo) - 2 * grosor) / 4)
            const perno = g(g(Manifold.cylinder(grosor + 1, rd * 0.85, rd, SEG)).translate([0, 0, 0.01]))
            const enFondo = g(perno.intersect(huecaM)).volume()
            if (enFondo < 0.01 || g(nucleo.intersect(g(perno.translate([0, 0, 0.5])))).volume() < 0.01)
              avisos.push("No se encontró dónde poner el drenaje en el centro del fondo: hazlo con taladro después.")
            else {
              pieNucleo = g(pieNucleo.add(perno))
              colado -= enFondo
              avisos.push(`Drenaje de ${r1(2 * rd)} mm en el centro del fondo.`)
            }
          }
          if (pieNucleo.decompose().length > 1) {
            // el núcleo no llega a la tapa: la boca de la pieza no es plana arriba
            hueca = null
            colado = volPieza
            avisos.push("Para hacerla hueca, la boca de la pieza tiene que ser plana y quedar arriba (paso 2). Con esta forma el núcleo quedaría suelto de la tapa.")
          } else {
            salida("nucleo", pieNucleo, true, "tapa")
            avisos.push(
              `Pieza hueca: pared de unos ${grosor} mm donde la pieza es más ancha (más delgada donde se angosta) y ${grosor} mm de fondo. Cuela el material, mete el núcleo con la tapa sobre el molde y, ya seco, saca primero el núcleo y luego la pieza.`
            )
            if (!agujeros) avisos.push(`La tapa no lleva agujeros para el sobrante: vacía sólo unos ${r1(colado / 1000)} ml antes de meter el núcleo.`)
          }
          }
        }
      }
      salida("molde", molde)
      avisos.push("Molde abierto: la cara de arriba de la pieza es la que queda al aire.")
    } else {
      // Dos partes
      const zp = (H * particion) / 100
      particionZ = zp
      const bloque = g(g(Manifold.cube([x1 - x0 + 2 * pared, y1 - y0 + 2 * pared, H + 2 * pared])).translate([x0 - pared, y0 - pared, -pared]))
      const zTope = H + pared
      let molde = g(bloque.subtract(pieza))
      // Llaves de registro: esferas en las cuatro esquinas, dentro de la pared
      const dLlave = acotar(o.diametroLlave, 2, 30, 8)
      const rk = Math.min(dLlave / 2, pared / 2 - 1.5)
      const m = pared / 2
      const esquinas: [number, number][] = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]]
      const conLlaves = o.llaves && rk >= 1.5
      // Bebedero (con embudo) y respiraderos: de las cimas de la mitad de arriba a la cara de arriba
      const rb = acotar(o.diametroBebedero, 2, 40, 8) / 2
      const rv = acotar(o.diametroRespiradero, 1, 20, 3) / 2
      const nv = Math.round(acotar(o.respiraderos, 0, 4, 2))
      const pedidos = (o.bebedero ? 1 : 0) + nv
      const canales: any[] = []
      if (pedidos && H - zp < 1) avisos.push("La partición quedó casi en el tope de la pieza: no caben bebedero ni respiraderos. Bájala.")
      else if (pedidos) {
        const rMax = o.bebedero ? rb : rv
        const evitar: [number, number, number][] = conLlaves ? esquinas.map(([x, y]) => [x, y, rk + holgura + rMax + 1]) : []
        const altos = puntosAltos(modelo.tris, pedidos * CANDIDATOS_POR_CANAL, Math.max(8, 4 * rv, 2 * (rb + rv) + 2), { zMin: zp + 1, evitar })
        let colocados = 0
        for (const p of altos) {
          if (colocados >= pedidos) break
          const esBebedero = o.bebedero && colocados === 0
          const r = esBebedero ? rb : rv
          const desde = Math.max(zp + 0.1, p[2] - 0.8)
          const tubo = g(g(Manifold.cylinder(zTope - desde + 0.1, r, r, SEG)).translate([p[0], p[1], desde]))
          // el canal tiene que tocar la cavidad, si no es un agujero ciego
          if (g(tubo.intersect(pieza)).volume() < 0.01) continue
          canales.push(tubo)
          if (esBebedero) {
            const alto = Math.min(pared * 0.6, 3 * rb)
            canales.push(g(g(Manifold.cylinder(alto + 0.1, r, Math.min(2 * r, r + pared / 2), SEG)).translate([p[0], p[1], zTope - alto])))
          }
          colocados++
        }
        if (o.bebedero && !colocados) avisos.push("No se encontró dónde poner el bebedero: hazlo a mano en tu programa o mueve la partición.")
        else if (colocados < pedidos) avisos.push("La pieza es chica: cupieron menos respiraderos de los pedidos.")
      }
      if (canales.length) molde = g(molde.subtract(g(Manifold.union(canales))))
      // Partir por el plano
      let abajo = g(molde.trimByPlane([0, 0, -1], -zp))
      let arriba = g(molde.trimByPlane([0, 0, 1], zp))
      if (o.llaves) {
        if (!conLlaves) avisos.push(`La pared es muy delgada para las llaves de registro: súbela a ${Math.ceil(2 * (1.5 + 1.5))} mm o más.`)
        else {
          if (rk < dLlave / 2) avisos.push(`Las llaves se achicaron a ${r1(2 * rk)} mm para que quepan en la pared de ${pared} mm.`)
          for (const [x, y] of esquinas) {
            const bola = g(g(Manifold.sphere(rk, SEG)).translate([x, y, zp]))
            // la media esfera entra 0.2 mm en la mitad de abajo para quedar unida a ella
            abajo = g(abajo.add(g(bola.trimByPlane([0, 0, 1], zp - 0.2))))
            arriba = g(arriba.subtract(g(g(Manifold.sphere(rk + holgura, SEG)).translate([x, y, zp]))))
          }
        }
      }
      if (o.orejas) {
        // Orejas para pinzas de papelería: una pestaña por lado a media pared,
        // lejos de las llaves de las esquinas. Por debajo llevan un chaflán a 45°
        // para imprimirse sin soportes (cada mitad se imprime con la unión arriba).
        const t = 5, L0 = 12
        const bx0 = x0 - pared, bx1 = x1 + pared, by0 = y0 - pared, by1 = y1 + pared
        const zAbajo = zp + pared, zArriba = H - zp + pared // alto de cada mitad
        const lados: { u: [number, number]; centro: [number, number]; largo: number }[] = [
          { u: [1, 0], centro: [bx1, (by0 + by1) / 2], largo: by1 - by0 },
          { u: [-1, 0], centro: [bx0, (by0 + by1) / 2], largo: by1 - by0 },
          { u: [0, 1], centro: [(bx0 + bx1) / 2, by1], largo: bx1 - bx0 },
          { u: [0, -1], centro: [(bx0 + bx1) / 2, by0], largo: bx1 - bx0 },
        ]
        const oreja = (l: (typeof lados)[number], sentido: 1 | -1, altoMitad: number) => {
          // el chaflán no puede salir de la mitad (la otra cara va sobre la cama)
          const L = Math.min(L0, altoMitad - t - 0.5)
          const ancho = Math.min(30, l.largo * 0.4)
          const v: [number, number] = [-l.u[1], l.u[0]]
          const pt = (afuera: number, lado: number, dz: number): [number, number, number] => [
            l.centro[0] + l.u[0] * afuera + v[0] * lado,
            l.centro[1] + l.u[1] * afuera + v[1] * lado,
            zp + sentido * dz, // dz es 0 o negativo: sentido 1 baja, -1 sube
          ]
          const pts: [number, number, number][] = []
          for (const lado of [-ancho / 2, ancho / 2]) {
            pts.push(pt(-0.3, lado, 0), pt(L, lado, 0), pt(L, lado, -t), pt(-0.3, lado, -t - L))
          }
          return g(Manifold.hull(pts))
        }
        // sentido 1: la oreja baja desde la unión (mitad de abajo); -1: sube (mitad de arriba)
        if (Math.min(zAbajo, zArriba) - t - 0.5 < 3) {
          avisos.push("Una mitad del molde es muy baja para las orejas de las pinzas: mueve la partición al centro o sube la pared.")
        } else {
          abajo = g(abajo.add(g(Manifold.union(lados.map((l) => oreja(l, 1, zAbajo))))))
          arriba = g(arriba.add(g(Manifold.union(lados.map((l) => oreja(l, -1, zArriba))))))
          avisos.push("Cierra el molde con 4 pinzas de papelería (clips binder) en las orejas.")
        }
      }
      if (abajo.isEmpty() || arriba.isEmpty()) throw new Error("No se pudo partir el molde a esa altura. Prueba otra altura de partición.")
      salida("molde-abajo", abajo)
      salida("molde-arriba", arriba, true, "afuera")
      avisos.push(`El molde se parte a ${r1(zp)} mm de la base de la pieza.`)
    }

    // ¿Sale sin atorarse? Se revisa sobre la pieza sin girar (las sugerencias
    // de lado son las mismas opciones del paso 2)
    // Con núcleo, la que sale es la pieza hueca y en esta posición: no hay otro lado que sugerir
    let desmoldeo = tipo === "caja_silicona" ? null : revisarDesmoldeo(sinGirar.tris, tipo, o.arriba, particion)
    if (desmoldeo && hueca) {
      // Con núcleo la posición queda fija (boca arriba): no se sugiere otro lado
      // ni otra partición. Además el núcleo tiene que salir: nada de pieza encima.
      const n = nucleoAtorado(aMalla(hueca as any).tris)
      desmoldeo = { atorado: Math.max(desmoldeo.atorado, n), nucleo: n > 0.01 && n >= desmoldeo.atorado, dudoso: desmoldeo.dudoso }
    }
    return { tipo, piezas, modelo, colado: r1(colado / 1000), particionZ, desmoldeo, avisos }
  } finally {
    for (const x of basura) { try { (x as any)?.delete?.() } catch {} }
  }
}

/**
 * La malla girada 180° en X y apoyada en z = 0: la mitad de arriba se imprime
 * con su cara de afuera (la del bebedero) sobre la cama y la cara de partición
 * hacia arriba, así la cavidad queda abierta y no lleva soportes.
 */
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
