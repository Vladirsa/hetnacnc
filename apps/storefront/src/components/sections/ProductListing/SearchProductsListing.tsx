"use client"

import { HttpTypes } from "@medusajs/types"
import { ProductsPagination } from "@/components/organisms/ProductsPagination/ProductsPagination"
import { ProductSearchSidebar } from "@/components/organisms/ProductSearchSidebar/ProductSearchSidebar"
import { ProductListingActiveFilters } from "@/components/organisms/ProductListingActiveFilters/ProductListingActiveFilters"
import ProductListingLoadingView from "@/components/molecules/ProductListingLoadingView/ProductListingLoadingView"
import ProductListingNoResultsView from "@/components/molecules/ProductListingNoResultsView/ProductListingNoResultsView"
import ProductListingProductsView from "@/components/molecules/ProductListingProductsView/ProductListingProductsView"
import { useSearchParams } from "next/navigation"
import { PRODUCT_LIMIT } from "@/const"
import { ProductListingSkeleton } from "@/components/organisms/ProductListingSkeleton/ProductListingSkeleton"
import { useEffect, useMemo, useRef, useState } from "react"
import { argsDeListado, claveListado } from "@/lib/helpers/busqueda-listado"
import {
  getSearchFacets,
  searchProducts,
  type SearchFacets,
} from "@/lib/data/products"

const EMPTY_FACETS: SearchFacets = { attributes: {} }

/** Primera página que ya trajo el servidor, para que las fotos no esperen a que cargue la página entera. */
export type ListadoInicial = { clave: string; products: HttpTypes.StoreProduct[]; count: number }

export const SearchProductsListing = ({
  category_id,
  collection_id,
  seller_id,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION,
  inicial,
}: {
  category_id?: string | string[]
  collection_id?: string
  seller_id?: string
  locale?: string
  inicial?: ListadoInicial
}) => {
  const searchParams = useSearchParams()
  const categoryKey = Array.isArray(category_id)
    ? category_id.join(",")
    : category_id

  const searchParamsKey = searchParams.toString()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const args = useMemo(() => argsDeListado(new URLSearchParams(searchParamsKey)), [searchParamsKey])
  const { query = "", page, sortBy } = args
  const minPrice = args.minPrice === undefined ? "" : String(args.minPrice)
  const maxPrice = args.maxPrice === undefined ? "" : String(args.maxPrice)
  const disponible = args.onlyAvailable
  const clave = claveListado(args, `${locale}|${categoryKey ?? ""}|${collection_id ?? ""}|${seller_id ?? ""}`)
  const sirveInicial = !!inicial && inicial.clave === clave

  const [facets, setFacets] = useState<SearchFacets>(EMPTY_FACETS)
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>(sirveInicial ? inicial!.products : [])
  const [count, setCount] = useState(sirveInicial ? inicial!.count : 0)
  const [isLoading, setIsLoading] = useState(!sirveInicial)
  // Con la primera página del servidor no se vuelve a pedir lo mismo al abrir
  const yaTraida = useRef(sirveInicial)

  useEffect(() => {
    getSearchFacets()
      .then(setFacets)
      .catch(() => setFacets(EMPTY_FACETS))
  }, [])

  const attributesKey = JSON.stringify(args.attributes)
  const attributes = useMemo(
    () => JSON.parse(attributesKey) as Record<string, string[]>,
    [attributesKey]
  )

  useEffect(() => {
    async function fetchProducts() {
      if (!locale) return
      if (yaTraida.current) {
        yaTraida.current = false
        return
      }

      try {
        setIsLoading(true)
        const result = await searchProducts({
          query: query || undefined,
          countryCode: locale,
          category_id,
          collection_id,
          seller_id,
          attributes,
          page,
          limit: PRODUCT_LIMIT,
          sortBy,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          onlyAvailable: disponible,
        })

        setProducts(result.products)
        setCount(result.count)
      } catch (error) {
        setProducts([])
        setCount(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, categoryKey, collection_id, seller_id, query, page, sortBy, attributesKey, minPrice, maxPrice, disponible])

  if (isLoading && products.length === 0) return <ProductListingSkeleton />

  const pages = Math.ceil(count / PRODUCT_LIMIT) || 1

  return (
    <div className="min-h-[70vh]">
      <div className="flex justify-between w-full items-center">
        <div className="my-4 label-md">{`${count} ${count === 1 ? "producto" : "productos"}`}</div>
      </div>
      <div className="hidden md:block">
        <ProductListingActiveFilters nombres={facets.nombres} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <aside className="md:col-span-1">
          <ProductSearchSidebar facets={facets} />
        </aside>
        <div className="md:col-span-3 w-full flex flex-col">
          {isLoading && <ProductListingLoadingView />}

          {!isLoading && !products.length && <ProductListingNoResultsView />}

          {!isLoading && products.length > 0 && (
            <ProductListingProductsView products={products} />
          )}

          <div className="mt-auto">
            <ProductsPagination pages={pages} />
          </div>
        </div>
      </div>
    </div>
  )
}
