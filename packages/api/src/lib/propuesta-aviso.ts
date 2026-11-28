// Aviso al cliente de que llegó una propuesta nueva (panel del taller y
// propuesta por WhatsApp usan el mismo).
import { pushACliente } from "./push"
import { sendEmail } from "./resend"
import { boton, fila, folioTexto, ligaPropuestas, marco } from "./licitacion"

export async function avisarPropuestaNueva(knex: any, logger: any, s: any, p: { precio: number; moneda: string; dias: number }) {
  const folio = folioTexto(s.folio)
  await pushACliente(
    knex,
    { customerId: s.cliente_id, email: s.contacto?.email },
    {
      titulo: "Tienes una nueva propuesta",
      cuerpo: `${folio}: $${p.precio.toLocaleString("es-MX")} ${p.moneda}, entrega en ${p.dias} días. Compárala con las demás.`,
      url: ligaPropuestas(s.token),
      etiqueta: `sol-${s.id}`,
    },
    logger
  )
  // Por WhatsApp a quien ya platica con HETNA por ahí (respeta BAJA)
  const { avisarClienteWhatsapp } = require("./cliente-whatsapp")
  await avisarClienteWhatsapp(
    knex,
    s,
    `Tiene una nueva propuesta para su solicitud *${folio}*: $${p.precio.toLocaleString("es-MX")} ${p.moneda}, entrega en ${p.dias} días.\n\nPuede compararla con las demás aquí: ${ligaPropuestas(s.token)}`,
    logger
  )
  // A HETNA: cada propuesta es una venta en camino (Telegram y el celular del dueño)
  try {
    const { mandarPrivado } = require("./social-telegram")
    await mandarPrivado(knex, { texto: `💰 Nueva propuesta en ${folio}: $${p.precio.toLocaleString("es-MX")} ${p.moneda}, ${p.dias} días.\n${ligaPropuestas(s.token)}` }).catch(() => null)
    const { correosDeLaCasa } = require("./cuentas-casa")
    const casa = (await knex("customer").whereNull("deleted_at").whereIn(knex.raw("lower(email)"), correosDeLaCasa()).pluck("id").catch(() => [])) as string[]
    for (const id of casa)
      await pushACliente(
        knex,
        { customerId: id },
        { titulo: `💰 Nueva propuesta en ${folio}`, cuerpo: `$${p.precio.toLocaleString("es-MX")} ${p.moneda}, entrega en ${p.dias} días.`, url: ligaPropuestas(s.token), etiqueta: `hetna-prop-${s.id}` },
        logger,
        { whatsapp: false }
      )
  } catch (e) {
    logger?.warn?.(`[licitacion] aviso de propuesta a HETNA: ${(e as Error).message}`)
  }
  if (s.contacto?.email) {
    const r = await sendEmail({
      to: s.contacto.email,
      subject: `[${folio}] Recibiste una nueva propuesta`,
      html: marco(
        "Tienes una nueva propuesta",
        `<table style="border-collapse:collapse;font-size:14px">` +
          fila("Folio", folio) +
          fila("Precio", `$${p.precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${p.moneda}`) +
          fila("Entrega", `${p.dias} días`) +
          `</table>` +
          boton("Comparar propuestas", ligaPropuestas(s.token))
      ),
    })
    if (!r.sent) logger?.info?.(`[licitacion] aviso de propuesta no enviado: ${r.reason}`)
  }
}
