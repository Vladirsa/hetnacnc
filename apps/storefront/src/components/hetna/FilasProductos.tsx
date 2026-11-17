import { promediosDeProductos } from "@/lib/resenas/acciones"

import TarjetaProducto, { vendedoresPorProducto } from "./TarjetaProducto"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import CarruselFila from "./CarruselFila"
import { tipoFicha } from "@/lib/hetna/tipo-ficha"
import { licenciaDe } from "@/lib/hetna/licencias"
import { precioMinimo } from "@/lib/helpers/filtrar-listado"
import {
  collectCategorySubtreeIds,
  listCategories,
} from "@/lib/data/categories"
import { listCollections } from "@/lib/data/collections"
import { listProducts } from "@/lib/data/products"

const LIMITE = 10

type Filtro = { category_id?: string[]; collection_id?: string }

const normaliza = (t?: string | null) =>
  (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

const traer = async (locale: string, filtro: Filtro) => {
  const { response } = await listProducts({
    countryCode: locale,
    category_id: filtro.category_id,
    collection_id: filtro.collection_id,
    queryParams: { limit: LIMITE, order: "-created_at" },
  })
  return response.products
}

// Inicio con varias filas de productos, como una tienda en línea (pedido del
// dueño, 15 nov 2026: "más carruseles, hay más banners que productos").
// Las filas se arman por TIPO de producto y no sólo por categoría, así se
// llenan aunque los productos todavía no estén en una categoría visible.
// Una fila con los mismos productos que otra anterior no se repite.
type Fila = { titulo: string; subtitulo?: string; href?: string; productos: HttpTypes.StoreProduct[] }

export const FilasProductos = async ({ locale }: { locale: string }) => {
  const [cats, cols, todosResp] = await Promise.all([
    listCategories({ query: { include_ancestors_tree: true } }).catch(() => ({
      categories: [],
      parentCategories: [],
    })) as Promise<{
      categories: HttpTypes.StoreProductCategory[]
      parentCategories: HttpTypes.StoreProductCategory[]
    }>,
    listCollections().catch(() => ({
      collections: [] as HttpTypes.StoreCollection[],
      count: 0,
    })),
    listProducts({ countryCode: locale, queryParams: { limit: 100, order: "-created_at" } }).catch(() => ({
      response: { products: [] as HttpTypes.StoreProduct[], count: 0 },
    })),
  ])
  const todos = (todosResp as { response: { products: HttpTypes.StoreProduct[] } }).response.products
  const tipo = (p: HttpTypes.StoreProduct) => tipoFicha(p as never)
  const conPrecio = todos.filter((p) => precioMinimo(p) !== null || (p.metadata as Record<string, unknown> | null)?.archivo_gratis === true)
  const MAX = 14

  // Más vendidos y las categorías se piden en paralelo (auditoría Thermos)
  const masVendidos = cols.collections.find((c) => c.handle === "mas-vendidos")
  const todas = [...cats.categories, ...cats.parentCategories]
  const conCategoria = ["Máquinas y equipos", "Herramientas y componentes", "Materiales y consumibles", "Diseños CNC", "Productos"]
    .map((nombre) => todas.find((x) => normaliza(x.name) === normaliza(nombre)))
    .filter((c): c is NonNullable<typeof c> => !!c)
  const [vendidos, porCategoria] = await Promise.all([
    masVendidos ? traer(locale, { collection_id: masVendidos.id }) : Promise.resolve([] as HttpTypes.StoreProduct[]),
    Promise.all(conCategoria.map((c) => traer(locale, { category_id: collectCategorySubtreeIds(c) }))),
  ])

  const filas: Fila[] = [{ titulo: "Lo más nuevo", href: "/categories", productos: todos.slice(0, MAX) }]
  if (masVendidos) filas.push({ titulo: "Más vendidos", productos: vendidos })

  const digitales = todos.filter((p) => tipo(p) === "digital")
  filas.push({
    titulo: "Diseños DXF y STL listos para cortar",
    subtitulo: "Descarga inmediata tras el pago",
    href: "/categories",
    productos: digitales.slice(0, MAX),
  })
  filas.push({
    titulo: "Programación CAM y servicios",
    subtitulo: "Te entregamos el programa listo para tu máquina",
    href: "/laboratorio-cam",
    productos: todos.filter((p) => tipo(p) === "servicio").slice(0, MAX),
  })
  filas.push({
    titulo: "Para vender tus piezas",
    subtitulo: "Diseños con licencia comercial",
    href: "/categories?licencia=comercial",
    productos: digitales.filter((p) => licenciaDe(p.metadata as Record<string, unknown> | null).licencia.clave !== "personal").slice(0, MAX),
  })
  filas.push({
    titulo: "Precios bajos",
    subtitulo: "Lo más accesible de la tienda",
    href: "/categories?sortBy=price_asc",
    productos: [...conPrecio].sort((a, b) => (precioMinimo(a) ?? 0) - (precioMinimo(b) ?? 0)).slice(0, MAX),
  })
  filas.push({
    titulo: "Máquinas, herramientas y materiales",
    href: "/categories",
    productos: todos.filter((p) => tipo(p) === "fisico").slice(0, MAX),
  })

  // Y las categorías que sí tienen productos
  conCategoria.forEach((c, i) => filas.push({ titulo: c.name, href: `/categories/${c.handle}`, productos: porCategoria[i] }))

  // Sin filas vacías ni repetidas
  const vistas = new Set<string>()
  const finales = filas.filter((f) => {
    if (!f.productos.length) return false
    const clave = f.productos.map((p) => p.id).sort().join(",")
    if (vistas.has(clave)) return false
    vistas.add(clave)
    return true
  })
  if (!finales.length) return null

  const mapa = await vendedoresPorProducto(locale)
  // Los promedios de TODAS las filas en una sola llamada. Una por tarjeta
  // serían veinte peticiones en la pantalla donde más importa la velocidad.
  const calificaciones = await promediosDeProductos([...new Set(finales.flatMap((f) => f.productos.map((p) => p.id)))])

  return (
    <div className="w-full py-2" data-testid="filas-productos">
      {finales.map((f) => (
        <section key={f.titulo} className="px-4 lg:px-16 py-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display m-0 text-[20px] font-bold text-[#142033]">{f.titulo}</h2>
              {f.subtitulo && <p className="m-0 mt-0.5 text-[13px] text-[#6B6A63]">{f.subtitulo}</p>}
            </div>
            {f.href && (
              <LocalizedClientLink href={f.href} className="shrink-0 text-[13.5px] font-semibold text-[#B34D07] hover:underline">
                Ver todo →
              </LocalizedClientLink>
            )}
          </div>
          <CarruselFila>
            {f.productos.map((p) => (
              <TarjetaProducto key={p.id} product={p} vendedor={mapa.get(p.id)} calificacion={calificaciones.get(p.id)} locale={locale} />
            ))}
          </CarruselFila>
        </section>
      ))}
    </div>
  )
}
