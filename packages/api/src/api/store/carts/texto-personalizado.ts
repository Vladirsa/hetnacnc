// Texto del cliente en productos personalizables (llaveros y letras 3D del
// catálogo de Impresión 3D bajo pedido, metadata.personalizable del producto).
// La tienda lo manda en metadata.texto del renglón, pero el API de Mercur
// acepta metadata libre: aquí el servidor exige que venga, que sea texto y que
// no pase del máximo del producto (metadata.max_texto, o MAX_TEXTO). Así el
// taller recibe exactamente lo que se cobró, aunque alguien llame al API directo.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse, MiddlewareRoute } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const MAX_TEXTO = 40

/** null si está bien (y deja el texto limpio en metadata); si no, el mensaje para el cliente. */
export function revisarTexto(metadata: Record<string, unknown> | undefined, producto: { personalizable: boolean; max: number } | null): string | null {
  const texto = metadata?.texto
  if (texto === undefined || texto === null) return producto?.personalizable ? "Escribe el nombre o el texto que quieres en la pieza." : null
  if (typeof texto !== "string") return "El texto de la pieza no es válido."
  const limpio = texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  const max = producto?.max || MAX_TEXTO
  if (!limpio && producto?.personalizable) return "Escribe el nombre o el texto que quieres en la pieza."
  if (limpio.length > max) return `El texto puede tener hasta ${max} caracteres.`
  if (metadata) metadata.texto = limpio
  return null
}

// La ruta usa el cuerpo ya validado (req.validatedBody), que es una copia:
// el texto limpio se pone también ahí
function copiarTextoLimpio(req: MedusaRequest, metadata: Record<string, unknown> | undefined) {
  const v = (req as unknown as { validatedBody?: { metadata?: Record<string, unknown> } }).validatedBody
  if (metadata && typeof metadata.texto === "string" && v?.metadata && typeof v.metadata.texto === "string") v.metadata.texto = metadata.texto
}

async function productoDeOferta(req: MedusaRequest, offerId: string): Promise<{ personalizable: boolean; max: number } | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: ofertas } = await query.graph({ entity: "offer", fields: ["id", "product_id"], filters: { id: offerId } as any })
  const productId = (ofertas as any[])[0]?.product_id
  if (!productId) return null
  const { data: productos } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: productId } })
  const m = ((productos as any[])[0]?.metadata || {}) as Record<string, unknown>
  const max = Number(m.max_texto)
  return { personalizable: m.personalizable === true, max: Number.isInteger(max) && max > 0 && max <= MAX_TEXTO ? max : MAX_TEXTO }
}

async function validar(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const body = (req.body || {}) as { offer_id?: unknown; metadata?: Record<string, unknown> }
    const producto = typeof body.offer_id === "string" ? await productoDeOferta(req, body.offer_id) : null
    const error = revisarTexto(body.metadata, producto)
    if (error) return res.status(400).json({ type: "invalid_data", message: error })
    copiarTextoLimpio(req, body.metadata)
  } catch {
    // si no se pudo revisar, sigue: nunca se frena una venta por un fallo técnico
  }
  next()
}

// Al editar un renglón (cantidad o metadata) sólo se revisa el texto si viene
async function validarEdicion(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const body = (req.body || {}) as { metadata?: Record<string, unknown> }
  if (body.metadata && "texto" in body.metadata) {
    const error = revisarTexto(body.metadata, { personalizable: true, max: MAX_TEXTO })
    if (error) return res.status(400).json({ type: "invalid_data", message: error })
    copiarTextoLimpio(req, body.metadata)
  }
  next()
}

export const storeTextoPersonalizadoMiddlewares: MiddlewareRoute[] = [
  { matcher: "/store/carts/:id/line-items", method: ["POST"], middlewares: [validar] },
  { matcher: "/store/carts/:id/line-items/:line_id", method: ["POST"], middlewares: [validarEdicion] },
]
