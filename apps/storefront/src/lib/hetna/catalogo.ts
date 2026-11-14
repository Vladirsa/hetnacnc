// Catálogo honesto (auditoría de mejoras del 14 nov 2026, tarea 1): ninguna
// categoría vacía en el menú, en la barra ni en el mapa del sitio.
//
// Una categoría se muestra si ella o alguna de sus subcategorías tiene al
// menos un producto publicado, o si es una página de servicio de fabricación
// (corte láser, maquinado…: ésas no venden productos, reciben solicitudes).
// No se borra nada: en cuanto un taller publica un producto en una categoría
// oculta, vuelve a salir sola (la lista se renueva cada 5 minutos).
//
// Las ocultas se ven en el admin, en "Categorías ocultas"
// (GET /admin/hetna-categorias-vacias).
import { sdk } from "@/lib/client"
import { esCategoriaServicio } from "@/components/hetna/servicios/ServicioCategoria"

type Cat = { id: string; handle: string; category_children?: Cat[] | null }
// El cliente de Medusa no trae tipos para estas consultas (igual que en lib/seo/mapa-sitio)
const tienda = () => (sdk as unknown as { store: Record<string, { query: (p: unknown) => Promise<unknown> }> }).store

/** Ids de las categorías que tienen asignado al menos un producto publicado. */
export async function categoriasConProductos(): Promise<Set<string> | null> {
  try {
    const ids = new Set<string>()
    for (let offset = 0; offset < 2000; offset += 200) {
      const r = (await tienda().products.query({
        fields: "id,categories.id",
        limit: 200,
        offset,
        fetchOptions: { next: { revalidate: 300 } },
      } as never)) as unknown as { products?: { categories?: { id: string }[] | null }[]; count?: number }
      const lote = r.products ?? []
      for (const p of lote) for (const c of p.categories ?? []) ids.add(c.id)
      if (lote.length < 200) break
    }
    return ids
  } catch {
    // Si la tienda no responde, mejor mostrar todo que esconder lo que sí hay
    return null
  }
}

/** ¿Tiene algo que ver (productos en ella o en sus hijas, o es un servicio)? */
export const tieneContenido = (c: Cat, conProductos: Set<string> | null): boolean =>
  conProductos === null ||
  conProductos.has(c.id) ||
  esCategoriaServicio(c.handle) ||
  (c.category_children ?? []).some((h) => tieneContenido(h, conProductos))

/** El mismo árbol sin las ramas vacías (no modifica el original). */
export function podarArbol<T extends Cat>(cats: T[], conProductos: Set<string> | null): T[] {
  if (conProductos === null) return cats
  return cats
    .filter((c) => tieneContenido(c, conProductos))
    .map((c) => ({ ...c, category_children: c.category_children ? podarArbol(c.category_children as T[], conProductos) : c.category_children }))
}

/** Categorías que sí tienen productos, para sugerirlas cuando algo sale vacío. */
export async function categoriasSugeridas(max = 6): Promise<{ nombre: string; handle: string }[]> {
  const [conProductos, r] = await Promise.all([
    categoriasConProductos(),
    (tienda().productCategories.query({
      fields: "id,name,handle",
      limit: 200,
      fetchOptions: { next: { revalidate: 300 } },
    } as never) as unknown as Promise<{ product_categories?: { id: string; name: string; handle: string }[] }>).catch(() => ({ product_categories: [] })),
  ])
  if (!conProductos) return []
  return (r.product_categories ?? [])
    .filter((c) => conProductos.has(c.id) && !esCategoriaServicio(c.handle) && c.handle !== "servicios")
    .slice(0, max)
    .map((c) => ({ nombre: c.name, handle: c.handle }))
}
