import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PORTADAS_MODULE, PortadasModuleService } from "../../../../modules/portadas"
import { validarPortada } from "./validar"

// GET /admin/hetna/portadas — todas las portadas (activas, programadas y vencidas)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const portadas = req.scope.resolve<PortadasModuleService>(PORTADAS_MODULE)
  const lista = await portadas.listPortadas(
    {},
    { order: { orden: "ASC", created_at: "DESC" }, take: 200 }
  )
  res.json({ portadas: lista })
}

// POST /admin/hetna/portadas — crea una portada nueva
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const portadas = req.scope.resolve<PortadasModuleService>(PORTADAS_MODULE)
  const datos = validarPortada((req.body ?? {}) as Record<string, unknown>, {
    crear: true,
  })
  const portada = await portadas.createPortadas({
    ...datos,
    titulo: datos.titulo as string,
    origen: "hetna",
  })
  res.status(201).json({ portada })
}
