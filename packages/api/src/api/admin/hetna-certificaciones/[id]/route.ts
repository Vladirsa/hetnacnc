// POST /admin/hetna-certificaciones/:id  { accion: "aprobar" | "rechazar", motivo? }
// HETNA aprueba o rechaza una certificación. Al aprobar se publica en el
// perfil del taller y sube su posicionamiento (no su calificación).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_CERT, TIPOS_CERT, asegurarCertificaciones, sincronizarCertificacionesPerfil } from "../../../../lib/confianza"
import { VENDOR_URL, boton, esc, marco } from "../../../../lib/licitacion"
import { pushATalleres } from "../../../../lib/push"
import { sendEmail } from "../../../../lib/resend"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  await asegurarCertificaciones(knex)
  const c = await knex(T_CERT).where({ id: String(req.params.id) }).first()
  if (!c) return res.status(404).json({ message: "No encontrada." })
  const b = (req.body || {}) as { accion?: string; motivo?: string }
  const motivo = String(b.motivo || "").trim().slice(0, 500)
  if (b.accion !== "aprobar" && b.accion !== "rechazar") return res.status(400).json({ message: "Acción no válida." })
  if (b.accion === "rechazar" && !motivo) return res.status(400).json({ message: "Escribe el motivo para que el taller sepa qué corregir." })
  const estado = b.accion === "aprobar" ? "aprobada" : "rechazada"
  await knex(T_CERT)
    .where({ id: c.id })
    .update({ estado, motivo: estado === "rechazada" ? motivo : null, revisado_por: req.auth_context?.actor_id || null, revisado_en: knex.fn.now() })
  await sincronizarCertificacionesPerfil(knex, c.seller_id)
  res.json({ ok: true, estado })

  const nombre = c.tipo === "otra" || c.tipo === "distribuidor" ? c.nombre || TIPOS_CERT[c.tipo] : TIPOS_CERT[c.tipo] || c.tipo
  const ok = estado === "aprobada"
  await pushATalleres(
    knex,
    [c.seller_id],
    { titulo: ok ? "Certificación aprobada ✓" : "Certificación no aprobada", cuerpo: ok ? `${nombre} ya aparece en tu perfil.` : `${nombre}: ${motivo}`, url: "/seller/verificacion", etiqueta: `cert-${c.id}` },
    logger
  )
  const t = await knex("seller").where({ id: c.seller_id }).first("email").catch(() => null)
  if (t?.email) {
    await sendEmail({
      to: t.email,
      subject: ok ? `Tu certificación ${nombre} ya está en tu perfil` : `Revisa tu certificación ${nombre}`,
      html: marco(
        ok ? "Certificación aprobada" : "Certificación no aprobada",
        `<p style="color:#40403A">${ok ? `HETNA revisó <b>${esc(nombre)}</b> y ya aparece en tu perfil público. Los talleres certificados salen mejor posicionados ante los clientes.` : `No pudimos aprobar <b>${esc(nombre)}</b>: ${esc(motivo)}. Corrígelo y súbelo de nuevo.`}</p>` +
          boton("Ver mis certificaciones", `${VENDOR_URL}/verificacion`)
      ),
    }).catch(() => undefined)
  }
}
