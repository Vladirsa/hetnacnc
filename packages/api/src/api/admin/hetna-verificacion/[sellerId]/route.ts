// POST /admin/hetna-verificacion/:sellerId  { accion: "aprobar" | "rechazar" | "revocar", motivo? }
//   aprobar  -> estado verificado + insignia "Taller verificado" en la tienda
//   rechazar -> estado rechazado con motivo; el taller corrige y reenvía
//   revocar  -> quita la insignia a un taller ya verificado (queda rechazado con motivo)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarExpediente, leerExpediente, marcarInsignia } from "../../../../lib/verificacion"
import { faltantes } from "../../../../lib/verificacion-archivos"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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
      await guardarExpediente(req.scope, exp.id, { estado: "verificado", motivo: null, revisado_en: new Date(), revisado_por: admin } as any)
      await marcarInsignia(req.scope, sellerId, true)
      // Fase 3: "Empresa verificada" si HETNA revisó la constancia fiscal
      if (cuerpo.empresa === true) {
        if (!(exp.archivos || []).some((a: any) => a.tipo === "constancia_fiscal"))
          return res.status(400).json({ message: "Para marcar 'Empresa verificada' falta la constancia de situación fiscal." })
        await marcarEmpresa(true)
      }
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
  res.json({ ok: true })
}
