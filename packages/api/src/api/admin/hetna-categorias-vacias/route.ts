// GET /admin/hetna-categorias-vacias — categorías que la tienda esconde porque
// no tienen productos publicados (ni ellas ni sus subcategorías). Catálogo
// honesto, tarea 1 de la auditoría de mejoras (apps/storefront/src/lib/hetna/catalogo.ts).
// Nada se borra: en cuanto una tenga un producto publicado, vuelve a salir sola.
// Las páginas de servicio de fabricación (corte láser, maquinado…) nunca se
// esconden; aquí salen marcadas como "servicio".
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Mismos handles que SERVICIOS en apps/storefront/src/components/hetna/servicios/ServicioCategoria.tsx
const SERVICIOS = new Set([
  "corte-laser", "corte-plasma", "maquinado-cnc", "torneado-cnc", "maquinado-4-y-5-ejes",
  "impresion-3d", "prototipado", "maquila", "diseno-2d-3d", "programacion-cam", "router-cnc", "servicios",
])

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const cats = (await knex("product_category")
    .whereNull("deleted_at")
    .select("id", "name", "handle", "parent_category_id", "rank")) as any[]
  const directos = (await knex("product_category_product as pc")
    .join("product as p", "p.id", "pc.product_id")
    .where("p.status", "published")
    .whereNull("p.deleted_at")
    .groupBy("pc.product_category_id")
    .select("pc.product_category_id as id")
    .count("* as n")) as { id: string; n: string }[]
  const propios = new Map(directos.map((d) => [d.id, Number(d.n)]))

  const hijos = new Map<string, any[]>()
  for (const c of cats) {
    const l = hijos.get(c.parent_category_id) || []
    l.push(c)
    hijos.set(c.parent_category_id, l)
  }
  const total = (c: any): number => (propios.get(c.id) || 0) + (hijos.get(c.id) || []).reduce((s, h) => s + total(h), 0)
  const porId = new Map(cats.map((c) => [c.id, c]))
  const ruta = (c: any): string => {
    const p = c.parent_category_id ? porId.get(c.parent_category_id) : null
    return p ? `${ruta(p)} › ${c.name}` : c.name
  }

  const filas = cats
    .map((c) => ({ id: c.id, nombre: c.name, handle: c.handle, ruta: ruta(c), productos: total(c), servicio: SERVICIOS.has(c.handle) }))
    .sort((a, b) => a.ruta.localeCompare(b.ruta, "es"))
  return res.json({
    ocultas: filas.filter((f) => f.productos === 0 && !f.servicio),
    visibles: filas.filter((f) => f.productos > 0 || f.servicio),
  })
}
