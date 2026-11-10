// @ts-nocheck
// Resumen semanal de crecimiento (lunes 8:00 del centro): los 3 números de la
// estrategia — talleres activos, cotizaciones con simulador, licitaciones
// cerradas — comparados con la semana anterior, por correo y al celular.
// Mismos destinatarios que el informe diario (CONTROL_AVISOS_PARA /
// RESUMEN_DIARIO_PARA / cuenta de la casa). Para apagarlo: RESUMEN_CRECIMIENTO=off.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { metricasCrecimiento } from "../lib/crecimiento"
import { correosDeLaCasa } from "../lib/cuentas-casa"
import { pushACliente } from "../lib/push"
import { sendEmail } from "../lib/resend"

const STORE = (process.env.STOREFRONT_URL || process.env.STORE_URL || "https://hetnacnc.com").replace(/\/$/, "")

const flecha = (a, b) => (a > b ? `▲ +${a - b}` : a < b ? `▼ ${a - b}` : "= igual")
const fila = (k, v, c) => `<tr><td style="padding:7px 0;border-bottom:1px solid #eee;color:#555;font-size:13px">${k}</td><td style="padding:7px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700;font-size:15px">${v}</td><td style="padding:7px 0 7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;color:#777">${c}</td></tr>`

export default async function resumenCrecimiento(container) {
  if (String(process.env.RESUMEN_CRECIMIENTO || "on").toLowerCase() === "off") return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const para = String(process.env.CONTROL_AVISOS_PARA || process.env.RESUMEN_DIARIO_PARA || correosDeLaCasa()[0] || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (!para.length) return
  try {
    const m = await metricasCrecimiento(container)
    const s = m.semanas
    const hoy = s[s.length - 1] || {}, ayer = s[s.length - 2] || {}
    // La última "semana" del arreglo es la que empieza hoy (lunes), así que la
    // semana cerrada es la penúltima y se compara con la antepenúltima.
    const cerrada = s.length >= 2 ? s[s.length - 2] : hoy
    const previa = s.length >= 3 ? s[s.length - 3] : ayer
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
<h2 style="margin:0 0 4px">Crecimiento · semana del ${cerrada.semana}</h2>
<p style="margin:0 0 14px;color:#666;font-size:13px">Los 3 números de la estrategia, comparados con la semana anterior.</p>
<table style="width:100%;border-collapse:collapse">
${fila("Talleres activos", cerrada.activos, flecha(cerrada.activos, previa.activos))}
${fila("Cotizaciones con simulador", `${cerrada.simulador} <span style="font-weight:400;color:#888">de ${cerrada.cotizaciones}</span>`, flecha(cerrada.simulador, previa.simulador))}
${fila("Licitaciones cerradas", cerrada.licitaciones, flecha(cerrada.licitaciones, previa.licitaciones))}
${fila("Talleres nuevos", cerrada.nuevos, flecha(cerrada.nuevos, previa.nuevos))}
</table>
<p style="margin:14px 0 0;font-size:13px;color:#555">Últimos 30 días: <b>${m.resumen.activos_30}</b> talleres activos de ${m.resumen.talleres} · <b>${m.resumen.simulador_30}</b> de ${m.resumen.cotizaciones_30} cotizaciones con simulador · <b>${m.resumen.licitaciones_30}</b> licitaciones cerradas · <b>${m.resumen.nuevos_30}</b> nuevos${m.resumen.mismo_dia_pct != null ? ` (${m.resumen.mismo_dia_pct}% cotizó el primer día)` : ""}${m.resumen.referidos_30 ? ` · ${m.resumen.referidos_30} por referido` : ""}.</p>
<p style="margin:18px 0 0"><a href="${STORE}/es/panel/cotizador" style="background:#0F7A4A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px">Abrir el panel</a></p>
</div>`
    for (const to of para) await sendEmail({ to, subject: `Crecimiento semanal · ${cerrada.activos} activos · ${cerrada.simulador} con simulador · ${cerrada.licitaciones} licitaciones`, html })
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    for (const correo of para) {
      await pushACliente(knex, { email: correo }, {
        titulo: `Semana: ${cerrada.activos} activos · ${cerrada.simulador} con simulador`,
        cuerpo: `${cerrada.licitaciones} licitaciones cerradas · ${cerrada.nuevos} talleres nuevos. Toca para ver la tendencia.`,
        url: `${STORE}/es/panel/cotizador`,
        etiqueta: "crecimiento-semanal",
      }, logger)
    }
  } catch (e) {
    logger.warn(`[resumen-crecimiento] ${e.message}`)
  }
}

export const config = {
  name: "resumen-crecimiento",
  // Lunes 8:00 del centro (14:00 UTC)
  schedule: "0 14 * * 1",
}
