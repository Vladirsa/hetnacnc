// Primeras horas de una solicitud (estrategia: primera propuesta en menos de
// 2 h). Si una solicitud abierta lleva RESPUESTA_RAPIDA_HORAS (2) publicada y
// ningún taller ha cotizado:
//   - recordatorio por celular (push y WhatsApp verificado) a los talleres que
//     ya la recibieron y no dijeron que no (hasta MAX_TALLERES);
//   - aviso a HETNA por Telegram, con la liga para atenderla a mano.
// Una sola vez por solicitud y sólo de 8 a 20 h de CDMX (si se publicó de
// noche, sale a las 8). Después siguen las rondas de 48 h y del cierre
// (lib/licitacion-ampliar). RESPUESTA_RAPIDA=0 lo apaga.
import { T_AVISO } from "./difusion"
import { T_PROPUESTA, T_RESPUESTA, T_SOLICITUD, STORE_URL, folioTexto } from "./licitacion"
import { modalidadDe } from "./licitacion-privacidad"
import { pushATalleres } from "./push"
import { mandarPrivado } from "./social-telegram"
import { avisarWhatsapp } from "./whatsapp"

const HORA = 3_600_000
const DIAS_ABIERTA = 7
export const MAX_TALLERES = 25
export const horasRapida = () => Math.max(1, Number(process.env.RESPUESTA_RAPIDA_HORAS || 2))
// Pasadas 44 h ya no vale la pena: a las 48 h entra la ronda 2
const HORAS_TOPE = 44

/** Hora de CDMX (0–23). */
export const horaCdmx = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hourCycle: "h23" }).format(d))

/** ¿Le toca el aviso rápido? Pura. abierta desde = cierre − 7 días. */
export function tocaAvisoRapido(
  s: { cierra_en: Date | string | null; difusion_ronda?: number | null; aviso_rapido?: Date | string | null },
  ahora = new Date(),
  horas = horasRapida()
): boolean {
  if (!s.cierra_en || s.aviso_rapido || Number(s.difusion_ronda || 1) > 1) return false
  const desde = new Date(s.cierra_en).getTime() - DIAS_ABIERTA * 24 * HORA
  const lleva = (ahora.getTime() - desde) / HORA
  if (lleva < horas || lleva > HORAS_TOPE) return false
  const h = horaCdmx(ahora)
  return h >= 8 && h < 20
}

/** Horas que lleva publicada (para el panel). Pura. */
export function horasPublicada(cierra_en: Date | string, ahora = new Date()) {
  return Math.max(0, Math.round(((ahora.getTime() - (new Date(cierra_en).getTime() - DIAS_ABIERTA * 24 * HORA)) / HORA) * 10) / 10)
}

let listo = false
async function asegurar(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasColumn(T_SOLICITUD, "aviso_rapido"))) {
    await knex.schema.alterTable(T_SOLICITUD, (t: any) => t.timestamp("aviso_rapido", { useTz: true }).nullable())
  }
  listo = true
}

/** Abiertas, públicas, sin propuestas y publicadas hace entre `desdeH` y 44 h. */
export async function sinPropuestaReciente(knex: any, ahora = new Date(), desdeH = horasRapida()) {
  await asegurar(knex)
  const base = ahora.getTime() + DIAS_ABIERTA * 24 * HORA
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .where("s.estado", "abierta")
    .where("s.modo", "abierta")
    .whereNotNull("s.cierra_en")
    .where("s.cierra_en", ">=", new Date(base - HORAS_TOPE * HORA))
    .where("s.cierra_en", "<=", new Date(base - desdeH * HORA))
    .where((q: any) => q.whereNull("s.difusion_ronda").orWhere("s.difusion_ronda", "<=", 1))
    .whereNotExists(knex(T_PROPUESTA).whereRaw(`${T_PROPUESTA}.solicitud_id = s.id`).select(knex.raw("1")))
    .orderBy("s.cierra_en")
    .limit(30)
    .select("s.*")) as any[]
  return filas.filter((s) => modalidadDe(s) !== "privada")
}

async function talleresAvisados(knex: any, s: any): Promise<string[]> {
  const avisados = ((await knex(T_AVISO).where({ solicitud_id: s.id }).select("seller_id").catch(() => [])) as any[]).map((r) => r.seller_id)
  const rechazaron = (await knex.schema.hasTable(T_RESPUESTA))
    ? new Set(((await knex(T_RESPUESTA).where({ solicitud_id: s.id }).select("seller_id")) as any[]).map((r) => r.seller_id))
    : new Set<string>()
  const ids = [...new Set([...(s.taller_id ? [s.taller_id] : []), ...avisados])].filter((id) => !rechazaron.has(id))
  return ids.slice(0, MAX_TALLERES)
}

export async function avisoRapido(knex: any, logger: any, s: any) {
  // Marcar primero: si el job corre dos veces a la vez, sólo uno avisa
  const n = await knex(T_SOLICITUD).where({ id: s.id }).whereNull("aviso_rapido").update({ aviso_rapido: knex.fn.now() })
  if (!n) return 0
  const folio = folioTexto(s.folio)
  const t = s.trabajo || {}
  const que = [t.servicio, t.material, t.cantidad && `${t.cantidad}`].filter(Boolean).join(" · ") || "fabricación"
  const ids = await talleresAvisados(knex, s)
  if (ids.length) {
    const aviso = { titulo: "Un cliente espera tu precio ⏱", cuerpo: `${folio}: ${que}. Nadie ha cotizado todavía; la primera propuesta es la que más se elige.`, url: `/seller/solicitudes?cotizar=${encodeURIComponent(s.id)}` }
    await pushATalleres(knex, ids, { ...aviso, etiqueta: `rapida-${s.id}` }, logger).catch(() => null)
    await avisarWhatsapp(knex, { sellerIds: ids }, aviso, logger).catch(() => null)
  }
  const horas = horasPublicada(s.cierra_en)
  await mandarPrivado(knex, {
    texto:
      `⏱ ${folio} lleva ${horas} h sin propuestas\n${que}${t.ciudad ? ` · ${t.ciudad}` : ""}\n` +
      `Recordatorio enviado a ${ids.length} ${ids.length === 1 ? "taller" : "talleres"}.\n` +
      `Atiéndela: ${STORE_URL}/mx/panel/licitaciones?f=${encodeURIComponent(folio)}`,
  }).catch(() => null)
  logger.info(`[respuesta-rapida] ${folio}: recordatorio a ${ids.length} talleres`)
  return ids.length
}

/** Para el panel: abiertas y públicas sin propuesta con más de `horas` publicadas (todas, no sólo las primeras 44 h). */
export async function enRiesgo(knex: any, ahora = new Date(), horas = horasRapida()) {
  await asegurar(knex)
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .where("s.estado", "abierta")
    .where("s.modo", "abierta")
    .whereNotNull("s.cierra_en")
    .where("s.cierra_en", "<=", new Date(ahora.getTime() + DIAS_ABIERTA * 24 * HORA - horas * HORA))
    .whereNotExists(knex(T_PROPUESTA).whereRaw(`${T_PROPUESTA}.solicitud_id = s.id`).select(knex.raw("1")))
    .orderBy("s.cierra_en")
    .limit(15)
    .select("s.id", "s.folio", "s.cierra_en", "s.trabajo", "s.aviso_rapido", "s.difusion_ronda", "s.modalidad", "s.privacidad")
    .catch(() => [])) as any[]
  return filas
    .filter((s) => modalidadDe(s) !== "privada")
    .map((s) => ({
      folio: folioTexto(s.folio),
      horas: horasPublicada(s.cierra_en, ahora),
      que: [s.trabajo?.servicio, s.trabajo?.material].filter(Boolean).join(" · "),
      ciudad: s.trabajo?.ciudad || "",
      recordada: Boolean(s.aviso_rapido),
      ronda: Number(s.difusion_ronda || 1),
    }))
}

export async function correrRespuestaRapida(knex: any, logger: any, ahora = new Date()) {
  if (process.env.RESPUESTA_RAPIDA === "0") return 0
  let n = 0
  for (const s of await sinPropuestaReciente(knex, ahora)) {
    if (!tocaAvisoRapido(s, ahora)) continue
    await avisoRapido(knex, logger, s).catch((e: Error) => logger.error(`[respuesta-rapida] ${s.id}: ${e.message}`))
    n++
  }
  return n
}
