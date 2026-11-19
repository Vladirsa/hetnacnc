// Muebles de ensamble sin tornillos (ranura y espiga) para router CNC o láser.
//
// Primer modelo: exhibidor con gabinete abajo y repisas arriba. Todo es
// paramétrico y sale de una sola fuente de geometría: cada pieza es su
// contorno real (con mortajas y alivios para la fresa) más dónde va en el
// mueble armado. La vista 3D extruye esos mismos contornos, así lo que se ve
// armado es exactamente lo que se corta.
//
// Ejes del mueble armado (mm): X a lo ancho, Y de frente (0) hacia atrás, Z arriba.
// Sin DOM ni three: puede correr en el navegador o en el servidor.

export type P = [number, number]
export type Plano = "lateral" | "horizontal" | "frontal"

// Pieza: contorno y huecos en sus propias coordenadas (u, v), grosor e.
//  lateral:    u = Y, v = Z, grosor hacia +X desde x0
//  horizontal: u = X, v = Y, grosor hacia +Z desde z0
//  frontal:    u = X, v = Z, grosor hacia +Y desde y0
export type PiezaEnsamble = {
  nombre: string
  plano: Plano
  contorno: P[]
  huecos: P[][]
  desfase: number // x0, z0 o y0 según el plano
  grosor: number
}

export type Herramienta = { tipo: "laser" } | { tipo: "fresa"; diametro: number }

export type OpcionesExhibidor = {
  ancho: number // ancho total, con las espigas que sobresalen
  fondoGabinete: number
  fondoRepisas: number
  altoGabinete: number // 0 = sin gabinete
  repisas: number // repisas arriba del gabinete
  espacioSobreGabinete: number // del gabinete a la primera repisa
  separacion: number // entre repisas
  sobreUltima: number // cuánto suben los laterales sobre la última repisa
  divisores: "ninguno" | "abajo" | "arriba" | "ambos"
  numDivisores: number
  altoDivisor: number
  ranurasDivisor: boolean // muescas en las orillas para colgar o apoyar producto
  barrote: number // diámetro del barrote (0 = sin barrote); el barrote se compra
  grosor: number // grosor real medido del tablero
  holgura: number // juego total entre espiga y mortaja
  saliente: number // cuánto sobresalen las espigas por fuera del lateral
  herramienta: Herramienta
}

// Medidas de inicio, tomadas del plano de referencia (exhibidor de 100 × 49.2 cm)
export const EXHIBIDOR_INICIO: OpcionesExhibidor = {
  ancho: 1000,
  fondoGabinete: 492,
  fondoRepisas: 250,
  altoGabinete: 500,
  repisas: 3,
  espacioSobreGabinete: 211,
  separacion: 360,
  sobreUltima: 120,
  divisores: "ambos",
  numDivisores: 4,
  altoDivisor: 240,
  ranurasDivisor: true,
  barrote: 25,
  grosor: 15,
  holgura: 0.3,
  saliente: 15,
  herramienta: { tipo: "fresa", diametro: 6.35 },
}

export type Mueble = {
  piezas: PiezaEnsamble[]
  compras: { nombre: string; cantidad: number; nota?: string; precio?: number }[]
  medidas: { ancho: number; fondo: number; alto: number }
  errores: string[]
  avisos: string[]
}

// ---------- utilidades de polígonos ----------
const area2 = (p: P[]) => {
  let s = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1])
  return s / 2 // > 0 antihorario (suma de (x_ant - x)(y_ant + y))
}
export const ccw = (p: P[]) => (area2(p) > 0 ? p : [...p].reverse())
export const rect = (u0: number, v0: number, u1: number, v1: number): P[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
const circulo = (cu: number, cv: number, r: number, n = 40): P[] => Array.from({ length: n }, (_, i) => [cu + r * Math.cos((2 * Math.PI * i) / n), cv + r * Math.sin((2 * Math.PI * i) / n)] as P)

// Alivio para fresa ("dogbone") en una esquina: la fresa redonda no corta
// esquinas interiores a escuadra, así que se le abre un círculo del radio de
// la fresa que pasa por la esquina. b apunta hacia el lado vacío de la esquina;
// el círculo (centro a r de la esquina sobre b) se mete en el material de los
// dos lados, y el contorno lo rodea pasando por la esquina.
function alivio(Pp: P, V: P, N: P, r: number): P[] {
  const ux = V[0] - Pp[0], uy = V[1] - Pp[1]
  const wx = N[0] - V[0], wy = N[1] - V[1]
  const lu = Math.hypot(ux, uy) || 1, lw = Math.hypot(wx, wy) || 1
  const u: P = [ux / lu, uy / lu]
  const w: P = [wx / lw, wy / lw]
  let bx = w[0] - u[0], by = w[1] - u[1]
  const lb = Math.hypot(bx, by) || 1
  bx /= lb
  by /= lb
  const C: P = [V[0] + r * bx, V[1] + r * by]
  const t1 = Math.abs(2 * r * (u[0] * bx + u[1] * by))
  const t2 = Math.abs(2 * r * (w[0] * bx + w[1] * by))
  if (t1 > lu * 0.45 || t2 > lw * 0.45) return [V] // el tramo es muy corto: se deja la esquina
  const P1: P = [V[0] - u[0] * t1, V[1] - u[1] * t1]
  const P2: P = [V[0] + w[0] * t2, V[1] + w[1] * t2]
  const a1 = Math.atan2(P1[1] - C[1], P1[0] - C[0])
  const am = Math.atan2(-by, -bx) // hacia la esquina: el arco pasa por ella, del lado del material
  let a2 = Math.atan2(P2[1] - C[1], P2[0] - C[0])
  // barrer de a1 a a2 pasando por am (el lado lejano de la esquina)
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const pasa = (s: number) => {
    const total = norm(s * (a2 - a1))
    const hastaM = norm(s * (am - a1))
    return hastaM <= total
  }
  const s = pasa(1) ? 1 : -1
  let total = norm(s * (a2 - a1))
  if (total === 0) total = 2 * Math.PI
  a2 = a1 + s * total
  const out: P[] = [P1]
  const n = 10
  for (let k = 1; k < n; k++) {
    const a = a1 + ((a2 - a1) * k) / n
    out.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)])
  }
  out.push(P2)
  return out
}
// arco de radio r alrededor de C, de un ángulo a otro pasando por "via"
function arco(C: P, r: number, a1: number, a2: number, via: number, n = 10): P[] {
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const s = norm(via - a1) <= norm(a2 - a1) ? 1 : -1
  let total = norm(s * (a2 - a1))
  if (total === 0) total = 2 * Math.PI
  const out: P[] = []
  for (let k = 0; k <= n; k++) {
    const a = a1 + (s * total * k) / n
    out.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)])
  }
  return out
}

// Alivio en T ("T-bone"): el círculo de la fresa se abre hacia un solo lado, en
// la pared de la orilla más corta, para que las caras largas (las que aprietan
// la espiga) queden limpias. El centro va sobre la línea de esa orilla, a r de
// la esquina, y el círculo pasa por ella.
function alivioT(Pp: P, V: P, N: P, r: number): P[] {
  const ux = V[0] - Pp[0], uy = V[1] - Pp[1]
  const wx = N[0] - V[0], wy = N[1] - V[1]
  const lu = Math.hypot(ux, uy) || 1, lw = Math.hypot(wx, wy) || 1
  const u: P = [ux / lu, uy / lu]
  const w: P = [wx / lw, wy / lw]
  // b apunta al lado vacío (igual que en el alivio de hueso)
  const bx = w[0] - u[0], by = w[1] - u[1]
  // lado del material de una orilla: la normal que se aleja de b
  const material = (d: P): P => {
    const n: P = [-d[1], d[0]]
    return n[0] * bx + n[1] * by > 0 ? [-n[0], -n[1]] : n
  }
  const ang = (x: number, y: number) => Math.atan2(y, x)
  if (lu >= lw) {
    // la orilla que sale es la corta: el alivio se mete en su pared
    if (2 * r > lw * 0.45) return [V]
    const C: P = [V[0] + r * w[0], V[1] + r * w[1]]
    const m = material(w)
    return arco(C, r, ang(-w[0], -w[1]), ang(w[0], w[1]), ang(m[0], m[1]))
  }
  if (2 * r > lu * 0.45) return [V]
  const C: P = [V[0] - r * u[0], V[1] - r * u[1]]
  const m = material(u)
  return arco(C, r, ang(-u[0], -u[1]), ang(u[0], u[1]), ang(m[0], m[1]))
}

// Tipo de alivio en las esquinas interiores: "hueso" (cabeza de fémur), "t" o "ninguno"
export type TipoAlivio = "hueso" | "t" | "ninguno"

// aplica alivios en las esquinas indicadas (índices) de un polígono
function conAlivios(p: P[], r: number, esquina: (i: number, giro: number) => boolean, tipo: TipoAlivio = "hueso"): P[] {
  if (!(r > 0) || tipo === "ninguno") return p
  const out: P[] = []
  for (let i = 0; i < p.length; i++) {
    const a = p[(i + p.length - 1) % p.length], v = p[i], b = p[(i + 1) % p.length]
    const giro = (v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0])
    if (esquina(i, giro)) out.push(...(tipo === "t" ? alivioT(a, v, b, r) : alivio(a, v, b, r)))
    else out.push(v)
  }
  return out
}
// mortaja (hueco rectangular) con alivio en sus cuatro esquinas si hay fresa
export const mortaja = (u0: number, v0: number, u1: number, v1: number, r: number, tipo: TipoAlivio = "hueso"): P[] => conAlivios(ccw(rect(u0, v0, u1, v1)), r, () => true, tipo)
// contorno exterior (antihorario) con alivio sólo en las esquinas cóncavas (raíz de las espigas)
export const exteriorConAlivios = (p: P[], r: number, tipo: TipoAlivio = "hueso") => conAlivios(ccw(p), r, (_, giro) => giro < -1e-9, tipo)

// Esquinas exteriores de una pieza: redondeadas (radio) o con chaflán a 45° (medida),
// sólo en las esquinas convexas cuyas dos orillas miden más que la medida.
export type TipoEsquina = "recta" | "redonda" | "chaflan"
export function esquinasExteriores(p: P[], tipo: TipoEsquina, medida: number, cuales?: (v: P) => boolean): P[] {
  if (tipo === "recta" || !(medida > 0)) return p
  const q = ccw(p)
  const out: P[] = []
  for (let i = 0; i < q.length; i++) {
    const a = q[(i + q.length - 1) % q.length], v = q[i], b = q[(i + 1) % q.length]
    const ux = v[0] - a[0], uy = v[1] - a[1], wx = b[0] - v[0], wy = b[1] - v[1]
    const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy)
    const giro = ux * wy - uy * wx
    if (giro <= 1e-9 || lu < medida * 2.05 || lw < medida * 2.05 || (cuales && !cuales(v))) {
      out.push(v)
      continue
    }
    const u: P = [ux / lu, uy / lu], w: P = [wx / lw, wy / lw]
    const P1: P = [v[0] - u[0] * medida, v[1] - u[1] * medida]
    const P2: P = [v[0] + w[0] * medida, v[1] + w[1] * medida]
    if (tipo === "chaflan") {
      out.push(P1, P2)
      continue
    }
    // redonda: arco tangente a las dos orillas (esquinas a escuadra: centro a r de cada una)
    const C: P = [P1[0] + w[0] * medida, P1[1] + w[1] * medida]
    const a1 = Math.atan2(P1[1] - C[1], P1[0] - C[0]), a2 = Math.atan2(P2[1] - C[1], P2[0] - C[0])
    out.push(...arco(C, medida, a1, a2, Math.atan2(v[1] - C[1], v[0] - C[0]), 8))
  }
  return out
}

// ---------- el exhibidor ----------
export function exhibidor(o0: OpcionesExhibidor): Mueble {
  const errores: string[] = []
  const avisos: string[] = []
  const o = { ...o0 }
  // validar y acotar (también puede venir de una IA que lee una imagen)
  const acotar = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a)
  o.grosor = acotar(o.grosor, 6, 30)
  o.holgura = acotar(o.holgura, 0, 2)
  o.saliente = acotar(o.saliente, 0, 60)
  o.ancho = acotar(o.ancho, 300, 2400)
  o.fondoGabinete = acotar(o.fondoGabinete, 150, 900)
  o.fondoRepisas = acotar(o.fondoRepisas, 100, o.fondoGabinete)
  o.altoGabinete = o.altoGabinete > 0 ? acotar(o.altoGabinete, 200, 1200) : 0
  o.repisas = Math.round(acotar(o.repisas, 1, 8))
  o.espacioSobreGabinete = acotar(o.espacioSobreGabinete, 60, 1200)
  o.separacion = acotar(o.separacion, 80, 1200)
  o.sobreUltima = acotar(o.sobreUltima, 40, 600)
  o.numDivisores = Math.round(acotar(o.numDivisores, 1, 12))
  o.altoDivisor = acotar(o.altoDivisor, 60, 1000)
  o.barrote = o.barrote > 0 ? acotar(o.barrote, 10, 50) : 0

  const e = o.grosor
  const cl = o.holgura / 2
  const r = o.herramienta.tipo === "fresa" ? Math.max(0.5, o.herramienta.diametro / 2) : 0
  const s = o.saliente
  const A = o.ancho
  const Db = o.altoGabinete > 0 ? o.fondoGabinete : o.fondoRepisas
  const Ds = o.fondoRepisas
  const Hb = o.altoGabinete
  const L = e + s // largo de la espiga
  const xL = s // lateral izquierdo: x ∈ [s, s+e]
  const xR = A - s - e // lateral derecho: x ∈ [A-s-e, A-s]
  const xi0 = s + e // interior
  const xi1 = A - s - e
  const Wi = xi1 - xi0
  const margenM = 20 // mortaja a la orilla del lateral
  if (Wi < 150) errores.push("El mueble es muy angosto para ese grosor y esa saliente de espiga.")
  if (r > 0 && 2 * r > e + o.holgura - 0.2) errores.push(`La fresa de ${2 * r} mm no cabe en mortajas de ${(e + o.holgura).toFixed(1)} mm: usa una fresa más delgada o un tablero más grueso.`)
  if (Ds < 6 * e) avisos.push("Las repisas son poco profundas para el grosor del tablero: las espigas quedan chicas.")

  const piezas: PiezaEnsamble[] = []
  const compras: Mueble["compras"] = []
  // mortajas que cada pieza horizontal o frontal le pide a los laterales (en coordenadas Y, Z)
  const mortajasLat: P[][] = []

  // espigas en los extremos de una pieza: devuelve el contorno de una pieza
  // rectangular (u0..u1 = cuerpo entre laterales, v0..v1) con espigas de largo L
  // a ambos lados en los rangos de v indicados
  const conEspigas = (v0: number, v1: number, rangos: [number, number][]): P[] => {
    const pts: P[] = []
    // de abajo-izquierda, en sentido antihorario: abajo, derecha (con espigas), arriba, izquierda (con espigas)
    pts.push([xi0, v0], [xi1, v0])
    for (const [a, b] of rangos) pts.push([xi1, a], [xi1 + L, a], [xi1 + L, b], [xi1, b])
    pts.push([xi1, v1], [xi0, v1])
    for (const [a, b] of [...rangos].reverse()) pts.push([xi0, b], [xi0 - L, b], [xi0 - L, a], [xi0, a])
    return pts
  }
  const rangosEspiga = (y0: number, y1: number): [number, number][] => {
    const d = y1 - y0
    const tw = Math.max(25, Math.min(80, d * 0.22))
    return [0.25, 0.75].map((f) => [y0 + d * f - tw / 2, y0 + d * f + tw / 2] as [number, number])
  }

  // pieza horizontal (repisa, techo, piso) en z0, de y0 a y1
  const horizontal = (nombre: string, z0: number, y0: number, y1: number, huecos: P[][] = []) => {
    const rg = rangosEspiga(y0, y1)
    piezas.push({ nombre, plano: "horizontal", contorno: exteriorConAlivios(conEspigas(y0, y1, rg), r), huecos, desfase: z0, grosor: e })
    for (const [a, b] of rg) mortajasLat.push(mortaja(a - cl, z0 - cl, b + cl, z0 + e + cl, r))
  }
  // pieza frontal (frente, respaldo, travesaño) en y0, de z0 a z1, con espigas por los lados
  const frontal = (nombre: string, y0: number, z0: number, z1: number, huecos: P[][] = [], arcoAbajo = 0) => {
    const h = z1 - z0
    const th = Math.max(25, Math.min(70, h * 0.2))
    const rg: [number, number][] = h < 3.2 * th ? [[z0 + h / 2 - th / 2, z0 + h / 2 + th / 2]] : [[z0 + h * 0.22 - th / 2, z0 + h * 0.22 + th / 2], [z0 + h * 0.78 - th / 2, z0 + h * 0.78 + th / 2]]
    let contorno = conEspigas(z0, z1, rg)
    if (arcoAbajo > 0) {
      // recorte en arco al centro de la orilla de abajo (patas al frente)
      const m = Math.min(120, Wi * 0.15)
      const arco: P[] = [[xi0 + m, z0], [xi0 + m + arcoAbajo, z0 + arcoAbajo], [xi1 - m - arcoAbajo, z0 + arcoAbajo], [xi1 - m, z0]]
      contorno = [contorno[0], ...arco, ...contorno.slice(1)]
    }
    piezas.push({ nombre, plano: "frontal", contorno: exteriorConAlivios(contorno, r), huecos, desfase: y0, grosor: e })
    for (const [a, b] of rg) mortajasLat.push(mortaja(y0 - cl, a - cl, y0 + e + cl, b + cl, r))
  }

  // --- gabinete ---
  const zPiso = 80 // piso del gabinete
  const pie = 60
  const arco = 50
  if (Hb > 0) {
    horizontal("Tapa del gabinete", Hb - e, 0, Db)
    horizontal("Piso del gabinete", zPiso, margenM + e, Db - margenM - e)
    frontal("Frente del gabinete", margenM, 10, Hb - e, [], Math.min(arco, (Hb - e - 10) * 0.25))
    frontal("Respaldo del gabinete", Db - margenM - e, zPiso + e, Hb - e)
  }

  // --- repisas ---
  const zRep: number[] = []
  for (let i = 0; i < o.repisas; i++) zRep.push((Hb > 0 ? Hb : 0) + o.espacioSobreGabinete + i * o.separacion)
  const zUltima = zRep[zRep.length - 1]
  const alto = zUltima + e + o.sobreUltima
  const yRep0 = Db - Ds
  const conDivisores = (i: number) =>
    (o.divisores === "abajo" && i === 0) || (o.divisores === "arriba" && i === zRep.length - 1) || (o.divisores === "ambos" && (i === 0 || i === zRep.length - 1))
  // divisores: piezas frontales chicas paradas sobre la repisa, con dos espigas abajo
  const wd = Math.min(220, (Wi - 20) / o.numDivisores - 20)
  const yDiv = yRep0 + Ds / 2 - e / 2
  const tabW = Math.max(20, Math.min(40, wd * 0.2))
  const xsDiv = Array.from({ length: o.numDivisores }, (_, k) => xi0 + (Wi / o.numDivisores) * (k + 0.5))
  zRep.forEach((z, i) => {
    const huecos: P[][] = []
    if (conDivisores(i) && wd > 40) for (const xc of xsDiv) for (const f of [-0.28, 0.28]) huecos.push(mortaja(xc + f * wd - tabW / 2 - cl, yDiv - cl, xc + f * wd + tabW / 2 + cl, yDiv + e + cl, r))
    horizontal(`Repisa ${i + 1}`, z, yRep0, Db, huecos)
  })
  // travesaño trasero debajo de la última repisa (evita que el mueble se ladee)
  const hTrav = Math.min(110, o.separacion * 0.35)
  const zTrav1 = zUltima - 15
  const zTrav0 = zTrav1 - hTrav
  frontal("Travesaño trasero", Db - margenM - e, zTrav0, zTrav1)
  if (zRep.length > 1 && zTrav0 < zRep[zRep.length - 2] + e + 10) errores.push("La separación entre repisas es muy chica para el travesaño trasero.")

  // divisores
  zRep.forEach((z, i) => {
    if (!conDivisores(i) || wd <= 40) return
    const zb = z + e
    for (let k = 0; k < xsDiv.length; k++) {
      const xc = xsDiv[k]
      const x0 = xc - wd / 2, x1 = xc + wd / 2
      const hd = o.altoDivisor
      const pts: P[] = [[x0, zb]]
      for (const f of [-0.28, 0.28]) pts.push([xc + f * wd - tabW / 2, zb], [xc + f * wd - tabW / 2, zb - e], [xc + f * wd + tabW / 2, zb - e], [xc + f * wd + tabW / 2, zb])
      pts.push([x1, zb])
      // orilla derecha con muescas inclinadas, de abajo hacia arriba
      const muescas = o.ranurasDivisor ? Math.max(0, Math.floor((hd - 50) / 32)) : 0
      const anchoM = Math.max(6, (o.herramienta.tipo === "fresa" ? o.herramienta.diametro : 0) + 1.5)
      const prof = Math.min(18, wd * 0.12)
      const derecha: P[] = []
      for (let m = 0; m < muescas; m++) {
        const zc = zb + 30 + m * 32
        derecha.push([x1, zc], [x1 - prof, zc + prof * 0.5], [x1 - prof, zc + prof * 0.5 + anchoM], [x1, zc + anchoM])
      }
      pts.push(...derecha)
      // ranura en U desde arriba al centro
      const uw = wd * 0.28, ud = hd * 0.42
      pts.push([x1, zb + hd], [xc + uw / 2, zb + hd], [xc + uw / 2, zb + hd - ud], [xc - uw / 2, zb + hd - ud], [xc - uw / 2, zb + hd], [x0, zb + hd])
      // orilla izquierda (espejo), de arriba hacia abajo
      for (let m = muescas - 1; m >= 0; m--) {
        const zc = zb + 30 + m * 32
        pts.push([x0, zc + anchoM], [x0 + prof, zc + prof * 0.5 + anchoM], [x0 + prof, zc + prof * 0.5], [x0, zc])
      }
      piezas.push({ nombre: `Divisor ${i + 1}.${k + 1}`, plano: "frontal", contorno: exteriorConAlivios(pts, r), huecos: [], desfase: yDiv, grosor: e })
    }
    if (o.altoDivisor + e > (i < zRep.length - 1 ? o.separacion - 20 : 1e9)) errores.push(`Los divisores de la repisa ${i + 1} no caben bajo la repisa de arriba: baja su alto o sube la separación.`)
  })

  // barrote: agujero en los laterales debajo de la última repisa, al frente del travesaño
  const huecosLat: P[][] = [...mortajasLat]
  if (o.barrote > 0) {
    const zB = zTrav0 + hTrav / 2
    const yB = Math.max(yRep0 + o.barrote, Db - margenM - e - 25 - o.barrote)
    huecosLat.push(circulo(yB, zB, o.barrote / 2 + 0.4))
    compras.push({ nombre: `Barrote de ${o.barrote} mm`, cantidad: 1, nota: `Largo ${Math.round(A - 2 * s + 2 * 10)} mm (sobresale 1 cm por lado). De madera, aluminio o PVC.` })
  }

  // laterales: perfil de lado con patas y escalón entre gabinete y repisas
  const perfil: P[] = []
  if (Db > 2 * (pie + 25) + 40) perfil.push([0, 0], [pie, 0], [pie + 25, arco], [Db - pie - 25, arco], [Db - pie, 0], [Db, 0], [Db, alto], [yRep0, alto])
  else perfil.push([0, 0], [Db, 0], [Db, alto], [yRep0, alto])
  if (Hb > 0 && yRep0 > 40) {
    perfil.push([yRep0, Hb + 60], [Math.max(0, yRep0 - 35), Hb + 25], [0, Hb + 25])
  } else if (Hb > 0) perfil.push([0, Hb + 25])
  const lateral = ccw(perfil)
  for (const x0 of [xL, xR]) piezas.push({ nombre: x0 === xL ? "Lateral izquierdo" : "Lateral derecho", plano: "lateral", contorno: lateral, huecos: huecosLat, desfase: x0, grosor: e })

  // revisiones de fabricación: cada pieza debe caber en el tablero
  const tablero = { ancho: 1220, largo: 2440 }
  for (const pz of piezas) {
    const us = pz.contorno.map((q) => q[0]), vs = pz.contorno.map((q) => q[1])
    const a = Math.max(...us) - Math.min(...us), b = Math.max(...vs) - Math.min(...vs)
    const [c, l] = [Math.min(a, b), Math.max(a, b)]
    if (c > tablero.ancho || l > tablero.largo) {
      errores.push(`${pz.nombre} mide ${Math.round(l)} × ${Math.round(c)} mm y no cabe en un tablero de ${tablero.largo} × ${tablero.ancho} mm.`)
      break
    }
  }
  if (o.herramienta.tipo === "fresa" && o.herramienta.diametro > e * 0.7) avisos.push("La fresa es gruesa para ese tablero: los alivios de las esquinas se notarán. Usa una fresa más delgada si puedes.")
  if (o.holgura < 0.1) avisos.push("Con holgura casi cero las piezas entran muy apretadas; corta primero la pieza de prueba.")
  return { piezas, compras, medidas: { ancho: A, fondo: Db, alto: Math.max(alto, ...zRep.filter((_, i) => conDivisores(i)).map((z) => z + e + o.altoDivisor)) }, errores, avisos }
}

// ---------- llevar las piezas al mueble armado ----------
// (u, v, w) → (x, y, z) según el plano; w va de 0 al grosor
export function aMueble(p: PiezaEnsamble, u: number, v: number, w: number): [number, number, number] {
  if (p.plano === "lateral") return [p.desfase + w, u, v]
  if (p.plano === "horizontal") return [u, v, p.desfase + w]
  return [u, p.desfase + w, v]
}

// pieza de prueba de ajuste: una espiga y su mortaja en dos tiras chicas
export function piezaPrueba(e: number, holgura: number, herramienta: Herramienta): PiezaEnsamble[] {
  const r = herramienta.tipo === "fresa" ? Math.max(0.5, herramienta.diametro / 2) : 0
  const cl = holgura / 2
  const tw = 40
  const tira = rect(0, 0, 80, 60)
  const hueco = mortaja(20 - cl, 25 - e / 2 - cl, 20 + tw + cl, 25 + e / 2 + cl, r)
  const espiga: P[] = [[0, 0], [80, 0], [80, 40], [20 + tw, 40], [20 + tw, 40 + e + 10], [20, 40 + e + 10], [20, 40], [0, 40]]
  return [
    { nombre: "Prueba: mortaja", plano: "horizontal", contorno: ccw(tira), huecos: [hueco], desfase: 0, grosor: e },
    { nombre: "Prueba: espiga", plano: "horizontal", contorno: exteriorConAlivios(espiga, r), huecos: [], desfase: 0, grosor: e },
  ]
}
