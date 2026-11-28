// Aviso por WhatsApp al cliente de una solicitud (propuesta nueva, pregunta de un
// taller…). Sólo a quien ya platica con HETNA por WhatsApp sobre esa solicitud
// (wa_confirmada_en) y nunca si escribió BAJA. No truena al que lo llama.
import { T_WA, enviarTexto, normalizarNumero, whatsappListo } from "./whatsapp"

export async function avisarClienteWhatsapp(knex: any, s: any, texto: string, logger?: any): Promise<boolean> {
  try {
    const numero = normalizarNumero(s?.contacto?.whatsapp || s?.contacto?.telefono || "")
    if (!numero || !s?.wa_confirmada_en || !whatsappListo()) return false
    const fila = await knex(T_WA).where({ numero }).first("avisos").catch(() => null)
    if (fila && fila.avisos === false) return false
    await enviarTexto(numero, texto)
    return true
  } catch (e) {
    logger?.warn?.(`[cliente-whatsapp] ${(e as Error).message}`)
    return false
  }
}
