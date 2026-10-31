// Regla: las fotos de productos que suben los talleres deben tener fondo blanco.
// Se revisa al crear o editar un producto desde el panel del taller (/seller).
// Si una foto no cumple, se bloquea con una leyenda que explica cómo arreglarla.
//
// Para apagar la regla sin tocar código: poner FONDO_BLANCO_ACTIVO=false en el .env de la API.
// Si no se puede revisar una foto (error de red, formato raro), se deja pasar: nunca se frena una venta por un fallo técnico.

import { MedusaError } from "@medusajs/framework/utils"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"

import { tieneFondoBlanco } from "../../../utils/fondo-blanco"

export const LEYENDA =
  "Las fotos de los productos deben tener fondo blanco. " +
  "Quita el fondo gratis en https://www.remove.bg/es : sube tu foto, en 'Editar' > 'Fondo' elige el color blanco, " +
  "descarga la imagen y vuelve a subirla aquí."

const MAX_FOTOS = 12
const MAX_BYTES = 20 * 1024 * 1024

// Saca las direcciones de las fotos del producto (images y thumbnail)
function direccionesDeFotos(cuerpo: Record<string, any>): string[] {
  const base: Record<string, any> =
    cuerpo?.product && typeof cuerpo.product === "object" ? cuerpo.product : cuerpo ?? {}
  const lista: unknown[] = []
  if (Array.isArray(base.images)) {
    for (const f of base.images) lista.push(typeof f === "string" ? f : f?.url)
  }
  if (typeof base.thumbnail === "string") lista.push(base.thumbnail)
  const vistas = new Set<string>()
  for (const u of lista) if (typeof u === "string" && u.trim()) vistas.add(u.trim())
  return [...vistas].slice(0, MAX_FOTOS)
}

// true = fondo blanco, false = NO es blanco, null = no se pudo revisar (se deja pasar)
export async function revisarFoto(direccion: string): Promise<boolean | null> {
  try {
    if (direccion.startsWith("data:")) return null
    const url = new URL(direccion, process.env.BACKEND_URL || "http://localhost:9000")
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const largo = Number(res.headers.get("content-length") || 0)
    if (largo > MAX_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_BYTES) return null
    return (await tieneFondoBlanco(buf)).blanco
  } catch (e) {
    console.warn("[fondo-blanco] no se pudo revisar una foto:", (e as Error).message)
    return null
  }
}

async function exigirFondoBlanco(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    if (process.env.FONDO_BLANCO_ACTIVO === "false") return next()
    const fotos = direccionesDeFotos((req.body ?? {}) as Record<string, any>)
    for (let i = 0; i < fotos.length; i++) {
      if ((await revisarFoto(fotos[i])) === false) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `La foto ${i + 1} no tiene fondo blanco. ${LEYENDA}`
        )
      }
    }
    next()
  } catch (e) {
    next(e)
  }
}

export const vendorFondoBlancoMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/vendor/products", middlewares: [exigirFondoBlanco] },
  { method: ["POST"], matcher: "/vendor/products/:id", middlewares: [exigirFondoBlanco] },
]
