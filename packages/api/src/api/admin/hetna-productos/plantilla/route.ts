// GET /admin/hetna-productos/plantilla → Excel para cargar productos de la tienda HETNA
// (trae la lista de categorías actuales en la hoja Instrucciones).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { categoriasTienda, type Categoria } from "../../../../lib/importar-productos/importar"
import { plantillaProductos } from "../../../../lib/importar-productos/plantilla"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const cats: Categoria[] = await categoriasTienda(req.scope).catch(() => [] as Categoria[])
  const porId = new Map<string, Categoria>(cats.map((c) => [c.id, c]))
  const nombres = cats
    .filter((c) => c.is_active !== false && c.is_internal !== true)
    .map((c) => (c.parent_category_id && porId.get(c.parent_category_id) ? `${porId.get(c.parent_category_id)!.name} > ${c.name}` : c.name))
    .sort((a, b) => a.localeCompare(b, "es"))
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla-productos-hetna.xlsx"')
  res.send(await plantillaProductos(nombres))
}
