// POST /admin/hetna-solicitudes/:id/accion
//   { accion: "aprobar", nota? }               → a los talleres
//   { accion: "pedir_info", nota }             → correo al cliente, sigue en revisión con el
//                                                reloj de la aprobación automática detenido
//                                                (lib/seguimiento: horasEsperaInfo)
//   { accion: "cancelar", nota }               → cancelada, con correo al cliente
//   { accion: "etapa", etapa, nota?, interna? } → mover a mano (corrige lo que haga falta).
//       interna = la nota sólo la ve HETNA: no sale en la liga del cliente ni en su correo.
//       A "enviada_talleres" desde la revisión = aprobar (avisa a los talleres).
//   { accion: "nota", nota, interna? }         → sólo anota en el historial
//   { accion: "resolver_disputa", decision, nota }
//       decision = liberar           → el taller cobra; si ya entregó, se cierra y se avisa la liquidación
//                  reembolso_parcial → se cierra; HETNA devuelve al cliente y liquida al taller lo que diga la nota
//                  reembolso_total   → se cancela; HETNA devuelve al cliente todo lo que retiene
//       El reembolso y la transferencia los hace HETNA a mano en Mercado Pago/PayPal/banco.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { aprobarSolicitud } from "../../../../../lib/difusion"
import { T_SOLICITUD, boton, esc, folioTexto, ligaPropuestas, marco } from "../../../../../lib/licitacion"
import { sendEmail } from "../../../../../lib/resend"
import { ETAPAS, type Etapa, anotar, asegurarSeguimiento, cambiarEtapa, etapaDe } from "../../../../../lib/seguimiento"
import { propuestaElegida } from "../../../../../lib/licitacion-cobro"
import { avisarLiquidacion } from "../../../../../lib/liquidacion-aviso"

type Body = { accion?: string; etapa?: string; nota?: string; interna?: boolean; decision?: string }

const DECISION: Record<string, string> = {
  liberar: "HETNA resolvió el problema a favor del taller: se le libera el pago.",
  reembolso_parcial: "HETNA resolvió con un reembolso parcial.",
  reembolso_total: "HETNA resolvió con un reembolso total.",
}

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
      // Se detiene el reloj de la aprobación automática mientras el cliente contesta
      await knex(T_SOLICITUD).where({ id: s.id, estado: "revision" }).update({ info_pedida_en: knex.fn.now() })
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
      await cambiarEtapa(knex, s, "cancelada", { actor: "hetna", nota, extra: { estado: "cerrada", disputa: null, disputa_detalle: null }, logger })
      return res.json({ ok: true })
    }
    case "etapa": {
      const etapa = String(b.etapa || "") as Etapa
      if (!(ETAPAS as readonly string[]).includes(etapa)) return res.status(400).json({ message: "Etapa no válida." })
      // Mover a mano no cambia el estado de la licitación (abierta/elegida/
      // pagada): eso lo deciden la elección y el pago. Sólo cerrar y cancelar
      // la sacan de la lista de los talleres.
      // Cerrar o cancelar a mano también da por terminado un problema abierto.
      const interna = b.interna === true
      // Enviarla a talleres desde la revisión es aprobarla: mismo camino que el
      // botón "Aprobar" (difunde y avisa a los talleres). Se responde antes de
      // difundir. Desde otras etapas ya se difundió: sólo se corrige la etapa.
      if (etapa === "enviada_talleres" && s.estado === "revision") {
        res.json({ ok: true })
        const ok = await aprobarSolicitud(knex, logger, s, "hetna", interna ? undefined : nota || undefined)
        if (ok && interna && nota) await anotar(knex, s.id, "hetna", nota, false)
        return
      }
      const extra = etapa === "cerrada" || etapa === "cancelada" ? { estado: "cerrada", disputa: null, disputa_detalle: null } : undefined
      // El cambio de etapa siempre queda a la vista (la liga del cliente y el
      // expediente necesitan su fecha); lo que se esconde es sólo la nota interna.
      await cambiarEtapa(knex, s, etapa, { actor: "hetna", nota: interna ? undefined : nota || undefined, extra, logger })
      if (interna && nota) await anotar(knex, s.id, "hetna", nota, false)
      return res.json({ ok: true })
    }
    case "nota": {
      if (!nota) return res.status(400).json({ message: "Escribe la nota." })
      await anotar(knex, s.id, "hetna", nota, !b.interna)
      return res.json({ ok: true })
    }
    case "resolver_disputa": {
      if (!s.disputa) return res.status(409).json({ message: "Esta solicitud no tiene un problema abierto." })
      const decision = String(b.decision || "")
      if (!DECISION[decision]) return res.status(400).json({ message: "Elige cómo se resuelve." })
      if (nota.length < 10) return res.status(400).json({ message: "Explica la decisión (y los montos si es parcial): el cliente y el taller la leen." })
      // Se limpia la marca (el historial conserva todo) y se guarda la decisión.
      const n = await knex(T_SOLICITUD).where({ id: s.id }).whereNotNull("disputa").update({ disputa: null, disputa_detalle: null })
      if (!n) return res.status(409).json({ message: "Otra persona ya la resolvió." })
      const texto = `${DECISION[decision]} ${nota}`
      const etapaActual = etapaDe(s)
      if (decision === "reembolso_total") {
        await cambiarEtapa(knex, s, "cancelada", { actor: "hetna", nota: texto, extra: { estado: "cerrada" }, logger })
      } else if (decision === "reembolso_parcial" || etapaActual === "entregada") {
        await cambiarEtapa(knex, s, "cerrada", { actor: "hetna", nota: texto, extra: { estado: "cerrada" }, logger })
        if (decision === "liberar") {
          await avisarLiquidacion(knex, s, "HETNA resolvió la disputa a favor del taller en").catch(() => null)
        }
      } else {
        // Liberar antes de entregar: el trabajo sigue su curso. No cambia de
        // etapa (no hay correo de etapa), así que al cliente se le avisa aquí.
        await anotar(knex, s.id, "hetna", texto)
        if (s.contacto?.email) {
          await sendEmail({
            to: s.contacto.email,
            subject: `[${folio}] HETNA resolvió el problema reportado`,
            html: marco(
              "Resolución de HETNA",
              `<p style="margin:0 0 12px;color:#40403A">${esc(texto)}</p>` +
                `<p style="margin:0 0 12px;color:#40403A">El trabajo sigue su curso; puedes ver el avance en tu liga.</p>` +
                boton("Ver mi solicitud", ligaPropuestas(s.token))
            ),
          }).catch(() => null)
        }
      }
      const p = await propuestaElegida(knex, s).catch(() => null)
      if (p?.taller_email) {
        await sendEmail({
          to: p.taller_email,
          subject: `[${folio}] HETNA resolvió el problema reportado`,
          html: marco("Resolución de HETNA", `<p style="margin:0 0 12px;color:#40403A">${esc(texto)}</p>`),
        }).catch(() => null)
      }
      return res.json({ ok: true })
    }
    default:
      return res.status(400).json({ message: "Acción no válida." })
  }
}
