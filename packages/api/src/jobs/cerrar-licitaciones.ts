// Cada hora: las solicitudes de licitación que pasaron su fecha de cierre
// (7 días) dejan de recibir propuestas. Ver recibePropuestas en lib/licitacion.
//
// Lo que pasa depende de si alguien propuso:
//   - con propuestas: la solicitud sigue "abierta" para que el cliente pueda
//     elegir, y se le avisa una vez que ya no llegan más y le toca escoger;
//   - sin propuestas: pasa a "cerrada" y se le avisa a HETNA, que es un
//     cliente que pidió trabajo y nadie atendió: hay que buscarle taller a mano
//     antes de que se vaya.
//
// aviso_cierre marca que el aviso ya salió, para no repetirlo cada hora.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../lib/resend"
import {
  T_PROPUESTA,
  T_SOLICITUD,
  asegurarTablas,
  boton,
  esc,
  folioTexto,
  ligaPropuestas,
  marco,
  tablaTrabajo,
} from "../lib/licitacion"
import { cambiarEtapa } from "../lib/seguimiento"

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async function cerrarLicitaciones(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  try {
    await asegurarTablas(knex)
    const vencidas = (await knex(T_SOLICITUD)
      .where({ estado: "abierta" })
      .whereNotNull("cierra_en")
      .where("cierra_en", "<=", knex.fn.now())
      .whereNull("aviso_cierre")
      .limit(50)
      .select("id", "folio", "token", "modo", "trabajo", "contacto", "etapa")) as any[]
    if (!vencidas.length) return

    const conteos = (await knex(T_PROPUESTA)
      .whereIn("solicitud_id", vencidas.map((s) => s.id))
      .groupBy("solicitud_id")
      .select("solicitud_id")
      .count("* as n")) as { solicitud_id: string; n: string }[]
    const nPorSol = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))

    let aElegir = 0
    let sinPropuestas = 0
    for (const s of vencidas) {
      const folio = folioTexto(s.folio)
      const n = nPorSol[s.id] || 0

      if (n > 0) {
        await knex(T_SOLICITUD).where({ id: s.id }).update({ aviso_cierre: knex.fn.now(), updated_at: knex.fn.now() })
        if (s.contacto?.email) {
          const r = await sendEmail({
            to: s.contacto.email,
            subject: `[${folio}] Ya puedes elegir: tienes ${n} ${n === 1 ? "propuesta" : "propuestas"}`,
            html: marco(
              "Tu solicitud cerró: elige tu taller",
              `<p style="margin:0 0 12px;color:#40403A">Hola${s.contacto.nombre ? ` ${esc(s.contacto.nombre)}` : ""}, ` +
                `la solicitud <strong>${esc(folio)}</strong> ya no recibe propuestas nuevas y te llegaron ` +
                `<strong>${n}</strong>. Compáralas por precio y tiempo de entrega y elige la que más te convenga; ` +
                `el pago se hace dentro de HETNA.</p>` +
                boton("Comparar y elegir", ligaPropuestas(s.token))
            ),
          })
          if (!r.sent) logger.info(`[licitacion] aviso de cierre no enviado (${folio}): ${r.reason}`)
          await pausa(600)
        }
        aElegir += 1
      } else {
        await knex(T_SOLICITUD)
          .where({ id: s.id })
          .update({ estado: "cerrada", aviso_cierre: knex.fn.now(), updated_at: knex.fn.now() })
        await cambiarEtapa(knex, s, "cerrada", {
          actor: "sistema",
          nota: "Ningún taller cotizó en los 7 días. HETNA te va a contactar para buscarte taller.",
          correo: false,
        }).catch((e: Error) => logger.warn(`[seguimiento] ${folio}: ${e.message}`))
        const destino = process.env.HETNA_LEADS_EMAIL
        if (destino) {
          const r = await sendEmail({
            to: destino,
            subject: `[${folio}] Cerró SIN propuestas: búscale taller`,
            html: marco(
              `${folio} cerró sin ninguna propuesta`,
              `<p style="margin:0 0 12px;color:#40403A">Pasaron 7 días y ningún taller cotizó. ` +
                `Es un cliente que pidió trabajo: conviene buscarle taller a mano o escribirle.</p>` +
                `<table style="border-collapse:collapse;font-size:14px;margin-bottom:12px">` +
                `<tr><td style="padding:4px 12px 4px 0;color:#6B675C">Cliente</td><td><strong>${esc(s.contacto?.nombre || "")}</strong> · ${esc(s.contacto?.email || "")} · ${esc(s.contacto?.telefono || "")}</td></tr>` +
                `</table>` +
                tablaTrabajo(s.trabajo || { descripcion: "" })
            ),
          })
          if (!r.sent) logger.info(`[licitacion] aviso a HETNA no enviado (${folio}): ${r.reason}`)
          await pausa(600)
        }
        sinPropuestas += 1
      }
    }
    logger.info(`[licitacion] cierre: ${aElegir} con propuestas (cliente avisado), ${sinPropuestas} sin propuestas (cerradas)`)
  } catch (e) {
    logger.error(`[licitacion] no se pudieron cerrar las vencidas: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cerrar-licitaciones",
  schedule: "23 * * * *",
}
