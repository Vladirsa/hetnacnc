import Image from "next/image"
import TarjetaProducto, { vendedoresPorProducto } from "./TarjetaProducto"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import {
  collectCategorySubtreeIds,
  listCategories,
} from "@/lib/data/categories"
import { listCollections } from "@/lib/data/collections"
import { listProducts } from "@/lib/data/products"
import { getProductPrice } from "@/lib/helpers/get-product-price"

const LIMITE = 10

type Filtro = { category_id?: string[]; collection_id?: string }
type Pedido = { titulo: string; href?: string; filtro: Filtro }

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

const Tarjeta = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const precio = getProductPrice({ product }).cheapestPrice?.calculated_price
  let foto: string | null = null
  try {
    foto = product.thumbnail ? decodeURIComponent(product.thumbnail) : null
  } catch {
    foto = product.thumbnail || null
  }

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="snap-start shrink-0 w-[150px] sm:w-[165px] bg-white border border-[#E7E4DC] rounded-[12px] overflow-hidden flex flex-col transition hover:shadow-[0_4px_14px_rgba(27,27,24,0.08)]"
    >
      <div className="relative h-[120px] sm:h-[130px] bg-[#F4F1EA]">
        <Image
          src={foto || "/images/placeholder.svg"}
          alt={product.title || "Producto"}
          fill
          sizes="165px"
          loading="lazy"
          unoptimized={!foto}
          className="object-contain p-2"
        />
      </div>
      <div className="p-2.5 flex flex-col gap-1">
        <span className="text-[12.5px] leading-[1.3] text-[#1B1B18] line-clamp-2 min-h-[32px]">
          {product.title}
        </span>
        <span className="text-[14px] font-semibold text-[#142033]">
          {precio}
        </span>
      </div>
    </LocalizedClientLink>
  )
}

export const FilasProductos = async ({ locale }: { locale: string }) => {
  const [cats, cols] = await Promise.all([
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
  ])

  const todas = [...cats.categories, ...cats.parentCategories]
  const pedidos: Pedido[] = [
    { titulo: "Lo más nuevo", href: "/categories", filtro: {} },
  ]

  const masVendidos = cols.collections.find((c) => c.handle === "mas-vendidos")
  if (masVendidos) {
    pedidos.push({
      titulo: "Más vendidos",
      filtro: { collection_id: masVendidos.id },
    })
  }

  for (const nombre of [
    "Máquinas y equipos",
    "Herramientas y componentes",
    "Materiales y consumibles",
    "Diseños CNC",
    "Productos",
  ]) {
    const c = todas.find((x) => normaliza(x.name) === normaliza(nombre))
    if (c) {
      pedidos.push({
        titulo: c.name,
        href: `/categories/${c.handle}`,
        filtro: { category_id: collectCategorySubtreeIds(c) },
      })
    }
  }

  const filas = (
    await Promise.all(
      pedidos.map(async (p) => ({
        ...p,
        productos: await traer(locale, p.filtro),
      }))
    )
  ).filter((f) => f.productos.length > 0)

  if (!filas.length) return null

  const mapa = await vendedoresPorProducto(locale)

  return (
    <div className="w-full">
      {filas.map((f) => (
        <section key={f.titulo} className="px-4 lg:px-16 py-3">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="font-display text-[18px] font-semibold m-0">
              {f.titulo}
            </h2>
            {f.href && (
              <LocalizedClientLink
                href={f.href}
                className="text-[13px] font-semibold text-[#B34D07]"
              >
                Ver todo →
              </LocalizedClientLink>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
            {f.productos.map((p) => (
              <TarjetaProducto key={p.id} product={p} vendedor={mapa.get(p.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
