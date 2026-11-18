// Llaves de la metadata de un producto que sólo pone HETNA (auditoría Thermos
// del 15 nov 2026). Mercur acepta metadata libre en /vendor/products, así que
// un taller podía:
//   - poner archivo_storage_key con la llave de un archivo de pago o de los
//     planos de un cliente y bajarlo como "descarga gratis";
//   - marcar un producto físico como digital para saltarse la espera de pago;
//   - cambiar precio y créditos de los paquetes de créditos 3D.
// Los flujos propios (libros, diseños, cursos, Fábrica) guardan esas llaves
// del lado del servidor, sin pasar por estas rutas.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse, MiddlewareRoute } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const LLAVES_PRODUCTO_PROTEGIDAS = [
  "archivo_storage_key",
  "archivo_gratis",
  "producto_digital",
  "precio_mxn",
  "creditos_otorgados",
  // Lo pone Publicar rápido; el suscriptor de redes decide con él si el taller está verificado
  "seller_id",
]

type Meta = Record<string, unknown>
const objeto = (v: unknown): Meta => (v && typeof v === "object" && !Array.isArray(v) ? (v as Meta) : {})

export function blindarProducto(nueva: Meta, guardada: Meta): Meta {
  const out: Meta = { ...nueva }
  for (const k of LLAVES_PRODUCTO_PROTEGIDAS) {
    if (k in guardada) out[k] = guardada[k]
    else delete out[k]
  }
  return out
}

async function protegerMetadataProducto(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const r = req as unknown as { body?: Meta; validatedBody?: Meta }
    const toca = (b?: Meta) => !!b && "metadata" in b && b.metadata != null
    if (!toca(r.body) && !toca(r.validatedBody)) return next()

    const id = (req.params as Record<string, string> | undefined)?.id
    let guardada: Meta = {}
    if (id) {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id } })
      guardada = objeto((data?.[0] as { metadata?: unknown } | undefined)?.metadata)
    }
    if (toca(r.body)) r.body!.metadata = blindarProducto(objeto(r.body!.metadata), guardada)
    if (toca(r.validatedBody)) r.validatedBody!.metadata = blindarProducto(objeto(r.validatedBody!.metadata), guardada)
    next()
  } catch {
    res.status(503).json({ message: "No se pudo guardar en este momento. Intenta de nuevo." })
  }
}

export const vendorProductoProtegidoMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/vendor/products", middlewares: [protegerMetadataProducto] },
  { method: ["POST"], matcher: "/vendor/products/:id", middlewares: [protegerMetadataProducto] },
]
