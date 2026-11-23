// Panel del taller > Mercado Libre (lib/mercadolibre.ts)
//   GET  /vendor/hetna-mercadolibre                       -> estado, cuenta y productos
//   POST /vendor/hetna-mercadolibre { accion: "conectar" }                     -> { url }
//   POST /vendor/hetna-mercadolibre { accion: "vista_previa", producto_id, categoria_id? }
//   POST /vendor/hetna-mercadolibre { accion: "publicar", producto_id, categoria_id, titulo, tipo_publicacion, atributos }
//   POST /vendor/hetna-mercadolibre { accion: "desconectar" }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { desconectar, ErrorML, estadoDelTaller, ligaParaConectar, publicar, vistaPrevia } from "../../../lib/mercadolibre"

const idTaller = (req: AuthenticatedMedusaRequest) => (req as any).seller_context?.seller_id as string | undefined

const fallar = (res: MedusaResponse, e: unknown) => {
  const status = e instanceof ErrorML ? e.status : 500
  res.status(status >= 400 && status < 600 ? status : 400).json({ message: e instanceof ErrorML ? e.message : "No se pudo completar. Intenta de nuevo en un momento." })
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = idTaller(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    res.json(await estadoDelTaller(req.scope, sellerId))
  } catch (e) {
    fallar(res, e)
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = idTaller(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const b = (req.body || {}) as Record<string, any>
  try {
    switch (b.accion) {
      case "conectar":
        return res.json({ url: ligaParaConectar(sellerId) })
      case "desconectar":
        await desconectar(req.scope, sellerId)
        return res.json({ ok: true })
      case "vista_previa":
        if (!b.producto_id) return res.status(400).json({ message: "Falta el producto." })
        return res.json(await vistaPrevia(req.scope, sellerId, String(b.producto_id), b.categoria_id ? String(b.categoria_id) : undefined))
      case "publicar":
        if (!b.producto_id || !b.categoria_id) return res.status(400).json({ message: "Falta el producto o la categoría." })
        return res.json(
          await publicar(req.scope, sellerId, {
            producto_id: String(b.producto_id),
            categoria_id: String(b.categoria_id),
            titulo: String(b.titulo || ""),
            tipo_publicacion: String(b.tipo_publicacion || "gold_special"),
            atributos: b.atributos && typeof b.atributos === "object" ? b.atributos : {},
          })
        )
      default:
        return res.status(400).json({ message: "Acción no válida." })
    }
  } catch (e) {
    fallar(res, e)
  }
}
