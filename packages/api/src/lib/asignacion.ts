// Asignación del mejor taller (estrategia 3.3, como Factorem o Laserhub):
//
//   1. calidadTaller(): lo que el taller HA HECHO en HETNA (puntualidad real,
//      cumplimiento, calificación, rapidez para responder). Se suma al orden
//      de difusión (lib/difusion.ts) para que los que cumplen se enteren antes.
//   2. recomendarPropuesta(): entre las propuestas que llegaron, la que mejor
//      equilibra precio, plazo y cumplimiento del taller, con sus razones.
//      El cliente la ve marcada "Recomendada por HETNA"; él sigue eligiendo.
//
// No usa el plan ni la membresía para recomendar (la membresía no compra
// reputación); sólo datos medidos y lo que ofrece cada propuesta.

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** -1 a 7.5: puntualidad o puntaje medido (hasta 3), calificación (1.5), rapidez (1.5) y
 *  tasa de respuesta (de -1 si ignora casi todo a 1.5 si contesta 80 % o más). */
export function calidadTaller(perfil: any): number {
  const m = perfil?.medido || {}
  let q = 0
  const punt = num(m.puntualidad_pct)
  const puntaje = m.suficiente ? num(m.puntaje) : null
  if (puntaje != null) q += (puntaje / 100) * 3
  else if (punt != null && Number(m.con_fecha || 0) >= 3) q += (punt / 100) * 3
  const cal = num(perfil?.calificacion)
  if (cal != null && Number(perfil?.resenas || 0) >= 2) q += Math.max(0, (cal - 3) / 2) * 1.5
  const resp = num(m.respuesta_horas)
  if (resp != null) q += resp <= 2 ? 1.5 : resp <= 8 ? 1 : resp <= 24 ? 0.5 : 0
  // Contesta (cotiza o dice que no) a lo que se le avisa: se entera antes que quien ignora los avisos
  const tasa = num(m.tasa_respuesta_pct)
  if (tasa != null) q += tasa >= 80 ? 1.5 : tasa >= 50 ? 0.75 : tasa < 20 ? -1 : 0
  return Math.round(q * 100) / 100
}

export type PropuestaParaRecomendar = {
  id: string
  precio: number
  dias: number | null
  moneda?: string
  incluye_envio?: boolean
  taller: {
    calificacion?: number | null
    resenas?: number
    verificado?: boolean
    medido?: { puntualidad_pct?: number | null; puntaje?: number | null; suficiente?: boolean; terminados?: number; respuesta_horas?: number | null; tasa_respuesta_pct?: number | null; reclamos?: number; reclamos_resueltos?: number } | null
  }
}

export type Recomendacion = { id: string; puntaje: number; razones: string[] }

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`

/**
 * La propuesta que mejor equilibra precio (40 %), plazo (20 %), cumplimiento
 * medido del taller (25 %), calificación (10 %) y verificación (5 %). Sólo
 * compara propuestas en la misma moneda que la mayoría; con menos de 2, no
 * recomienda (no hay con qué comparar).
 */
export function recomendarPropuesta(props: PropuestaParaRecomendar[]): Recomendacion | null {
  const validas = props.filter((p) => p.precio > 0)
  if (validas.length < 2) return null
  const conteo = new Map<string, number>()
  for (const p of validas) conteo.set(p.moneda || "MXN", (conteo.get(p.moneda || "MXN") || 0) + 1)
  const moneda = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const mismas = validas.filter((p) => (p.moneda || "MXN") === moneda)
  if (mismas.length < 2) return null
  const minPrecio = Math.min(...mismas.map((p) => p.precio))
  const conDias = mismas.filter((p) => (p.dias ?? 0) > 0)
  const minDias = conDias.length ? Math.min(...conDias.map((p) => p.dias as number)) : null

  const evaluadas = mismas.map((p) => {
    const razones: string[] = []
    // Precio: el más barato 1; el doble o más, 0
    const sPrecio = Math.max(0, 1 - (p.precio / minPrecio - 1))
    if (p.precio === minPrecio) razones.push(`El mejor precio (${pesos(p.precio)})`)
    else if (p.precio <= minPrecio * 1.1) razones.push(`Precio cercano al más bajo (${pesos(p.precio)})`)
    // Plazo: el más rápido 1; el triple o más, 0; sin plazo, neutro
    let sDias = 0.5
    if (minDias && p.dias && p.dias > 0) {
      sDias = Math.max(0, 1 - (p.dias / minDias - 1) / 2)
      if (p.dias === minDias) razones.push(`La entrega más rápida (${p.dias} ${p.dias === 1 ? "día" : "días"})`)
    }
    // Cumplimiento medido: sin historial, neutro (no se castiga al taller nuevo, pero no gana por eso)
    const m = p.taller.medido
    let sCumple = 0.5
    if (m?.suficiente && m.puntaje != null) {
      sCumple = m.puntaje / 100
      if (m.puntaje >= 80) razones.push(`Cumplimiento ${m.puntaje}/100 en HETNA`)
    } else if (m?.puntualidad_pct != null && Number(m.terminados || 0) >= 3) {
      sCumple = m.puntualidad_pct / 100
      if (m.puntualidad_pct >= 90) razones.push(`${m.puntualidad_pct}% de entregas a tiempo`)
    }
    if (m?.reclamos && m.reclamos > (m.reclamos_resueltos || 0)) sCumple = Math.max(0, sCumple - 0.2)
    // Calificación de clientes
    let sCal = 0.5
    if (p.taller.calificacion != null && Number(p.taller.resenas || 0) >= 2) {
      sCal = Math.max(0, Math.min(1, (p.taller.calificacion - 3) / 2))
      if (p.taller.calificacion >= 4.5) razones.push(`★ ${p.taller.calificacion.toFixed(1)} de ${p.taller.resenas} clientes`)
    }
    const sVer = p.taller.verificado ? 1 : 0
    if (p.taller.verificado) razones.push("Taller verificado por HETNA")
    if (p.incluye_envio) razones.push("Incluye envío")
    const puntaje = Math.round((sPrecio * 0.4 + sDias * 0.2 + sCumple * 0.25 + sCal * 0.1 + sVer * 0.05) * 100)
    return { id: p.id, puntaje, razones }
  })
  evaluadas.sort((a, b) => b.puntaje - a.puntaje)
  const mejor = evaluadas[0]
  return { ...mejor, razones: mejor.razones.slice(0, 4) }
}
