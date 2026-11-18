// No deja publicar productos ni ofertas a un taller que todavía no está
// aprobado (lib/alta-taller.ts). Editar lo que ya tiene sí se permite.
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"

import { motivoParaNoPublicar, servicioTalleres } from "../../../lib/alta-taller"
import { motivoRequisitos } from "../../../lib/requisitos-vendedor"

// Para publicar productos sólo se piden los términos; la tarjeta, para cotizar
// licitaciones y para cobrar (admin/hetna-saldos/pagar).
const exigirTallerAprobado = (opc: { tarjeta: boolean }) => async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
  const r = req as unknown as { seller_context?: { seller_id?: string }; session?: { seller_id?: string } }
  const sellerId = r.seller_context?.seller_id || req.get("x-seller-id") || r.session?.seller_id
  if (!sellerId) return next() // sin taller la ruta original responde el error
  let taller: any
  try {
    taller = await servicioTalleres(req.scope).retrieveSeller(sellerId)
  } catch {
    return next() // taller inexistente: la ruta original responde el error
  }
  const mensaje = motivoParaNoPublicar(taller)
  if (mensaje) return res.status(403).json({ type: "not_allowed", message: mensaje, codigo: "taller_no_aprobado" })
  // Requisitos (4 nov 2026): términos vigentes y, según la ruta, tarjeta verificada
  const falta = motivoRequisitos(taller, { tarjeta: opc.tarjeta })
  if (falta) return res.status(403).json({ type: "not_allowed", message: falta, codigo: "requisitos_pendientes" })
  next()
}

const publicar = exigirTallerAprobado({ tarjeta: false })
const cotizar = exigirTallerAprobado({ tarjeta: true })

export const vendorAltaMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/vendor/products", middlewares: [publicar] },
  { method: ["POST"], matcher: "/vendor/offers", middlewares: [publicar] },
  { method: ["POST"], matcher: "/vendor/offers/batch", middlewares: [publicar] },
  { method: ["POST"], matcher: "/vendor/hetna-publicar", middlewares: [publicar] },
  // Servicios: cursos, libros y propuestas de licitación
  { method: ["POST"], matcher: "/vendor/courses", middlewares: [publicar] },
  { method: ["POST"], matcher: "/vendor/hetna-libros", middlewares: [publicar] },
  { method: ["POST"], matcher: "/vendor/hetna-solicitudes/:id/propuesta", middlewares: [cotizar] },
]
