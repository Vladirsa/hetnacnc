// POST /admin/hetna-solicitudes/:id/accion
//   { accion: "aprobar", nota? }               → a los talleres
//   { accion: "pedir_info", nota }             → correo al cliente, sigue en revisión
//   { accion: "cancelar", nota }               → cancelada, con correo al cliente
//   { accion: "etapa", etapa, nota? }          → mover a mano (corrige lo que haga falta)
//   { accion: "nota", nota, interna? }         → sólo anota en el historial
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { aprobarSolicitud } from "../../../../../lib/difusion"
import { T_SOLICITUD, boton, esc, folioTexto, ligaPropuestas, marco } from "../../../../../lib/licitacion"
import { sendEmail } from "../../../../../lib/resend"
import { ETAPAS, type Etapa, anotar, asegurarSeguimiento, cambiarEtapa } from "../../../../../lib/seguimiento"

type Body = { accion?: string; etapa?: string; nota?: string; interna?: boolean }

export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSeguimiento(knex)
  const b = (req.body || {}) as Body
  const nota = String(b.nota || "").trim().slice(0, 2000)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  const folio = folioTexto(s.folio)

  switch (b.accion) {
    case "aprobar": {
      if (s.estado !== "revision") return res.status(409).json({ message: "Esta solicitud ya no está en revisión." })
      // Se responde antes de difundir: avisar a 60 talleres tarda (Resend
      // permite ~2 correos por segundo).
      res.json({ ok: true })
      await aprobarSolicitud(knex, logger, s, "hetna", nota || undefined)
      return
    }
    case "pedir_info": {
      if (nota.length < 5) return res.status(400).json({ message: "Escribe qué le falta al cliente." })
      await anotar(knex, s.id, "hetna", `HETNA pidió más información: ${nota}`)
      if (s.contacto?.email) {
        await sendEmail({
          to: s.contacto.email,
          subject: `[${folio}] Nos falta un dato para cotizar tu trabajo`,
          html: marco(
            "Nos falta un dato",
            `<p style="margin:0 0 12px;color:#40403A">Para que los talleres te den un precio real de tu solicitud <strong>${esc(folio)}</strong> necesitamos:</p>` +
              `<p style="margin:0 0 12px;color:#40403A;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(nota)}</p>` +
              `<p style="margin:0 0 12px;color:#40403A">Contesta este correo o escríbenos por WhatsApp con tu folio.</p>` +
              boton("Ver mi solicitud", ligaPropuestas(s.token))
          ),
        })
      }
      return res.json({ ok: true })
    }
    case "cancelar": {
      if (nota.length < 5) return res.status(400).json({ message: "Escribe el motivo: el cliente lo va a leer." })
      await cambiarEtapa(knex, s, "cancelada", { actor: "hetna", nota, extra: { estado: "cerrada" }, logger })
      return res.json({ ok: true })
    }
    case "etapa": {
      const etapa = String(b.etapa || "") as Etapa
      if (!(ETAPAS as readonly string[]).includes(etapa)) return res.status(400).json({ message: "Etapa no válida." })
      // Mover a mano no cambia el estado de la licitación (abierta/elegida/
      // pagada): eso lo deciden la elección y el pago. Sólo cerrar y cancelar
      // la sacan de la lista de los talleres.
      const extra = etapa === "cerrada" || etapa === "cancelada" ? { estado: "cerrada" } : undefined
      await cambiarEtapa(knex, s, etapa, { actor: "hetna", nota: nota || undefined, extra, logger })
      return res.json({ ok: true })
    }
    case "nota": {
      if (!nota) return res.status(400).json({ message: "Escribe la nota." })
      await anotar(knex, s.id, "hetna", nota, !b.interna)
      return res.json({ ok: true })
    }
    default:
      return res.status(400).json({ message: "Acción no válida." })
  }
}
