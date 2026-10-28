// GET /admin/hetna-verificacion?estado=en_revision
// Lista de expedientes de verificación de talleres para el administrador.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { servicio } from "../../../lib/verificacion"
import { faltantes, listaArchivos } from "../../../lib/verificacion-archivos"

const ESTADOS = ["borrador", "en_revision", "verificado", "rechazado"]

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const estado = String(req.query.estado || "")
  const filas = await servicio(req.scope).listVerificacionTallers(
    ESTADOS.includes(estado) ? { estado } : {},
    { take: 200, order: { enviado_en: "DESC" } }
  )
  const ids = filas.map((f) => f.seller_id)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sellers } = ids.length
    ? await query.graph({ entity: "seller", fields: ["id", "name", "handle", "email", "phone"], filters: { id: ids } })
    : { data: [] as any[] }
  const porId = new Map((sellers as any[]).map((s) => [s.id, s]))

  res.json({
    expedientes: filas.map((f) => {
      const archivos = listaArchivos(f.archivos)
      const s = porId.get(f.seller_id) ?? {}
      return {
        seller_id: f.seller_id,
        nombre: s.name ?? "(taller borrado)",
        handle: s.handle ?? "",
        email: s.email ?? "",
        telefono: s.phone ?? "",
        estado: f.estado,
        motivo: f.motivo,
        enviado_en: f.enviado_en,
        revisado_en: f.revisado_en,
        archivos: archivos.map(({ id, tipo, mime, tamano, subido_en }) => ({ id, tipo, mime, tamano, subido_en })),
        faltan: faltantes(archivos),
      }
    }),
  })
}
