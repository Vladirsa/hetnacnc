import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PORTADAS_MODULE, PortadasModuleService } from "../../../../../modules/portadas"
import { validarPortada } from "../validar"

// POST /admin/hetna/portadas/:id — actualiza una portada
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const portadas = req.scope.resolve<PortadasModuleService>(PORTADAS_MODULE)
  const id = req.params.id
  // Lanza 404 si no existe
  await portadas.retrievePortada(id)
  const datos = validarPortada((req.body ?? {}) as Record<string, unknown>, {
    crear: false,
  })
  const portada = await portadas.updatePortadas({ id, ...datos })
  res.json({ portada })
}

// DELETE /admin/hetna/portadas/:id — elimina una portada
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const portadas = req.scope.resolve<PortadasModuleService>(PORTADAS_MODULE)
  const id = req.params.id
  await portadas.retrievePortada(id)
  await portadas.deletePortadas(id)
  res.json({ id, object: "portada", deleted: true })
}
