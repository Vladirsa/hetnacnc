// WhatsApp al cliente que pidió cotización (decidido por Vlado el 27 nov 2026):
// en cuanto manda su solicitud se le confirma que HETNA le está buscando el
// mejor taller, con la liga privada para ver y comparar propuestas.
//
// - Un solo mensaje por solicitud (columna wa_confirmada_en).
// - Sólo al número que el cliente escribió en el formulario para que lo
//   contactemos, y nunca si ese número escribió BAJA.
// - El número queda en hetna_whatsapp (sin verificar) para que BAJA funcione.
// - Las que entraron sin mensaje (antes de esto o con WhatsApp caído) las
//   alcanza el job de seguimiento, de 8 a 21 h de CDMX, hasta 3 días después.
// SOLICITUD_WHATSAPP=0 en el .env lo apaga.
import { T_SOLICITUD, folioTexto, ligaPropuestas } from "./licitacion"
import { T_WA, asegurarWhatsapp, enviarTexto, normalizarNumero, whatsappListo } from "./whatsapp"

let columnaLista = false
async function asegurarColumna(knex: any) {
  if (columnaLista) return
  if (!(await knex.schema.hasColumn(T_SOLICITUD, "wa_confirmada_en"))) {
    await knex.schema.alterTable(T_SOLICITUD, (t: any) => t.timestamp("wa_confirmada_en", { useTz: true }).nullable())
  }
  columnaLista = true
}

const activo = () => process.env.SOLICITUD_WHATSAPP !== "0" && whatsappListo()

/** Primer nombre, con mayúscula inicial ("ALFREDO PEREZ" → "Alfredo"). */
export function primerNombre(nombre?: string | null) {
  const n = String(nombre || "").trim().split(/\s+/)[0] || ""
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : ""
}

export function textoConfirmacion(s: { folio: number | string; token: string; trabajo?: any; contacto?: any; tipo?: string }) {
  const t = s.trabajo || {}
  const que = [t.servicio && t.servicio !== "Otro" ? t.servicio : "", t.material ? `en ${t.material}` : ""].filter(Boolean).join(" ")
  const nombre = primerNombre(s.contacto?.nombre)
  const quien = s.tipo === "suministro" ? "proveedor" : "taller"
  return [
    `Hola${nombre ? ` ${nombre}` : ""} 👋, te saluda HETNA CNC.`,
    "",
    `Recibimos tu solicitud *${folioTexto(s.folio)}*${que ? ` (${que})` : ""}. Ya estamos buscando el mejor ${quien} para que te dé tu cotización.`,
    "",
    "En cuanto lleguen propuestas te avisamos. Aquí puedes ver tu solicitud y comparar precios:",
    ligaPropuestas(s.token),
    "",
    "Si tienes el archivo, fotos o medidas, mándalos por aquí y se los pasamos a los talleres.",
    "",
    "_Si no quieres mensajes por WhatsApp, escribe BAJA._",
  ].join("\n")
}

/**
 * Manda la confirmación una sola vez. true si salió. Nunca truena al que la llama.
 */
export async function confirmarSolicitudWhatsapp(knex: any, s: any, logger?: any): Promise<boolean> {
  try {
    if (!activo()) return false
    const numero = normalizarNumero(s?.contacto?.whatsapp || s?.contacto?.telefono || "")
    if (!numero) return false
    await asegurarColumna(knex)
    await asegurarWhatsapp(knex)
    const ya = await knex(T_WA).where({ numero }).first("avisos")
    if (ya && ya.avisos === false) return false // escribió BAJA
    // Se aparta antes de mandar: si dos procesos llegan juntos, sólo uno manda
    const apartada = await knex(T_SOLICITUD).where({ id: s.id }).whereNull("wa_confirmada_en").update({ wa_confirmada_en: knex.fn.now() })
    if (!apartada) return false
    try {
      if (!ya) await knex(T_WA).insert({ numero, quien: "cliente", avisos: true }).onConflict("numero").ignore()
      await enviarTexto(numero, textoConfirmacion(s))
      logger?.info?.(`[solicitud-whatsapp] ${folioTexto(s.folio)}: confirmación enviada`)
      return true
    } catch (e) {
      // No salió (WhatsApp caído o tope del día): se libera para que el job lo reintente
      await knex(T_SOLICITUD).where({ id: s.id }).update({ wa_confirmada_en: null }).catch(() => null)
      throw e
    }
  } catch (e) {
    logger?.warn?.(`[solicitud-whatsapp] ${s?.id}: ${(e as Error).message}`)
    return false
  }
}

const horaCdmx = () => Number(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hour12: false })) % 24

/** Job: las solicitudes de los últimos 3 días que no recibieron su mensaje (de 8 a 21 h). */
export async function confirmarPendientes(knex: any, logger?: any) {
  if (!activo()) return 0
  const h = horaCdmx()
  if (h < 8 || h >= 21) return 0
  await asegurarColumna(knex)
  const pendientes = (await knex(T_SOLICITUD)
    .whereNull("wa_confirmada_en")
    .whereNotIn("estado", ["cerrada", "cancelada", "pagada", "elegida"])
    .where("created_at", ">=", knex.raw("now() - interval '3 days'"))
    .orderBy("created_at", "asc")
    .limit(20)
    .select("id", "folio", "token", "trabajo", "contacto", "tipo")) as any[]
  let n = 0
  for (const s of pendientes) if (await confirmarSolicitudWhatsapp(knex, s, logger)) n++
  return n
}
