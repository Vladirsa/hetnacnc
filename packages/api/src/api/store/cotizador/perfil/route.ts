import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { COTIZADOR_MODULE } from "../../../../modules/cotizador"
import CotizadorModuleService from "../../../../modules/cotizador/service"

// Campos que el taller puede escribir. folio_consecutivo NO está en la lista:
// lo mueve sólo el workflow al emitir una cotización, si no se podría reusar
// un folio ya enviado.
const CAMPOS_EDITABLES = [
  "nombre_comercial",
  "razon_social",
  "rfc",
  "direccion",
  "ciudad",
  "estado",
  "cp",
  "pais",
  "telefono",
  "whatsapp",
  "correo",
  "sitio_web",
  "logo_url",
  "moneda",
  "iva_pct",
  "vigencia_dias",
  "costo_hora_taller",
  "costo_hora_maquina",
  "costo_hora_operador",
  "margen_minimo",
  "margen_recomendado",
  "tarifas",
  "folio_prefijo",
  "terminos_estandar",
  "condiciones_pago_default",
  "dias_entrega_default",
  "firma_nombre",
  "firma_puesto",
] as const

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  const [perfil] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })

  res.json({ perfil: perfil ?? null })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)
  const body = (req.validatedBody || req.body || {}) as Record<string, unknown>

  const cambios: Record<string, unknown> = {}
  for (const campo of CAMPOS_EDITABLES) {
    if (body[campo] !== undefined) {
      cambios[campo] = body[campo]
    }
  }

  const [existente] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })

  if (existente) {
    await cotizadorModuleService.updateTallerPerfils({ id: existente.id, ...cambios } as any)
    const perfil = await cotizadorModuleService.retrieveTallerPerfil(existente.id)
    return res.json({ perfil })
  }

  if (!cambios.nombre_comercial) {
    return res.status(400).json({ message: "nombre_comercial es requerido para crear el perfil del taller" })
  }

  const [perfil] = await cotizadorModuleService.createTallerPerfils([
    { customer_id: customerId, ...cambios } as any,
  ])
  res.status(201).json({ perfil })
}
