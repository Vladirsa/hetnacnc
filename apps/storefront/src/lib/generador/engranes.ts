// Engranes rectos de evolvente (2D Studio): el perfil de diente que sí
// engrana, con barreno y cuñero, rayos para aligerar y el par acomodado a su
// distancia entre centros, ya girado para que los dientes entren.
//
//   r  = m·z/2            radio primitivo
//   rb = r·cos α          radio base (de ahí nace la evolvente)
//   ra = r + m            cabeza       rf = r − 1.25·m   pie
//   a  = m·(z1 + z2)/2    distancia entre centros del par
import { type P, type Trazo, arco, circulo, dibujo, girar, mover, trazo } from "@/lib/generador/geo2d"

export type OpcionesEngrane = {
  dientes: number
  modulo: number // mm
  presion: number // grados (14.5, 20 o 25)
  juego: number // mm que se quitan al espesor del diente (holgura)
  barreno: number // mm de diámetro, 0 = sin barreno
  cunero: boolean
  rayos: number // 0 = disco lleno
  par: boolean
  dientesPar: number
  barrenoPar: number
}

const inv = (a: number) => Math.tan(a) - a

/** Contorno de un engrane centrado en (0,0), con un diente apuntando a +X. */
export function perfilEngrane(z: number, m: number, presionGrados: number, juego: number): { pts: P[]; r: number; ra: number; rf: number; puntiagudo: boolean } {
  const a = (presionGrados * Math.PI) / 180
  const r = (m * z) / 2
  const rb = r * Math.cos(a)
  const ra = r + m
  const rf = Math.max(0.5, r - 1.25 * m)
  // Medio ángulo del diente en el radio primitivo
  const psi = (Math.PI * m) / 2 / (2 * r) - juego / (2 * r)
  // Ángulo (desde el centro del diente) del flanco en el radio rho
  const theta = (rho: number) => {
    if (rho <= rb) return psi + inv(a)
    return psi + inv(a) - inv(Math.acos(rb / rho))
  }
  const puntiagudo = theta(ra) <= 0.002
  const pasos = 10
  const flanco: { rho: number; t: number }[] = []
  const desde = Math.max(rf, rb)
  if (rf < rb) flanco.push({ rho: rf, t: theta(rb) })
  for (let i = 0; i <= pasos; i++) {
    const rho = desde + ((ra - desde) * i) / pasos
    flanco.push({ rho, t: Math.max(0.001, theta(rho)) })
  }
  const pts: P[] = []
  const paso = (Math.PI * 2) / z
  for (let k = 0; k < z; k++) {
    const c = k * paso
    // flanco que sube (ángulo menor)
    for (const { rho, t } of flanco) pts.push([rho * Math.cos(c - t), rho * Math.sin(c - t)])
    // punta
    const tt = flanco[flanco.length - 1].t
    if (tt > 0.002) for (const p of arco(0, 0, ra, c - tt, c + tt).slice(1, -1)) pts.push(p)
    // flanco que baja
    for (let i = flanco.length - 1; i >= 0; i--) {
      const { rho, t } = flanco[i]
      pts.push([rho * Math.cos(c + t), rho * Math.sin(c + t)])
    }
    // pie hasta el siguiente diente
    const t0 = flanco[0].t
    const a0 = c + t0
    const a1 = c + paso - t0
    if (a1 > a0) for (const p of arco(0, 0, rf, a0, a1).slice(1, -1)) pts.push(p)
  }
  return { pts, r, ra, rf, puntiagudo }
}

/** Barreno con cuñero (ranura arriba), centrado en (0,0). */
export function barrenoConCunero(d: number, cunero: boolean): Trazo {
  const R = d / 2
  if (!cunero || d < 6) return circulo(0, 0, R)
  // Cuñero aproximado a la norma: ancho ≈ d/4, profundidad ≈ d/8
  const k = Math.max(2, d / 4)
  const prof = Math.max(1, d / 8)
  const b = Math.asin(Math.min(0.99, k / 2 / R))
  const pts: P[] = arco(0, 0, R, Math.PI / 2 + b, Math.PI / 2 - b + Math.PI * 2)
  const yc = R * Math.cos(b)
  pts.push([k / 2, yc], [k / 2, R + prof], [-k / 2, R + prof], [-k / 2, yc])
  return trazo(pts)
}

/** Huecos entre rayos (aligerado) entre el cubo y la corona. */
function ventanas(n: number, rCubo: number, rCorona: number, anchoRayo: number): Trazo[] {
  const out: Trazo[] = []
  if (n < 3 || rCorona - rCubo < 6) return out
  const paso = (Math.PI * 2) / n
  const di = Math.asin(Math.min(0.95, anchoRayo / 2 / rCubo))
  const de = Math.asin(Math.min(0.95, anchoRayo / 2 / rCorona))
  for (let i = 0; i < n; i++) {
    const c0 = i * paso + paso / 2
    const a0 = c0 - paso / 2
    const a1 = c0 + paso / 2
    if (a1 - de <= a0 + de || a1 - di <= a0 + di) continue
    const pts: P[] = [...arco(0, 0, rCorona, a0 + de, a1 - de), ...arco(0, 0, rCubo, a1 - di, a0 + di)]
    out.push(trazo(pts))
  }
  return out
}

function engrane(z: number, o: OpcionesEngrane, barreno: number) {
  const p = perfilEngrane(z, o.modulo, o.presion, o.juego)
  const trazos: Trazo[] = [trazo(p.pts)]
  if (barreno > 0) trazos.push(barrenoConCunero(barreno, o.cunero))
  if (o.rayos >= 3) {
    const rCubo = Math.max(barreno * 0.9 + 3, p.r * 0.22)
    const rCorona = p.rf - Math.max(2.5 * o.modulo, 3)
    trazos.push(...ventanas(o.rayos, rCubo, rCorona, Math.max(4, p.r * 0.14)))
  }
  return { trazos, ...p }
}

export function hacerEngranes(o: OpcionesEngrane) {
  const avisos: string[] = []
  const z = Math.round(Math.max(6, Math.min(200, o.dientes)))
  const m = Math.max(0.3, o.modulo)
  const g1 = engrane(z, { ...o, modulo: m }, o.barreno)
  if (g1.puntiagudo) avisos.push("Los dientes salen en punta: sube los dientes o baja el ángulo de presión.")
  const zMin = o.presion <= 15 ? 32 : o.presion <= 20 ? 17 : 12
  if (z < zMin) avisos.push(`Con menos de ${zMin} dientes a ${o.presion}° el pie del diente se debilita (socavado). Funciona, pero con más dientes engrana más suave.`)
  if (o.barreno > 0 && o.barreno / 2 > g1.rf - 2 * m) avisos.push("El barreno es muy grande para este engrane.")
  const trazos: Trazo[] = [...g1.trazos]
  let distancia = 0
  let relacion = 0
  if (o.par) {
    const z2 = Math.round(Math.max(6, Math.min(200, o.dientesPar)))
    const g2 = engrane(z2, { ...o, modulo: m }, o.barrenoPar)
    distancia = (m * (z + z2)) / 2
    relacion = z2 / z
    // Se gira medio paso para que un hueco quede frente al diente del primero
    const giro = Math.PI + Math.PI / z2
    for (const t of g2.trazos) trazos.push({ ...t, pts: mover(girar(t.pts, giro), distancia, 0) })
    if (z2 < zMin) avisos.push(`El segundo engrane tiene menos de ${zMin} dientes: también se debilita el pie.`)
  }
  if (m < 1) avisos.push("Módulo menor a 1: sólo láser o fresa de 1 mm o menos (el hueco entre dientes es muy angosto).")
  else avisos.push(`Para router, la fresa debe ser de ${(m * 1.2).toFixed(1)} mm o menos para entrar entre los dientes.`)
  return {
    dibujo: dibujo(trazos, avisos),
    avisos,
    primitivo: g1.r * 2,
    exterior: g1.ra * 2,
    distancia,
    relacion,
  }
}
