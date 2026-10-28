import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { publicarDiseno } from "../../../../lib/publicar-diseno"

// Lo que manda el workflow "HETNA Digital Factory - Publicar producto
// aprobado", tomado tal cual de la fila de digital_factory_productos.
const Ficha = z.object({
  sku: z.string().min(1),
  titulo: z.string().min(3),
  handle: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "handle en minúsculas con guiones"),
  descripcion_corta: z.string().optional(),
  descripcion_larga: z.string().min(10),
  caracteristicas: z.string().optional(),
  formatos: z.string().optional(),
  categoria: z.string().optional(),
  subcategoria: z.string().optional(),
  tags: z.string().optional(),
  imagen_url: z.string().url().optional(),
  gratis: z.boolean().optional(),
  precio_mxn: z.number().positive().optional(),
  precio_usd: z.number().positive().optional(),
  // Sin archivo no hay qué entregar: el correo de descarga sale de aquí.
  archivo_storage_key: z.string().min(1),
  titulo_seo: z.string().optional(),
  meta_description: z.string().optional(),
  keyword_principal: z.string().optional(),
  faq: z.array(z.object({ p: z.string(), r: z.string() })).optional(),
}).refine((f) => f.gratis === true || (f.precio_mxn ?? 0) > 0, {
  message: "Si el archivo no es gratis, precio_mxn es obligatorio.",
  path: ["precio_mxn"],
})

/**
 * POST /admin/disenos-digitales/publicar
 *
 * Publica una ficha revisada como producto con su oferta de la tienda HETNA.
 * Si el producto ya existe (mismo handle) no lo duplica: contesta con el que
 * hay y `creado: false`.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = Ficha.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error.message)
  }

  const resultado = await publicarDiseno(req.scope, parsed.data)
  res.status(resultado.creado ? 201 : 200).json(resultado)
}
