import { ProductListingActiveFilters } from "@/components/organisms/ProductListingActiveFilters/ProductListingActiveFilters"
import { ProductListingHeader } from "@/components/organisms/ProductListingHeader/ProductListingHeader"
import { ProductSidebar } from "@/components/organisms/ProductSidebar/ProductSidebar"
import { ProductsList } from "@/components/organisms/ProductsList/ProductsList"
import { ProductsPagination } from "@/components/organisms/ProductsPagination/ProductsPagination"
import { PRODUCT_LIMIT } from "@/const"
import { listProductsWithSort } from "@/lib/data/products"
import { filtrarYOrdenar, leerFiltros, ordenValido } from "@/lib/helpers/filtrar-listado"

export const ProductListing = async ({
  category_id,
  collection_id,
  showSidebar = false,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION || "pl",
  searchParams,
}: {
  category_id?: string | string[]
  collection_id?: string
  showSidebar?: boolean
  locale?: string
  // ?page, ?sortBy, ?min_price, ?max_price, ?disponible=1
  searchParams?: Record<string, string | string[] | undefined>
}) => {
  // Se traen hasta 100 y aquí se filtran, ordenan y paginan (la API no filtra
  // por precio ni existencia): lib/helpers/filtrar-listado.ts
  const { response } = await listProductsWithSort({
    category_id,
    collection_id,
    countryCode: locale,
    sortBy: "created_at",
    queryParams: {
      limit: 100,
    },
  })

  const todos = filtrarYOrdenar(response.products, leerFiltros(searchParams), ordenValido(searchParams?.sortBy))
  const count = todos.length
  const pages = Math.ceil(count / PRODUCT_LIMIT) || 1
  const pagina = Math.min(Math.max(1, Number(searchParams?.page) || 1), pages)
  const products = todos.slice((pagina - 1) * PRODUCT_LIMIT, pagina * PRODUCT_LIMIT)

  return (
    <div className="py-4" data-testid="product-listing-container">
      <ProductListingHeader total={count} />
      <div className="hidden md:block">
        <ProductListingActiveFilters />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 mt-6 gap-4">
        {showSidebar && <ProductSidebar />}
        <section className={showSidebar ? "col-span-3" : "col-span-4"} data-testid="product-listing-section">
          <div className="flex flex-wrap gap-4" data-testid="product-list">
            <ProductsList products={products} />
          </div>
          <ProductsPagination pages={pages} />
        </section>
      </div>
    </div>
  )
}
