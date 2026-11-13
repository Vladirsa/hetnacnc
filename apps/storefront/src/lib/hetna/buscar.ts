"use server"

// Sugerencias del buscador del encabezado (problema 5 de la auditoría:
// búsqueda global con autocompletado). Une productos de la tienda con las
// páginas del sitio: categorías, servicios de fabricación, guías CNC,
// herramientas y cotizadores. Es una server action y no una ruta /api: así va
// por POST a la misma página y siempre llega a la tienda (nginx manda varias
// rutas /api a Medusa).
import { sdk } from "@/lib/client"
import { listCategories } from "@/lib/data/categories"
import { GRUPOS_HERRAMIENTAS } from "@/lib/hetna/herramientas"
import { HERRAMIENTAS_DISENO } from "@/lib/hetna/disenar"
import { FABRICACION } from "@/lib/hetna/navegacion"
import { GUIAS } from "@/lib/seo/guias"

export type Sugerencia = { tipo: "producto" | "categoria" | "servicio" | "guia" | "herramienta"; texto: string; href: string; imagen?: string | null }

const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

const PAGINAS: Sugerencia[] = [
  { tipo: "herramienta", texto: "Cotizar un trabajo con talleres", href: "/cotizar" },
  { tipo: "herramienta", texto: "Precio de corte láser", href: "/cotizar/corte-laser" },
  { tipo: "herramienta", texto: "Precio de corte en router CNC", href: "/cotizar/router-cnc" },
  { tipo: "herramienta", texto: "Precio de corte plasma", href: "/cotizar/corte-plasma" },
  { tipo: "herramienta", texto: "Precio de impresión 3D", href: "/cotizar/impresion-3d" },
  { tipo: "herramienta", texto: "Calculadora CNC de avance y RPM", href: "/calculadora-cnc" },
  { tipo: "herramienta", texto: "Talleres CNC", href: "/talleres" },
  { tipo: "herramienta", texto: "Trabajos abiertos", href: "/trabajos" },
  { tipo: "herramienta", texto: "Foro CNC", href: "/foro-cnc" },
  ...FABRICACION.flatMap((g) => g.enlaces.map((e) => ({ tipo: "servicio" as const, texto: `${e.texto} (${g.titulo.toLowerCase()})`, href: e.href }))),
  ...GUIAS.map((g) => ({ tipo: "guia" as const, texto: g.h1, href: `/cnc/${g.slug}` })),
  ...GRUPOS_HERRAMIENTAS.map((g) => ({ tipo: "herramienta" as const, texto: g.titulo, href: g.href ?? `/herramientas-cnc#${g.id}` })),
  ...HERRAMIENTAS_DISENO.map((h) => ({ tipo: "herramienta" as const, texto: h.nombre, href: `/disenar/${h.slug}` })),
]

// Coincide si todas las palabras de la búsqueda aparecen (en cualquier orden)
const coincide = (texto: string, palabras: string[]) => {
  const t = normal(texto)
  return palabras.every((p) => t.includes(p))
}

export async function sugerencias(consulta: string): Promise<Sugerencia[]> {
  const q = String(consulta || "").slice(0, 80).trim()
  if (q.length < 2) return []
  const palabras = normal(q).split(/\s+/).filter(Boolean)

  type Producto = { title: string; handle: string; thumbnail?: string | null }
  type Categoria = { name: string; handle: string }
  // El cliente de Medusa no trae tipos para estas consultas (igual que en lib/seo/mapa-sitio)
  const tienda = (sdk as unknown as { store: { products: { query: (p: unknown) => Promise<{ products?: Producto[] }> } } }).store
  const [productos, categorias]: [Producto[], Categoria[]] = await Promise.all([
    tienda.products
      .query({ q, limit: 5, fields: "title,handle,thumbnail", fetchOptions: { next: { revalidate: 60 } } })
      .then((r) => r.products ?? [])
      .catch(() => [] as Producto[]),
    // Todo el árbol (también las hojas, p. ej. "Routers CNC"), no sólo el segundo nivel
    listCategories()
      .then((r) => {
        type Nodo = Categoria & { category_children?: Nodo[] | null }
        const todas: Categoria[] = []
        const recorrer = (c: Nodo) => {
          todas.push({ name: c.name, handle: c.handle })
          ;(c.category_children ?? []).forEach(recorrer)
        }
        ;((r as unknown as { parentCategories?: Nodo[] }).parentCategories ?? []).forEach(recorrer)
        return todas
      })
      .catch(() => [] as Categoria[]),
  ])

  const vistos = new Set<string>()
  const unico = (s: Sugerencia) => (vistos.has(s.href) ? false : (vistos.add(s.href), true))

  return [
    ...productos.map((p) => ({ tipo: "producto" as const, texto: p.title, href: `/products/${p.handle}`, imagen: p.thumbnail || null })),
    ...categorias
      .filter((c) => c.handle !== "servicios" && coincide(c.name, palabras))
      .slice(0, 4)
      .map((c) => ({ tipo: "categoria" as const, texto: c.name, href: `/categories/${c.handle}` })),
    ...PAGINAS.filter((p) => coincide(p.texto, palabras)).slice(0, 5),
  ]
    .filter(unico)
    .slice(0, 10)
}
