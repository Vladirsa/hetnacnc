// POST /admin/hetna-verificacion/:sellerId  { accion: "aprobar" | "rechazar" | "revocar", motivo? }
//   aprobar  -> estado verificado + insignia "Taller verificado" en la tienda
//   rechazar -> estado rechazado con motivo; el taller corrige y reenvía
//   revocar  -> quita la insignia a un taller ya verificado (queda rechazado con motivo)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarExpediente, leerExpediente, marcarInsignia } from "../../../../lib/verificacion"
import { faltantes } from "../../../../lib/verificacion-archivos"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { sellerId } = req.params
  const cuerpo = (req.body ?? {}) as { accion?: string; motivo?: string }
  const motivo = String(cuerpo.motivo ?? "").trim().slice(0, 500)
  const exp = await leerExpediente(req.scope, sellerId)
  if (!exp) return res.status(404).json({ message: "Este taller no tiene expediente." })
  const admin = req.auth_context?.actor_id ?? null

  switch (cuerpo.accion) {
    case "aprobar": {
      const falta = faltantes(exp.archivos)
      if (falta.length) return res.status(400).json({ message: "Faltan documentos: " + falta.join(", ") })
      await guardarExpediente(req.scope, exp.id, { estado: "verificado", motivo: null, revisado_en: new Date(), revisado_por: admin } as any)
      await marcarInsignia(req.scope, sellerId, true)
      break
    }
    case "rechazar":
    case "revocar": {
      if (!motivo) return res.status(400).json({ message: "Escribe el motivo para que el taller sepa qué corregir." })
      await guardarExpediente(req.scope, exp.id, { estado: "rechazado", motivo, revisado_en: new Date(), revisado_por: admin } as any)
      if (exp.estado === "verificado" || cuerpo.accion === "revocar") await marcarInsignia(req.scope, sellerId, false)
      break
    }
    default:
      return res.status(400).json({ message: "Acción no válida." })
  }
  res.json({ ok: true })
}
