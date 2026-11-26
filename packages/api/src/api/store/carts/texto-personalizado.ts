// Texto y colores del cliente en piezas de Impresión 3D bajo pedido.
// Texto: productos personalizables (llaveros y letras 3D, metadata.personalizable).
// Colores: en una variante "· 2 colores" el cliente elige el color de cada parte
// (metadata.grupos_color del producto) entre los colores de la oferta del taller;
// viaja en metadata.colores del renglón ({ "Placa": "Negro", "Letras": "Blanco" }).
// La tienda lo manda en metadata.texto del renglón, pero el API de Mercur
// acepta metadata libre: aquí el servidor exige que venga, que sea texto y que
// no pase del máximo del producto (metadata.max_texto, o MAX_TEXTO). Así el
// taller recibe exactamente lo que se cobró, aunque alguien llame al API directo.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse, MiddlewareRoute } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { gruposColor, leerMaterial } from "../../../lib/impresion-bajo-pedido"

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

export type InfoColores = { dosColores: boolean; grupos: [string, string] | null; colores: string[] }

/** null si está bien (deja los colores limpios en metadata.colores); si no, el mensaje para el cliente. */
export function revisarColores(metadata: Record<string, unknown> | undefined, info: InfoColores | null): string | null {
  if (!info?.dosColores) {
    // sólo las variantes a dos colores llevan colores por parte
    if (metadata && "colores" in metadata) delete metadata.colores
    return null
  }
  if (!info.grupos) return "Esta pieza no se vende a dos colores."
  const c = metadata?.colores
  if (!c || typeof c !== "object" || Array.isArray(c)) return `Elige el color de cada parte (${info.grupos.join(" y ")}).`
  const elegidos = c as Record<string, unknown>
  const limpio: Record<string, string> = {}
  for (const g of info.grupos) {
    const v = typeof elegidos[g] === "string" ? (elegidos[g] as string).trim().toLowerCase() : ""
    const color = info.colores.find((x) => x.toLowerCase() === v)
    if (!color) return `Elige el color de "${g}" entre los que tiene el taller.`
    limpio[g] = color
  }
  if (Object.keys(elegidos).some((k) => !info.grupos!.includes(k))) return "Los colores no corresponden a esta pieza."
  metadata!.colores = limpio
  delete metadata!.color // el color único no aplica
  return null
}

// La ruta usa el cuerpo ya validado (req.validatedBody), que es una copia:
// el texto y los colores limpios se ponen también ahí
function copiarLimpio(req: MedusaRequest, metadata: Record<string, unknown> | undefined) {
  const v = (req as unknown as { validatedBody?: { metadata?: Record<string, unknown> } }).validatedBody
  if (!metadata || !v?.metadata) return
  if (typeof metadata.texto === "string" && typeof v.metadata.texto === "string") v.metadata.texto = metadata.texto
  for (const k of ["colores", "color"]) {
    if (k in metadata) v.metadata[k] = metadata[k]
    else delete v.metadata[k]
  }
}

type InfoOferta = { personalizable: boolean; max: number; colores: InfoColores }

async function productoDeOferta(req: MedusaRequest, offerId: string): Promise<InfoOferta | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: ofertas } = await query.graph({ entity: "offer", fields: ["id", "product_id", "variant_id", "metadata"], filters: { id: offerId } as any })
  const oferta = (ofertas as any[])[0]
  if (!oferta?.product_id) return null
  const { data: productos } = await query.graph({ entity: "product", fields: ["id", "metadata", "variants.id", "variants.title"], filters: { id: oferta.product_id } })
  const producto = (productos as any[])[0]
  const m = (producto?.metadata || {}) as Record<string, unknown>
  const max = Number(m.max_texto)
  const variante = (producto?.variants || []).find((v: any) => v.id === oferta.variant_id)
  const colores = Array.isArray(oferta.metadata?.colores) ? (oferta.metadata.colores as unknown[]).map(String).filter(Boolean) : []
  return {
    personalizable: m.personalizable === true,
    max: Number.isInteger(max) && max > 0 && max <= MAX_TEXTO ? max : MAX_TEXTO,
    colores: { dosColores: leerMaterial(variante?.title || "").dosColores, grupos: gruposColor(producto), colores },
  }
}

async function validar(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const body = (req.body || {}) as { offer_id?: unknown; metadata?: Record<string, unknown> }
    const producto = typeof body.offer_id === "string" ? await productoDeOferta(req, body.offer_id) : null
    const error = revisarTexto(body.metadata, producto) || revisarColores(body.metadata, producto?.colores ?? null)
    if (error) return res.status(400).json({ type: "invalid_data", message: error })
    copiarLimpio(req, body.metadata)
  } catch {
    // si no se pudo revisar, sigue: nunca se frena una venta por un fallo técnico
  }
  next()
}

// Al editar un renglón (cantidad o metadata) sólo se revisa el texto si viene;
// los colores no se cambian aquí (se revisan contra la oferta al agregar)
async function validarEdicion(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const body = (req.body || {}) as { metadata?: Record<string, unknown> }
  if (body.metadata && "colores" in body.metadata) {
    return res.status(400).json({ type: "invalid_data", message: "Para cambiar los colores, quita la pieza del carrito y agrégala de nuevo." })
  }
  if (body.metadata && "texto" in body.metadata) {
    const error = revisarTexto(body.metadata, { personalizable: true, max: MAX_TEXTO })
    if (error) return res.status(400).json({ type: "invalid_data", message: error })
    copiarLimpio(req, body.metadata)
  }
  next()
}

export const storeTextoPersonalizadoMiddlewares: MiddlewareRoute[] = [
  { matcher: "/store/carts/:id/line-items", method: ["POST"], middlewares: [validar] },
  { matcher: "/store/carts/:id/line-items/:line_id", method: ["POST"], middlewares: [validarEdicion] },
]
