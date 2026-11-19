// GET  /admin/hetna-recursos   todos los recursos de la biblioteca (también ocultos)
// POST /admin/hetna-recursos   crear { titulo, url, fuente?, categoria, tipo?, descripcion?, imagen_url?, destacado?, orden?, publicado? }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerRecurso, servicioRecursos } from "../../../lib/recursos-academia"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const [recursos, total] = await servicioRecursos(req.scope).listAndCountLearningResources(
    {},
    { take: 1000, order: { created_at: "DESC" } }
  )
  res.json({ recursos, total })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { datos, error } = leerRecurso((req.body || {}) as Record<string, unknown>)
  if (error || !datos) return res.status(400).json({ message: error })
  const svc = servicioRecursos(req.scope)
  const [existe] = await svc.listLearningResources({ url: datos.url as string }, { take: 1 })
  if (existe) return res.status(409).json({ message: `Esa liga ya está en la biblioteca ("${existe.titulo}").` })
  const recurso = await svc.createLearningResources(datos as any)
  res.status(201).json({ recurso })
}
