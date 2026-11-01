// Reglas de los cupones de HETNA (lib/cupones.ts) que Medusa no revisa solo:
// primera compra, compra mínima, cupón de una sola cuenta y vencimiento.
//
//   POST /store/carts/:id          (con promo_codes)  -> al aplicar el código
//   POST /store/carts/:id/promotions                  -> igual, por la otra ruta
//   POST /store/carts/:id/complete                    -> otra vez al pagar: el
//        carrito pudo cambiar (quitó productos y ya no llega al mínimo)
//
// Los códigos se pasan a mayúsculas: el cliente escribe "bienvenida" y Medusa
// distingue mayúsculas.
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { asegurarBienvenida, esBienvenida, esCuponHetna, motivoCupon, type CarritoCupon } from "../../../lib/cupones"

const CAMPOS = ["id", "customer_id", "email", "items.unit_price", "items.quantity", "promotions.code"]

async function leerCarrito(req: MedusaRequest): Promise<(CarritoCupon & { promotions?: { code?: string | null }[] }) | null> {
  const id = (req.params as { id?: string })?.id
  if (!id) return null
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "cart", fields: CAMPOS, filters: { id } })
  return (data?.[0] as any) || null
}

const codigosDe = (b: unknown): string[] | null => {
  const r = (b || {}) as { promo_codes?: unknown }
  return Array.isArray(r.promo_codes) ? r.promo_codes.map((c) => String(c ?? "")) : null
}

async function revisarAlAplicar(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const r = req as unknown as { body?: Record<string, unknown>; validatedBody?: Record<string, unknown> }
  const codigos = codigosDe(r.validatedBody) ?? codigosDe(r.body)
  if (!codigos || !codigos.some(esCuponHetna)) return next()
  try {
    const mayus = codigos.map((c) => (esCuponHetna(c) ? c.trim().toUpperCase() : c))
    if (r.body && Array.isArray(r.body.promo_codes)) r.body.promo_codes = mayus
    if (r.validatedBody && Array.isArray(r.validatedBody.promo_codes)) r.validatedBody.promo_codes = mayus
    if (mayus.some(esBienvenida)) await asegurarBienvenida(req.scope)

    const carrito = await leerCarrito(req)
    if (!carrito) return next()
    for (const c of mayus.filter(esCuponHetna)) {
      const motivo = await motivoCupon(req.scope, carrito, c)
      if (motivo) return res.status(400).json({ type: "invalid_data", message: motivo, codigo: "cupon_no_aplica" })
    }
    next()
  } catch (e) {
    req.scope.resolve("logger").warn(`[cupones] al aplicar: ${(e as Error).message}`)
    res.status(503).json({ message: "No se pudo revisar el cupón en este momento. Intenta de nuevo." })
  }
}

async function revisarAlPagar(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const carrito = await leerCarrito(req)
    const nuestros = (carrito?.promotions || []).map((p) => p?.code || "").filter(esCuponHetna)
    if (!carrito || !nuestros.length) return next()
    for (const c of nuestros) {
      const motivo = await motivoCupon(req.scope, carrito, c)
      if (motivo) {
        return res.status(400).json({
          type: "invalid_data",
          message: `${motivo} Quita el cupón del carrito para continuar.`,
          codigo: "cupon_no_aplica",
        })
      }
    }
    next()
  } catch (e) {
    // Si no se puede revisar, no se detiene la compra: Medusa ya limita los usos
    req.scope.resolve("logger").warn(`[cupones] al pagar: ${(e as Error).message}`)
    next()
  }
}

export const storeCuponesMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/store/carts/:id", middlewares: [revisarAlAplicar] },
  { method: ["POST"], matcher: "/store/carts/:id/promotions", middlewares: [revisarAlAplicar] },
  { method: ["POST"], matcher: "/store/carts/:id/complete", middlewares: [revisarAlPagar] },
]
