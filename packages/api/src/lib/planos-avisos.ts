// Envío del aviso "Plano gratis de la semana" a los suscritos de la Biblioteca
// de planos (lib/planos-correo.ts). Lo llama el job planos-semanal.
import { estaDeBaja, ligaBaja } from "./baja"
import { T_PLANOS_AVISOS, cargarNombresPlanos, correoAvisoHtml, nombrePlano, suscritosPendientes } from "./planos-correo"
import { sendEmail } from "./resend"

export async function avisarPlano(knex: any, slug: string, logger?: any) {
  await cargarNombresPlanos(knex)
  const nombre = nombrePlano(slug)
  if (!nombre) return { enviados: 0, omitidos: 0 }
  const lote = await suscritosPendientes(knex, slug)
  let enviados = 0, omitidos = 0
  for (const s of lote) {
    if (await estaDeBaja(knex, s.email).catch(() => false)) {
      omitidos++
    } else {
      const baja = ligaBaja(s.email)
      // sin liga de baja (falta el secreto) no sale un correo de marketing
      if (!baja) {
        logger?.warn?.("[planos-semanal] sin secreto para la liga de baja; no mando avisos")
        break
      }
      const r = await sendEmail({ to: s.email, bajaUrl: baja, subject: `Plano gratis de la semana: ${nombre} — HETNA CNC`, html: correoAvisoHtml(slug, s.nombre) })
      if (!r.sent) {
        logger?.warn?.(`[planos-semanal] no enviado: ${r.reason}`)
        if (r.configuracion || /no configurados/.test(String(r.reason))) break
        continue // pasajero: se reintenta en la próxima corrida
      }
      enviados++
    }
    await knex(T_PLANOS_AVISOS).insert({ plano: slug, email: s.email }).onConflict(["plano", "email"]).ignore()
  }
  return { enviados, omitidos }
}
