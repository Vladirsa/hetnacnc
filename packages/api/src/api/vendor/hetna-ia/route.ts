// Asistente de IA de fabricación (lib/ia-fabricacion.ts), sólo para talleres
// con plan de pago.
//   GET  /vendor/hetna-ia   → si puede usarlo, su plan y cuánto le queda hoy
//   POST /vendor/hetna-ia   { mensajes: [{ rol: "taller"|"asistente", texto }] }
// La conversación vive en el navegador del taller; aquí no se guarda, sólo el
// gasto (tokens y costo) para el tope del mes.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { servicioTalleres } from "../../../lib/alta-taller"
import { conversar, iaFabricacionEncendida, limpiarHistorial, permisoIA } from "../../../lib/ia-fabricacion"
import { estadoUso } from "../../../lib/ia-fabricacion-uso"

const MOTIVO = {
  sin_plan: "El asistente de IA es para talleres con plan Taller, Pro o Industrial. Puedes contratarlo en la app HETNA CNC para talleres (Mi plan).",
  sin_verificar: "No pudimos comprobar tu plan en este momento. Intenta de nuevo en unos minutos.",
}

async function revisar(req: AuthenticatedMedusaRequest) {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return { error: { status: 401, message: "Sin taller." } }
  if (!iaFabricacionEncendida()) return { error: { status: 503, message: "El asistente de IA no está disponible por ahora." } }
  const seller = await servicioTalleres(req.scope).retrieveSeller(sellerId).catch(() => null)
  if (!seller) return { error: { status: 401, message: "Sin taller." } }
  const permiso = await permisoIA(seller as any)
  return { sellerId, permiso }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const r = await revisar(req)
  if ("error" in r && r.error) return res.status(r.error.status).json({ permitido: false, message: r.error.message })
  const { sellerId, permiso } = r as any
  if (!permiso.ok) return res.json({ permitido: false, motivo: permiso.motivo, message: MOTIVO[permiso.motivo as keyof typeof MOTIVO] })
  const estado = await estadoUso(knex, sellerId)
  return res.json({
    permitido: true,
    plan: permiso.plan,
    pausada: estado.pausada,
    mensajes_hoy: estado.mensajes_hoy,
    mensajes_dia: estado.mensajes_dia,
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const r = await revisar(req)
  if ("error" in r && r.error) return res.status(r.error.status).json({ message: r.error.message })
  const { sellerId, permiso } = r as any
  if (!permiso.ok) return res.status(403).json({ message: MOTIVO[permiso.motivo as keyof typeof MOTIVO] })
  const historial = limpiarHistorial((req.body as any)?.mensajes)
  const x = await conversar({ knex, sellerId, historial, logger })
  if (!x.ok) return res.status(x.status).json({ message: x.mensaje })
  return res.json({ texto: x.texto, herramientas: [...new Set(x.herramientas)] })
}
