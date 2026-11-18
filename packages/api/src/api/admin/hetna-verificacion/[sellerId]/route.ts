// POST /admin/hetna-verificacion/:sellerId  { accion: "aprobar" | "rechazar" | "revocar", motivo? }
//   aprobar  -> estado verificado + insignia "Taller verificado" en la tienda
//   rechazar -> estado rechazado con motivo; el taller corrige y reenvía
//   revocar  -> quita la insignia a un taller ya verificado (queda rechazado con motivo)
// En los tres casos se le avisa al taller por correo (si falla, no se deshace nada).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarExpediente, leerExpediente, marcarInsignia } from "../../../../lib/verificacion"
import { faltantes } from "../../../../lib/verificacion-archivos"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { servicioTalleres } from "../../../../lib/alta-taller"
import { VENDOR_URL, boton, esc, marco } from "../../../../lib/licitacion"
import { sendEmail } from "../../../../lib/resend"

const CORREO = {
  aprobar: {
    asunto: "Tu taller ya está verificado",
    titulo: "Taller verificado",
    texto: "Revisamos tus documentos: tu taller ya muestra la insignia de Taller verificado en la tienda.",
  },
  rechazar: {
    asunto: "Tu verificación necesita una corrección",
    titulo: "Falta corregir algo en tu verificación",
    texto: "Revisamos tus documentos y hay algo que corregir antes de darte la insignia. Corrígelo y vuelve a enviarla desde tu panel.",
  },
  revocar: {
    asunto: "Se retiró la insignia de taller verificado",
    titulo: "Se retiró tu insignia de verificado",
    texto: "HETNA retiró la insignia de Taller verificado de tu tienda. Puedes corregirlo y volver a enviar tu verificación desde tu panel.",
  },
} as const

async function avisarTaller(scope: any, sellerId: string, accion: keyof typeof CORREO, motivo: string, empresa: boolean) {
  const t = await servicioTalleres(scope).retrieveSeller(sellerId).catch(() => null)
  if (!t?.email) return
  const c = CORREO[accion]
  const r = await sendEmail({
    to: t.email,
    subject: c.asunto,
    html: marco(
      c.titulo,
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Hola, equipo de <strong>${esc(t.name || "tu taller")}</strong>. ${esc(c.texto)}</p>` +
        (accion === "aprobar" && empresa ? `<p style="margin:0 0 12px;color:#40403A">También quedó como <strong>Empresa verificada</strong>.</p>` : "") +
        (motivo && accion !== "aprobar"
          ? `<p style="margin:0 0 12px;color:#40403A;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(motivo)}</p>`
          : "") +
        boton("Ver mi verificación", `${VENDOR_URL}/verificacion`)
    ),
  })
  if (!r.sent) scope.resolve("logger").warn(`[verificacion] correo a ${t.email} no enviado: ${r.reason}`)
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { sellerId } = req.params
  const cuerpo = (req.body ?? {}) as { accion?: string; motivo?: string; empresa?: boolean }
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const marcarEmpresa = (valor: boolean) =>
    knex.raw(`update seller set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb where id = ?`, [
      JSON.stringify({ empresa_verificada: valor, empresa_verificada_desde: valor ? new Date().toISOString() : "" }),
      sellerId,
    ])
  const motivo = String(cuerpo.motivo ?? "").trim().slice(0, 500)
  const exp = await leerExpediente(req.scope, sellerId)
  if (!exp) return res.status(404).json({ message: "Este taller no tiene expediente." })
  const admin = req.auth_context?.actor_id ?? null

  switch (cuerpo.accion) {
    case "aprobar": {
      const falta = faltantes(exp.archivos)
      if (falta.length) return res.status(400).json({ message: "Faltan documentos: " + falta.join(", ") })
      // Fase 3: "Empresa verificada" si HETNA revisó la constancia fiscal. Se
      // revisa ANTES de guardar: antes quedaba "verificado" y luego respondía 400.
      if (cuerpo.empresa === true && !(exp.archivos || []).some((a: any) => a.tipo === "constancia_fiscal"))
        return res.status(400).json({ message: "Para marcar 'Empresa verificada' falta la constancia de situación fiscal." })
      await guardarExpediente(req.scope, exp.id, { estado: "verificado", motivo: null, revisado_en: new Date(), revisado_por: admin } as any)
      await marcarInsignia(req.scope, sellerId, true)
      if (cuerpo.empresa === true) await marcarEmpresa(true)
      break
    }
    case "rechazar":
    case "revocar": {
      if (!motivo) return res.status(400).json({ message: "Escribe el motivo para que el taller sepa qué corregir." })
      await guardarExpediente(req.scope, exp.id, { estado: "rechazado", motivo, revisado_en: new Date(), revisado_por: admin } as any)
      if (exp.estado === "verificado" || cuerpo.accion === "revocar") await marcarInsignia(req.scope, sellerId, false)
      if (cuerpo.accion === "revocar") await marcarEmpresa(false)
      break
    }
    default:
      return res.status(400).json({ message: "Acción no válida." })
  }
  await avisarTaller(req.scope, sellerId, cuerpo.accion as keyof typeof CORREO, motivo, cuerpo.empresa === true).catch((e) =>
    req.scope.resolve("logger").warn(`[verificacion] aviso a ${sellerId}: ${(e as Error).message}`)
  )
  res.json({ ok: true })
}
