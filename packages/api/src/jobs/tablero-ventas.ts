import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correosDeLaCasa } from "../lib/cuentas-casa"
import { sendEmail } from "../lib/resend"
import { mandarPrivado } from "../lib/social-telegram"
import { calcularTablero, htmlTablero, textoTablero } from "../lib/tablero-ventas"

// Tablero de ventas de la semana (lib/tablero-ventas.ts): por Telegram al dueño
// y por correo a los mismos destinatarios del resumen diario. TABLERO_VENTAS=off lo apaga.
export default async function tableroVentas(container: MedusaContainer) {
  if (String(process.env.TABLERO_VENTAS || "on").toLowerCase() === "off") return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const t = await calcularTablero(container, logger)
    const texto = textoTablero(t)
    const tg = await mandarPrivado(knex, { texto })
    if (!tg?.ok) logger.warn(`[tablero-ventas] Telegram: ${tg?.error || "no se pudo mandar"}`)
    const para = String(process.env.CONTROL_AVISOS_PARA || process.env.RESUMEN_DIARIO_PARA || correosDeLaCasa()[0] || "").split(",").map((s) => s.trim()).filter(Boolean)
    const panel = (process.env.ADMIN_URL || "https://hetnacnc.com/dashboard").replace(/\/$/, "")
    for (const to of para) await sendEmail({ to, subject: `Tablero de la semana · ${t.ventas?.pedidos ?? 0} pedidos · ${t.creditos?.compras ?? 0} compras de créditos`, html: htmlTablero(t, panel) })
  } catch (e) {
    logger.error(`[tablero-ventas] ${(e as Error).message}`)
  }
}

export const config = {
  name: "tablero-ventas",
  // Lunes 8:13 del centro de México (14:13 UTC), justo después del resumen de crecimiento
  schedule: "13 14 * * 1",
}
