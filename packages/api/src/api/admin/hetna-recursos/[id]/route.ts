// POST   /admin/hetna-recursos/:id   actualizar (sólo los campos que lleguen)
// DELETE /admin/hetna-recursos/:id
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerRecurso, servicioRecursos } from "../../../../lib/recursos-academia"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc = servicioRecursos(req.scope)
  const id = String(req.params.id)
  const [actual] = await svc.listLearningResources({ id }, { take: 1 })
  if (!actual) return res.status(404).json({ message: "Recurso no encontrado." })
  const { datos, error } = leerRecurso((req.body || {}) as Record<string, unknown>, true)
  if (error || !datos) return res.status(400).json({ message: error })
  if (datos.url && datos.url !== actual.url) {
    const [otro] = await svc.listLearningResources({ url: datos.url as string }, { take: 1 })
    if (otro) return res.status(409).json({ message: `Esa liga ya está en la biblioteca ("${otro.titulo}").` })
  }
  const recurso = await svc.updateLearningResources({ id, ...datos } as any)
  res.json({ recurso })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  await servicioRecursos(req.scope).softDeleteLearningResources(String(req.params.id))
  res.json({ ok: true })
}
