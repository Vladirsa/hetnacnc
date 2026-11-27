// Datos del catálogo en el idioma de la página (fase 3 del inglés).
//
// Productos: el vendedor (o la traducción inicial) guarda el texto en inglés en
// product.metadata: en_title, en_subtitle, en_description. Si un campo no
// existe, se queda el texto en español.
// Categorías: category.metadata.en_name / en_description; si no hay, se usa el
// diccionario (src/i18n/en*.ts), que ya trae los nombres de las categorías.
//
// Sólo cambia algo cuando la página está en inglés (idiomaServidor), así que el
// HTML en español es idéntico al de antes. Se aplica en lib/data/*.ts, después
// de traer los datos (la caché de fetch guarda la respuesta original del API).
import { idiomaServidor, traductor } from "./servidor"

type ConMetadata = { metadata?: Record<string, unknown> | null }

const texto = (m: Record<string, unknown> | null | undefined, k: string) => {
  const v = m?.[k]
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

async function enIngles(): Promise<boolean> {
  try {
    return (await idiomaServidor()) === "en"
  } catch {
    // Fuera de una petición (build, tareas): español.
    return false
  }
}

/**
 * Producto con title/subtitle/description (y título/descripción SEO) en inglés
 * si los tiene. Puro: no lee el idioma. La descripción en español queda en
 * metadata.descripcion_es, porque hay código que lee de ella campos como
 * "Medidas:" o "Material:" (lib/hetna/tipo-producto.ts).
 */
export function productoEn<P extends ConMetadata & { title?: string | null; subtitle?: string | null; description?: string | null }>(p: P): P {
  const m = p?.metadata
  if (!m) return p
  const title = texto(m, "en_title")
  const subtitle = texto(m, "en_subtitle")
  const description = texto(m, "en_description")
  const seoTitle = texto(m, "en_seo_title")
  const metaDescription = texto(m, "en_meta_description")
  if (!title && !subtitle && !description && !seoTitle && !metaDescription) return p
  return {
    ...p,
    ...(title ? { title } : {}),
    ...(subtitle ? { subtitle } : {}),
    ...(description ? { description } : {}),
    metadata: {
      ...m,
      ...(description && p.description ? { descripcion_es: p.description } : {}),
      // El título SEO en español no debe ganarle al título en inglés.
      ...(seoTitle ? { seo_title: seoTitle } : title ? { seo_title: undefined } : {}),
      ...(metaDescription ? { meta_description: metaDescription } : description ? { meta_description: undefined } : {}),
    },
  }
}

/** Lista de productos en el idioma de la página. */
export async function localizarProductos<P extends ConMetadata>(lista: P[]): Promise<P[]> {
  if (!lista?.length || !(await enIngles())) return lista
  return lista.map((p) => productoEn(p as never) as P)
}

export async function localizarProducto<P extends ConMetadata>(p: P | undefined): Promise<P | undefined> {
  if (!p || !(await enIngles())) return p
  return productoEn(p as never) as P
}

type CategoriaLike = ConMetadata & {
  name?: string | null
  description?: string | null
  category_children?: CategoriaLike[] | null
  parent_category?: CategoriaLike | null
}

/** Categorías (y sus hijas/padre) en el idioma de la página. */
export async function localizarCategorias<C extends CategoriaLike>(lista: C[]): Promise<C[]> {
  if (!lista?.length || !(await enIngles())) return lista
  const t = await traductor()
  const una = (c: CategoriaLike): CategoriaLike => {
    if (!c || typeof c !== "object") return c
    const name = texto(c.metadata, "en_name") || (c.name ? t(c.name) : c.name)
    const description = texto(c.metadata, "en_description") || (c.description ? t(c.description) : c.description)
    return {
      ...c,
      name,
      description,
      ...(Array.isArray(c.category_children) ? { category_children: c.category_children.map(una) } : {}),
      ...(c.parent_category ? { parent_category: una(c.parent_category) } : {}),
    }
  }
  return lista.map((c) => una(c) as C)
}

export async function localizarCategoria<C extends CategoriaLike>(c: C | undefined): Promise<C | undefined> {
  if (!c) return c
  return (await localizarCategorias([c]))[0]
}
