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
