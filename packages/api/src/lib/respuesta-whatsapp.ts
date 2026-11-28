// El cliente contesta por WhatsApp la pregunta de un taller (pedido de Vlado,
// 28 nov 2026). Cuando a un cliente se le manda por WhatsApp la pregunta de un
// taller (lib/licitacion-extra.ts → wa_enviada_en), lo siguiente que escriba en
// ese chat en las próximas 72 h se guarda como su respuesta: le llega al taller
// (y a los que ya cotizaron) en su panel, por correo y al celular, igual que si
// la contestara en la liga.
import { T_PREGUNTA, responder } from "./licitacion-extra"
import { T_SOLICITUD, folioTexto } from "./licitacion"
import { enviarTexto, normalizarNumero, whatsappListo } from "./whatsapp"
import { asegurar as asegurarChat, guardarMsg } from "./whatsapp-bot"

const HORAS = 72
// «ok», «gracias», un emoji: no es una respuesta (se deja para la plática normal)
const NO_ES_RESPUESTA = /^\s*(ok|okay|vale|gracias|muchas gracias|👍|🙏|😊|enterado)[\s.!]*$/i

let columnaLista = false
export async function asegurarColumnaWa(knex: any) {
  if (columnaLista) return
  if ((await knex.schema.hasTable(T_PREGUNTA)) && !(await knex.schema.hasColumn(T_PREGUNTA, "wa_enviada_en")))
    await knex.schema.alterTable(T_PREGUNTA, (t: any) => t.timestamp("wa_enviada_en", { useTz: true }).nullable())
  columnaLista = true
}

export const esRespuesta = (texto: string) => String(texto || "").trim().length >= 2 && !NO_ES_RESPUESTA.test(texto)

/** ¿Este mensaje contesta una pregunta pendiente? Si sí, la guarda, confirma y regresa true. */
export async function atenderRespuestaPregunta(knex: any, m: { numero: string; texto?: string; tipo?: string }, logger?: any) {
  const numero = normalizarNumero(m.numero)
  const texto = String(m.texto || "").trim()
  if (!numero || !whatsappListo() || !esRespuesta(texto)) return false
  if (!(await knex.schema.hasTable(T_PREGUNTA))) return false
  await asegurarColumnaWa(knex)
  const pendientes = (await knex(`${T_PREGUNTA} as p`)
    .join(`${T_SOLICITUD} as s`, "s.id", "p.solicitud_id")
    .whereNull("p.respuesta")
    .whereNotNull("p.wa_enviada_en")
    .where("p.wa_enviada_en", ">=", knex.raw(`now() - interval '${HORAS} hours'`))
    .whereNotIn("s.estado", ["cerrada", "cancelada"])
    .orderBy("p.wa_enviada_en", "desc")
    .limit(20)
    .select("p.id as pregunta_id", "p.pregunta", "s.*")
    .catch(() => [])) as any[]
  // La más reciente que se le mandó a ESTE número
  const p = pendientes.find((x) => normalizarNumero(x.contacto?.whatsapp || x.contacto?.telefono || "") === numero)
  if (!p) return false
  try {
    await responder(knex, p, p.pregunta_id, texto, logger)
  } catch (e) {
    logger?.warn?.(`[respuesta-whatsapp] ${(e as Error).message}`)
    return false
  }
  const quedan = pendientes.filter((x) => x.id === p.id && x.pregunta_id !== p.pregunta_id).length
  const conf =
    `Gracias. Ya le pasamos su respuesta a los talleres que cotizan su solicitud *${folioTexto(p.folio)}*.` +
    (quedan ? ` Hay ${quedan === 1 ? "otra pregunta pendiente" : `${quedan} preguntas pendientes`}; puede contestarla${quedan === 1 ? "" : "s"} por aquí también.` : "")
  await enviarTexto(numero, conf).catch(() => null)
  await asegurarChat(knex)
    .then(async () => {
      await guardarMsg(knex, numero, "cliente", texto)
      await guardarMsg(knex, numero, "agente", conf)
    })
    .catch(() => null)
  logger?.info?.(`[respuesta-whatsapp] ${folioTexto(p.folio)}: respuesta del cliente guardada`)
  return true
}
