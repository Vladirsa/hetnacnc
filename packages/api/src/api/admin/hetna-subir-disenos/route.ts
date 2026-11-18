// GET /admin/hetna-subir-disenos -> qué está listo (IA de texto, IA de imágenes) y las subcategorías
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { iaSocial } from "../../../lib/social-hub"
import { EXTENSIONES, MAX_MB_ARCHIVO, MAX_MB_IMAGEN, falListo, subcategoriasDisenos } from "../../../lib/subir-disenos"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    ia_texto: iaSocial(),
    ia_imagen: falListo(),
    subcategorias: await subcategoriasDisenos(req.scope).catch(() => []),
    extensiones: EXTENSIONES,
    max_mb_archivo: MAX_MB_ARCHIVO,
    max_mb_imagen: MAX_MB_IMAGEN,
  })
}
