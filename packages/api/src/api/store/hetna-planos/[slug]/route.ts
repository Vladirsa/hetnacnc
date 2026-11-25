// GET /store/hetna-planos/:slug[?borrador=firma] -> { plano }
// Publicado: cualquiera. Borrador: sólo con la firma de la vista previa que
// genera el panel (lib/planos-biblioteca.ts → ligaVistaPrevia).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { firmaBorradorValida, planoDeBiblioteca } from "../../../../lib/planos-biblioteca"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const slug = String(req.params.slug || "")
  const t = String((req.query as Record<string, unknown>)?.borrador || "")
  const borrador = !!t && firmaBorradorValida(slug, t)
  const plano = await planoDeBiblioteca(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), slug, { borrador })
  if (!plano) return res.status(404).json({ message: "No existe" })
  res.setHeader("Cache-Control", "no-store")
  res.json({ plano })
}
