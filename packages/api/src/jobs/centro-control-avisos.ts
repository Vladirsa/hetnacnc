// @ts-nocheck
// Avisos automáticos del Centro de control (lib/centro-control.ts).
//
//   - Cada mañana (7:40 del centro): el resumen de ayer y todo lo que necesita
//     atención, aunque no haya nada urgente ("todo en orden" también es dato).
//   - Cada 2 horas, de 8 a 22 h: SOLO si apareció algo URGENTE nuevo (pedido
//     sin enviar, reclamo, reseña mala, guía sin saldo). Cada aviso sale una vez:
//     se anota en hetna_control_aviso para no repetirlo.
//
// A quién: CONTROL_AVISOS_PARA (o RESUMEN_DIARIO_PARA, o la cuenta de la casa).
// Se puede poner más de un correo separado por comas (por ejemplo, el tuyo y el
// de tu esposa). Para apagarlo: CONTROL_AVISOS=off.
import { createHash } from "crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ADMIN, calcularCentroControl, correoCentroControl } from "../lib/centro-control"
import { correosDeLaCasa } from "../lib/cuentas-casa"
import { sendEmail } from "../lib/resend"

const T = "hetna_control_aviso"

const destinatarios = () =>
  String(process.env.CONTROL_AVISOS_PARA || process.env.RESUMEN_DIARIO_PARA || correosDeLaCasa()[0] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

const clave = (a) => createHash("sha1").update(`${a.tipo}|${a.url || ""}|${a.titulo}`).digest("hex")

export default async function centroControlAvisos(container) {
  const logger = container.resolve("logger")
  if ((process.env.CONTROL_AVISOS || "").toLowerCase() === "off" || !process.env.RESEND_API_KEY) return
  const para = destinatarios()
  if (!para.length) return

  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    if (!(await knex.schema.hasTable(T))) {
      await knex.schema.createTable(T, (t) => {
        t.text("clave").primary()
        t.timestamp("enviado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      })
    }

    // La hora de México decide si es el correo de la mañana o una revisión
    const hora = Number(new Intl.DateTimeFormat("es-MX", { hour: "numeric", hour12: false, timeZone: "America/Mexico_City" }).format(new Date()))
    const manana = hora === 7

    const d = await calcularCentroControl(container, { dias: 1 })
    const urgentes = d.avisos.filter((a) => a.nivel === "rojo")
    const ya = new Set((await knex(T).whereIn("clave", urgentes.map(clave)).select("clave")).map((f) => f.clave))
    const nuevos = urgentes.filter((a) => !ya.has(clave(a)))

    if (manana) {
      const { asunto, html } = correoCentroControl(d)
      for (const to of para) await sendEmail({ to, subject: asunto, html })
    } else if (nuevos.length) {
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#142033">
<h2 style="margin:0 0 10px;color:#B42318">Atiende esto hoy</h2>
${nuevos
  .map(
    (a) => `<p style="margin:0 0 12px"><b>${a.titulo}</b><br><span style="color:#555;font-size:13px">${a.detalle || ""}</span>${
      a.url ? `<br><a href="${a.url}" style="color:#C2560A;font-size:13px">Abrir</a>` : ""
    }</p>`
  )
  .join("")}
<p><a href="${ADMIN}/control" style="background:#C2560A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Abrir el centro de control</a></p></div>`
      for (const to of para) await sendEmail({ to, subject: `⚠ HETNA: ${nuevos[0].titulo}${nuevos.length > 1 ? ` y ${nuevos.length - 1} más` : ""}`, html })
    }

    if (nuevos.length) await knex(T).insert(nuevos.map((a) => ({ clave: clave(a) }))).onConflict("clave").ignore()
    // Lo de hace más de 30 días se puede volver a avisar si sigue igual
    await knex(T).where("enviado", "<", new Date(Date.now() - 30 * 86_400_000)).del()
    logger.info(`[centro-control] ${manana ? "resumen de la mañana" : "revisión"}: ${urgentes.length} urgentes, ${nuevos.length} nuevos`)
  } catch (e) {
    logger.error(`[centro-control] avisos: ${e?.message || e}`)
  }
}

export const config = {
  name: "centro-control-avisos",
  // Cada 2 horas de 7:40 a 21:40 del centro (13:40 a 03:40 UTC)
  schedule: "40 13,15,17,19,21,23,1,3 * * *",
}
