// GET /vendor/hetna-publicar/plantilla → Excel para que el taller cargue muchos
// productos de una vez (versión taller: fotos por nombre de archivo).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { categoriasParaPublicar } from "../../../../lib/publicar-rapido"
import { plantillaProductos } from "../../../../lib/importar-productos/plantilla"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const cats = await categoriasParaPublicar(req.scope).catch(() => [] as Awaited<ReturnType<typeof categoriasParaPublicar>>)
  // "Padre > Hija": así la lee resolverCategoria cuando hay dos con el mismo nombre
  const nombres = cats.filter((c) => c.final).map((c) => c.ruta.replace(/ › /g, " > "))
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla-productos-taller.xlsx"')
  res.send(await plantillaProductos(nombres, { taller: true }))
}
