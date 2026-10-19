import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ESCANEO_MODULE } from "../../../modules/escaneo"
import EscaneoModuleService from "../../../modules/escaneo/service"
import { createEscaneoWorkflow } from "../../../workflows/create-escaneo"

// El historial de escaneos del taller. Es la pantalla que vuelve esto un
// servicio de la plataforma y no un archivo que se manda por WhatsApp: el
// taller entra a su perfil y ahí están todos, las veces que quiera.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const escaneoModuleService = req.scope.resolve<EscaneoModuleService>(ESCANEO_MODULE)

  const filtros: Record<string, unknown> = { customer_id: customerId }
  if (req.query.estatus) {
    filtros.estatus = String(req.query.estatus)
  }

  const [escaneos, count] = await escaneoModuleService.listAndCountEscaneo3ds(filtros, {
    order: { created_at: "DESC" },
    take: Number(req.query.limit) || 50,
    skip: Number(req.query.offset) || 0,
  })

  res.json({ escaneos, count })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const body = (req.validatedBody || req.body || {}) as Record<string, any>

  const modo = body.modo === "scan" ? "scan" : "preview"

  if (!Array.isArray(body.fotos) || !body.fotos.length) {
    return res.status(400).json({ message: "Sube al menos una foto antes de pedir el escaneo." })
  }

  // Las llaves vienen del cliente, así que se revisa que apunten a la carpeta
  // de ESTE taller. Sin esto, alguien podría mandar la llave de otro y pedir
  // que se procesen (y se le entreguen) fotos ajenas.
  const prefijoPropio = `escaneos3d/${customerId}/`
  const ajenas = body.fotos.filter((f: unknown) => typeof f !== "string" || !f.startsWith(prefijoPropio))
  if (ajenas.length) {
    return res.status(400).json({ message: "Hay fotos que no pertenecen a esta cuenta." })
  }

  const { result } = await createEscaneoWorkflow(req.scope).run({
    input: {
      customer_id: customerId,
      modo,
      titulo: typeof body.titulo === "string" ? body.titulo.slice(0, 200) : null,
      fotos: body.fotos,
    },
  })

  const escaneoModuleService = req.scope.resolve<EscaneoModuleService>(ESCANEO_MODULE)
  const escaneo = await escaneoModuleService.retrieveEscaneo3d(result.escaneo_id)

  res.status(201).json({ escaneo })
}
