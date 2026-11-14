// Resultados de licitaciones para el dashboard: de las solicitudes creadas en
// el periodo, cuántas llegan a cada paso, cuánto tardan, dónde se pierden y si
// los recordatorios y las ampliaciones están sirviendo.
import { T_PROPUESTA, T_RESPUESTA, T_SOLICITUD, MOTIVOS_RESPUESTA, folioTexto, ligaPropuestas } from "./licitacion"
import { T_EVENTO } from "./seguimiento"
import { T_RECORDATORIO } from "./licitacion-recordatorios"
import { T_AVISO } from "./difusion"
import { T_HITO } from "./licitacion-hitos"

const HORA = 3_600_000
const DIA = 24 * HORA

export const mediana = (xs: number[]) => {
  const v = xs.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
const horas = (a: any, b: any) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / HORA : NaN)
const PAGADA = ["en_produccion", "entregada"]

export async function embudo(knex: any, dias = 30, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - dias * DIA)
  const sols = (await knex(T_SOLICITUD).where("created_at", ">=", desde).orderBy("created_at", "desc").select("*")) as any[]
  const ids = sols.map((s) => s.id)
  const hay = async (t: string) => knex.schema.hasTable(t)

  const props = ids.length ? ((await knex(T_PROPUESTA).whereIn("solicitud_id", ids).select("solicitud_id", "seller_id", "created_at")) as any[]) : []
  const eventos = ids.length && (await hay(T_EVENTO))
    ? ((await knex(T_EVENTO).whereIn("solicitud_id", ids).whereNotNull("etapa").orderBy("created_at").select("solicitud_id", "etapa", "created_at")) as any[])
    : []
  const avisos = ids.length && (await hay(T_AVISO)) ? ((await knex(T_AVISO).whereIn("solicitud_id", ids).select("solicitud_id", "seller_id", "ronda", "created_at")) as any[]) : []
  const rechazos = ids.length && (await hay(T_RESPUESTA)) ? ((await knex(T_RESPUESTA).whereIn("solicitud_id", ids).select("solicitud_id", "motivo")) as any[]) : []

  const porSol = <T extends { solicitud_id: string }>(xs: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of xs) m.set(x.solicitud_id, [...(m.get(x.solicitud_id) || []), x])
    return m
  }
  const P = porSol(props), E = porSol(eventos), A = porSol(avisos)
  const primerEvento = (id: string, etapas: string[]) => (E.get(id) || []).find((e) => etapas.includes(e.etapa))?.created_at

  const c = { creadas: sols.length, difundidas: 0, con_propuesta: 0, elegidas: 0, pagadas: 0, entregadas: 0 }
  const perdidas = { sin_revisar: 0, sin_propuestas_cerradas: 0, sin_propuestas_abiertas: 0, sin_elegir: 0, sin_pagar: 0, canceladas: 0 }
  const t = { propuesta: [] as number[], elegir: [] as number[], pagar: [] as number[] }
  let propuestasTotal = 0
  let avisadosTotal = 0
  let avisadosCon = 0
  let ampliadas = 0
  let ampliadasConPropuesta = 0

  for (const s of sols) {
    const ps = P.get(s.id) || []
    const etapa = String(s.etapa || "")
    const pagada = s.estado === "pagada" || s.pago_estado === "pagado" || (Boolean(s.propuesta_elegida) && (PAGADA.includes(etapa) || (etapa === "cerrada" && primerEvento(s.id, ["en_produccion"]))))
    const difundida = s.estado !== "revision" && (ps.length > 0 || Boolean(primerEvento(s.id, ["enviada_talleres"])) || Boolean(s.cierra_en) || s.modo === "directa")
    if (difundida) c.difundidas++
    if (ps.length) c.con_propuesta++
    if (s.propuesta_elegida) c.elegidas++
    if (pagada) c.pagadas++
    if (s.propuesta_elegida && (etapa === "entregada" || (etapa === "cerrada" && pagada))) c.entregadas++
    propuestasTotal += ps.length
    const av = new Set((A.get(s.id) || []).map((a) => a.seller_id))
    if (av.size) { avisadosTotal += av.size; avisadosCon++ }
    if (Number(s.difusion_ronda || 1) >= 2) {
      ampliadas++
      const ronda2 = (A.get(s.id) || []).filter((a) => a.ronda >= 2).map((a) => new Date(a.created_at).getTime())
      const desdeAmpliacion = ronda2.length ? Math.min(...ronda2) : 0
      if (ps.some((p) => new Date(p.created_at).getTime() >= desdeAmpliacion)) ampliadasConPropuesta++
    }

    // Dónde se quedó
    if (etapa === "cancelada") perdidas.canceladas++
    else if (s.estado === "revision") perdidas.sin_revisar++
    else if (!ps.length) (s.estado === "cerrada" ? perdidas.sin_propuestas_cerradas++ : perdidas.sin_propuestas_abiertas++)
    else if (!s.propuesta_elegida) perdidas.sin_elegir++
    else if (!pagada) perdidas.sin_pagar++

    // Tiempos (horas)
    const primera = ps.map((p) => new Date(p.created_at).getTime()).sort((a, b) => a - b)[0]
    const abierta = primerEvento(s.id, ["enviada_talleres"]) || s.created_at
    if (primera) t.propuesta.push(horas(abierta, new Date(primera)))
    const elegida = primerEvento(s.id, ["aceptada"])
    if (elegida && primera) t.elegir.push(horas(new Date(primera), elegida))
    const produccion = primerEvento(s.id, ["en_produccion"])
    if (elegida && produccion) t.pagar.push(horas(elegida, produccion))
  }

  // Recordatorios: cuántos salieron y cuántos de esos tratos avanzaron después
  const recordatorios: Record<string, { enviados: number; avanzaron: number }> = {}
  if (await hay(T_RECORDATORIO)) {
    const filas = (await knex(T_RECORDATORIO).where("created_at", ">=", desde).select("clave", "created_at")) as any[]
    const elegidas = new Set(sols.filter((s) => s.propuesta_elegida).map((s) => s.id))
    const pagadas = new Set(sols.filter((s) => s.estado === "pagada" || s.pago_estado === "pagado").map((s) => s.id))
    const contrasIds = filas.filter((f) => f.clave.startsWith("contra:")).map((f) => f.clave.split(":")[1])
    const contras = contrasIds.length && (await hay("hetna_contraoferta"))
      ? new Map(((await knex("hetna_contraoferta").whereIn("id", contrasIds).select("id", "estado")) as any[]).map((x) => [x.id, x.estado]))
      : new Map()
    const hitosIds = filas.filter((f) => f.clave.startsWith("hito:")).map((f) => f.clave.split(":")[1])
    const hitos = hitosIds.length && (await hay(T_HITO))
      ? new Map(((await knex(T_HITO).whereIn("id", hitosIds).select("id", "fecha_real")) as any[]).map((x) => [x.id, x.fecha_real]))
      : new Map()
    for (const f of filas) {
      const [tipo, id] = String(f.clave).split(":")
      const r = (recordatorios[tipo] ||= { enviados: 0, avanzaron: 0 })
      r.enviados++
      const avanzo =
        tipo === "elegir" ? elegidas.has(id) :
        tipo === "pagar" ? pagadas.has(id) :
        tipo === "contra" ? (contras.get(id) && contras.get(id) !== "pendiente") :
        tipo === "hito" ? Boolean(hitos.get(id)) : false
      if (avanzo) r.avanzaron++
    }
  }

  // Motivos por los que los talleres no cotizan
  const motivos: Record<string, number> = {}
  for (const r of rechazos) {
    const k = MOTIVOS_RESPUESTA[r.motivo] || r.motivo
    motivos[k] = (motivos[k] || 0) + 1
  }

  // Por semana (últimas 8): creadas y pagadas
  const semanas: { semana: string; creadas: number; pagadas: number }[] = []
  const lunes = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x }
  const inicio = lunes(new Date(ahora.getTime() - 7 * 7 * DIA))
  const ult = (await knex(T_SOLICITUD).where("created_at", ">=", inicio).select("created_at", "estado", "pago_estado")) as any[]
  for (let i = 0; i < 8; i++) {
    const a = new Date(inicio.getTime() + i * 7 * DIA), b = new Date(a.getTime() + 7 * DIA)
    const de = ult.filter((s) => new Date(s.created_at) >= a && new Date(s.created_at) < b)
    semanas.push({ semana: a.toISOString().slice(0, 10), creadas: de.length, pagadas: de.filter((s) => s.estado === "pagada" || s.pago_estado === "pagado").length })
  }

  // Atoradas ahora mismo (de cualquier fecha), para actuar hoy
  const atoradas = await atoradasAhora(knex, ahora)

  const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)
  return {
    dias,
    pasos: c,
    perdidas,
    tiempos_horas: { primera_propuesta: r1(mediana(t.propuesta)), elegir: r1(mediana(t.elegir)), pagar: r1(mediana(t.pagar)) },
    propuestas_por_solicitud: c.con_propuesta ? r1(propuestasTotal / c.con_propuesta) : null,
    talleres_avisados_promedio: avisadosCon ? r1(avisadosTotal / avisadosCon) : null,
    respuesta_talleres_pct: avisadosTotal ? Math.round((props.filter((p) => (A.get(p.solicitud_id) || []).some((a) => a.seller_id === p.seller_id)).length / avisadosTotal) * 100) : null,
    ampliadas: { total: ampliadas, con_propuesta_despues: ampliadasConPropuesta },
    recordatorios,
    motivos_no_cotizar: motivos,
    semanas,
    atoradas,
  }
}

export type Atorada = { folio: string; motivo: string; dias: number; cliente: string; liga: string }

export async function atoradasAhora(knex: any, ahora = new Date()): Promise<Atorada[]> {
  const t = ahora.getTime()
  const out: Atorada[] = []
  const d = (x: any) => Math.floor((t - new Date(x).getTime()) / DIA)
  const fila = (s: any, motivo: string, desde: any) => ({ folio: folioTexto(s.folio), motivo, dias: d(desde), cliente: s.contacto?.nombre || s.contacto?.email || "", liga: ligaPropuestas(s.token) })
  const sinProp = (await knex(`${T_SOLICITUD} as s`).where("s.estado", "abierta").whereNull("s.propuesta_elegida")
    .where("s.created_at", "<=", new Date(t - 2 * DIA))
    .whereNotExists(knex(T_PROPUESTA).whereRaw(`${T_PROPUESTA}.solicitud_id = s.id`).select(knex.raw("1")))
    .limit(30).select("s.*")) as any[]
  for (const s of sinProp) out.push(fila(s, "Abierta sin propuestas", s.created_at))
  const sinElegir = (await knex(T_SOLICITUD).where({ estado: "abierta" }).whereNull("propuesta_elegida").whereNotNull("aviso_cierre")
    .where("aviso_cierre", ">=", new Date(t - 15 * DIA)).limit(30).select("*")) as any[]
  for (const s of sinElegir) out.push(fila(s, "Tiene propuestas y no elige", s.aviso_cierre))
  const sinPagar = (await knex(T_SOLICITUD).where({ estado: "elegida" }).where("etapa_desde", "<=", new Date(t - DIA))
    .where("etapa_desde", ">=", new Date(t - 30 * DIA)).limit(30).select("*")) as any[]
  for (const s of sinPagar) out.push(fila(s, "Eligió y no paga", s.etapa_desde))
  if (await knex.schema.hasTable(T_HITO)) {
    const hoy = new Date(t).toISOString().slice(0, 10)
    const atras = (await knex(`${T_HITO} as h`).join(`${T_SOLICITUD} as s`, "s.id", "h.solicitud_id")
      .whereNull("h.fecha_real").where("h.fecha_plan", "<", hoy).where("s.etapa", "en_produccion")
      .groupBy("s.id").min("h.fecha_plan as desde").select("s.id")) as any[]
    if (atras.length) {
      const sols = (await knex(T_SOLICITUD).whereIn("id", atras.map((a) => a.id)).select("*")) as any[]
      const desde = new Map(atras.map((a) => [a.id, a.desde]))
      for (const s of sols) out.push(fila(s, "Producción atrasada", desde.get(s.id)))
    }
  }
  return out.sort((a, b) => b.dias - a.dias)
}
