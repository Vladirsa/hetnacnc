// Que ninguna solicitud abierta cierre sin propuestas.
//
// Una solicitud abierta recibe propuestas 7 días. Si nadie ha cotizado:
//   - Ronda 2, a las 48 h de abrir: aviso de "sigue sin propuestas" a los
//     talleres que ya la tenían (si no la rechazaron) y a los siguientes de la
//     lista, hasta RONDA2_MAX.
//   - Ronda 3, a 24 h del cierre: se amplía el plazo 3 días (una sola vez), se
//     avisa a TODOS los talleres que pueden hacerla (hasta RONDA3_MAX), se le
//     explica al cliente y se avisa a HETNA para que busque taller a mano antes
//     de que cierre, no después.
// Las privadas y las directas no se amplían: el cliente eligió a quién.
import { sendEmail } from "./resend"
import { candidatosAbiertos, difundirSolicitud } from "./difusion"
import { modalidadDe } from "./licitacion-privacidad"
import { T_PROPUESTA, T_RESPUESTA, T_SOLICITUD, boton, esc, folioTexto, ligaPropuestas, marco, tablaTrabajo } from "./licitacion"
import { anotar } from "./seguimiento"

const HORA = 3_600_000
const DIA = 24 * HORA
export const RONDA2_MAX = 80
export const RONDA3_MAX = 150
export const DIAS_EXTRA = 3

let listo = false
export async function asegurarAmpliar(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasColumn(T_SOLICITUD, "difusion_ronda"))) {
    await knex.schema.alterTable(T_SOLICITUD, (t: any) => t.integer("difusion_ronda").nullable())
  }
  listo = true
}

/** Qué ronda le toca a una solicitud abierta sin propuestas (0 = ninguna). */
export function rondaQueToca(s: { cierra_en: Date | string | null; difusion_ronda?: number | null }, ahora = new Date()) {
  if (!s.cierra_en) return 0
  const faltan = new Date(s.cierra_en).getTime() - ahora.getTime()
  if (faltan <= 0) return 0
  const hecha = Number(s.difusion_ronda || 1)
  if (hecha < 3 && faltan <= DIA) return 3
  if (hecha < 2 && faltan <= 5 * DIA) return 2
  return 0
}

/** Solicitudes abiertas, públicas y sin ninguna propuesta a las que les toca ronda. */
export async function porAmpliar(knex: any, ahora = new Date()) {
  await asegurarAmpliar(knex)
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .where("s.estado", "abierta")
    .where("s.modo", "abierta")
    .whereNotNull("s.cierra_en")
    .where("s.cierra_en", ">", ahora)
    .where("s.cierra_en", "<=", new Date(ahora.getTime() + 5 * DIA))
    .where((q: any) => q.whereNull("s.difusion_ronda").orWhere("s.difusion_ronda", "<", 3))
    .whereNotExists(knex(T_PROPUESTA).whereRaw(`${T_PROPUESTA}.solicitud_id = s.id`).select(knex.raw("1")))
    .orderBy("s.cierra_en")
    .limit(10)
    .select("s.*")) as any[]
  return filas
    .filter((s) => modalidadDe(s) !== "privada")
    .map((s) => ({ s, ronda: rondaQueToca(s, ahora) }))
    .filter((x) => x.ronda > 0)
}

/** Talleres a avisar en la ronda: los que pueden hacerla, sin los que ya dijeron que no. */
export async function talleresDeRonda(knex: any, s: any, ronda: number) {
  const todos = await candidatosAbiertos(knex, s, null)
  const rechazaron = (await knex.schema.hasTable(T_RESPUESTA))
    ? new Set(((await knex(T_RESPUESTA).where({ solicitud_id: s.id }).select("seller_id")) as any[]).map((r) => r.seller_id))
    : new Set<string>()
  const max = ronda >= 3 ? RONDA3_MAX : RONDA2_MAX
  const ids = todos.map((t) => t.id).filter((id) => !rechazaron.has(id))
  if (s.taller_id && !ids.includes(s.taller_id) && !rechazaron.has(s.taller_id)) ids.unshift(s.taller_id)
  return ids.slice(0, max)
}

export async function ampliar(knex: any, logger: any, s: any, ronda: number) {
  const folio = folioTexto(s.folio)
  // Marcar primero: si el job corre dos veces a la vez, sólo uno avisa
  const n = await knex(T_SOLICITUD)
    .where({ id: s.id, estado: "abierta" })
    .where((q: any) => q.whereNull("difusion_ronda").orWhere("difusion_ronda", "<", ronda))
    .update({
      difusion_ronda: ronda,
      ...(ronda >= 3 ? { cierra_en: new Date(new Date(s.cierra_en).getTime() + DIAS_EXTRA * DIA) } : {}),
      updated_at: knex.fn.now(),
    })
  if (!n) return 0

  const ids = await talleresDeRonda(knex, s, ronda)
  const avisados = await difundirSolicitud(knex, logger, s, {
    ronda,
    ids,
    titulo: ronda >= 3 ? "Última oportunidad: nadie ha cotizado" : "Sigue sin propuestas: sé el primero",
    intro:
      ronda >= 3
        ? `Esta solicitud no ha recibido ninguna propuesta y le ampliamos el plazo ${DIAS_EXTRA} días. Si cotizas ahora, la tuya es la única que el cliente va a ver.`
        : "Esta solicitud lleva 2 días sin propuestas y el cliente sigue esperando. Si cotizas ahora, la tuya es la primera que va a ver.",
  })

  if (ronda >= 3) {
    await anotar(knex, s.id, "sistema", `Todavía no hay propuestas: ampliamos el plazo ${DIAS_EXTRA} días y se la mandamos a más talleres.`).catch(() => null)
    if (s.contacto?.email) {
      const r = await sendEmail({
        to: s.contacto.email,
        subject: `[${folio}] Ampliamos tu solicitud ${DIAS_EXTRA} días`,
        html: marco(
          "Estamos buscándote más talleres",
          `<p style="margin:0 0 12px;color:#40403A">Hola${s.contacto.nombre ? ` ${esc(String(s.contacto.nombre).split(" ")[0])}` : ""}, ` +
            `tu solicitud <strong>${esc(folio)}</strong> todavía no recibe propuestas, así que le dimos <strong>${DIAS_EXTRA} días más</strong> ` +
            `y se la mandamos a ${avisados} ${avisados === 1 ? "taller" : "talleres"}. Te avisamos en cuanto llegue la primera.</p>` +
            `<p style="margin:0 0 12px;color:#40403A">Ayuda mucho que tenga el archivo (DXF, STEP o PDF con medidas), la cantidad y el material. Si te falta algo, puedes agregarlo desde tu liga.</p>` +
            boton("Ver mi solicitud", ligaPropuestas(s.token))
        ),
      })
      if (!r.sent) logger.info(`[ampliar] aviso al cliente no enviado (${folio}): ${r.reason}`)
    }
    const destino = process.env.HETNA_LEADS_EMAIL
    if (destino) {
      const r = await sendEmail({
        to: destino,
        subject: `[${folio}] Sin propuestas a 1 día del cierre: búscale taller`,
        html: marco(
          `${folio} no tiene propuestas`,
          `<p style="margin:0 0 12px;color:#40403A">Se amplió ${DIAS_EXTRA} días y se avisó a ${avisados} talleres. ` +
            `Todavía hay tiempo de conseguirle taller antes de que cierre.</p>` +
            `<p style="margin:0 0 12px;color:#40403A">Cliente: <strong>${esc(s.contacto?.nombre || "")}</strong> · ${esc(s.contacto?.email || "")} · ${esc(s.contacto?.telefono || "")}</p>` +
            tablaTrabajo(s.trabajo || { descripcion: "" })
        ),
      })
      if (!r.sent) logger.info(`[ampliar] aviso a HETNA no enviado (${folio}): ${r.reason}`)
    }
  }
  logger.info(`[ampliar] ${folio} ronda ${ronda}: ${avisados} talleres avisados`)
  return avisados
}
