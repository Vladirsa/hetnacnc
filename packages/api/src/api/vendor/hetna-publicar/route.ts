// Panel del taller > Publicar producto (lib/publicar-rapido.ts)
//   GET  /vendor/hetna-publicar  -> { categorias, fondo_blanco }
//   POST /vendor/hetna-publicar  { titulo, fotos, categoria_id, precio, existencias,
//                                  condicion, peso_kg, largo_cm, ancho_cm, alto_cm,
//                                  descripcion, sku? } -> { product_id, handle }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { LEYENDA, revisarFoto } from "../fondo-blanco/middlewares"
import { ErrorPublicar, categoriasParaPublicar, publicarRapido, validar } from "../../../lib/publicar-rapido"

const fondoBlancoActivo = () => process.env.FONDO_BLANCO_ACTIVO !== "false"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    res.json({ categorias: await categoriasParaPublicar(req.scope), fondo_blanco: fondoBlancoActivo() })
  } catch (e) {
    req.scope.resolve("logger").error(`[publicar] categorías: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudieron cargar las categorías." })
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = (req as any).seller_context as { seller_id?: string; seller_member?: { member_id?: string } } | undefined
  const sellerId = ctx?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    const datos = validar((req.body || {}) as Record<string, unknown>)
    // La misma regla del formulario de Mercur (fondo-blanco/middlewares.ts)
    if (fondoBlancoActivo()) {
      for (let i = 0; i < datos.fotos.length; i++) {
        if ((await revisarFoto(datos.fotos[i])) === false) {
          throw new ErrorPublicar(`La foto ${i + 1} no tiene fondo blanco. ${LEYENDA}`)
        }
      }
    }
    const memberId = ctx?.seller_member?.member_id || req.auth_context?.actor_id
    res.json(await publicarRapido(req.scope, sellerId, memberId, datos))
  } catch (e) {
    if (e instanceof ErrorPublicar) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[publicar] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo publicar. Intenta de nuevo; si sigue, avísanos por WhatsApp." })
  }
}
