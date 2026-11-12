import { ProductListingSkeleton } from "@/components/organisms/ProductListingSkeleton/ProductListingSkeleton"
import { Suspense } from "react"

import { Breadcrumbs } from "@/components/atoms/Breadcrumbs/Breadcrumbs"
import { argsDeListado, claveListado, paramsDe } from "@/lib/helpers/busqueda-listado"
import { SearchProductsListing, type ListadoInicial } from "@/components/sections/ProductListing/SearchProductsListing"
import { ProductListing } from "@/components/sections/ProductListing/ProductListing"
import isBot from "@/lib/helpers/isBot"
import { headers } from "next/headers"
import { IMAGEN_OG } from "@/lib/helpers/seo"
import type { Metadata } from "next"
import { listRegions } from "@/lib/data/regions"
import { listProducts, searchProducts } from "@/lib/data/products"
import { paraTarjeta } from "@/lib/helpers/tarjeta-producto"
import {
  buildHreflangAlternates,
  getStorefrontLocales,
} from "@/lib/helpers/hreflang"

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

  let locales: string[] = []
  try {
    locales = getStorefrontLocales(await listRegions())
  } catch {
    locales = [locale]
  }

  const { canonical, languages } = buildHreflangAlternates({
    baseUrl,
    path: "/categories",
    locale,
    locales,
  })

  const title = "Todos los productos"
  const description = `Browse all products on ${
    process.env.NEXT_PUBLIC_SITE_NAME || "our store"
  }`

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} | ${process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"}`,
      description,
      url: canonical,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC",
      type: "website",
      images: [IMAGEN_OG],
    },
  }
}

// La primera página del listado se trae en el servidor: así las fotos salen en el
// HTML y no esperan a que el navegador cargue la página y vuelva a pedirlas.
async function primeraPagina(locale: string, filtros: Record<string, string | string[] | undefined>): Promise<ListadoInicial | undefined> {
  const args = argsDeListado(paramsDe(filtros))
  try {
    const r = await searchProducts({ ...args, countryCode: locale })
    return { clave: claveListado(args, `${locale}|||`), products: r.products.map(paraTarjeta), count: r.count }
  } catch {
    return undefined // el navegador la pide como antes
  }
}

async function AllCategories({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const filtros = await searchParams

  const ua = (await headers()).get("user-agent") || ""
  const bot = isBot(ua)
  // La primera página se pide junto con la lista para buscadores y entra al HTML principal:
  // dentro de un Suspense llegaba al final del documento, detrás de ~150 KB del resto de la página,
  // y la primera foto tardaba en pintarse aunque ya estuviera descargada.
  const inicialP = bot ? Promise.resolve(undefined) : primeraPagina(locale, filtros)

  const breadcrumbsItems = [
    {
      path: "/categories",
      label: "Todos los productos",
    },
  ]

  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
  const [
    {
      response: { products: jsonLdProducts },
    },
    inicial,
  ] = await Promise.all([
    listProducts({
      countryCode: locale,
      queryParams: { limit: 8, order: "created_at", fields: "id,title,handle" },
    }),
    inicialP,
  ])

  const itemList = jsonLdProducts.slice(0, 8).map((p, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    url: `${baseUrl}/${locale}/products/${p.handle}`,
    name: p.title,
  }))

  return (
    <main className="container">
      {/* <script> plano (no next/script): necesario en el HTML inicial para
          crawlers que no esperan a la hidratación. */}
      <script
        id="ld-breadcrumbs-categories"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Todos los productos",
                item: `${baseUrl}/${locale}/categories`,
              },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
      <script
        id="ld-itemlist-categories"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: itemList,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <div className="hidden md:block mb-2">
        <Breadcrumbs items={breadcrumbsItems} />
      </div>

      <h1 className="heading-xl uppercase">Todos los productos</h1>

      <Suspense fallback={<div data-testid="all-categories-page-loading"><ProductListingSkeleton /></div>}>
        {bot ? (
          <ProductListing showSidebar locale={locale} searchParams={filtros} />
        ) : (
          <SearchProductsListing locale={locale} inicial={inicial} />
        )}
      </Suspense>
    </main>
  )
}

export default AllCategories
