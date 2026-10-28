import { HttpTypes } from "@medusajs/types"
import { Metadata } from "next"
import { headers } from "next/headers"

import { listRegions } from "@/lib/data/regions"
import {
  buildHreflangAlternates,
  getStorefrontLocales,
} from "@/lib/helpers/hreflang"

export const generateProductMetadata = async (
  product: HttpTypes.StoreProduct,
  locale: string
): Promise<Metadata> => {
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
    path: `/products/${product?.handle}`,
    locale,
    locales,
  })

  // Las fichas de HETNA Digital Factory traen su propio título SEO y meta
  // description (metadata.seo_title / metadata.meta_description). Sin ellos se
  // usa el subtítulo, y al final el título del producto como antes.
  const meta = (product?.metadata || {}) as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "")
  const titulo = texto(meta.seo_title) || product?.title
  const descripcion =
    texto(meta.meta_description) ||
    texto(product?.subtitle) ||
    `${product?.title} - ${process.env.NEXT_PUBLIC_SITE_NAME}`

  return {
    title: titulo,
    description: descripcion,
    robots: "index, follow",
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical,
      languages,
    },

    openGraph: {
      title: titulo,
      description: descripcion,
      url: canonical,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME,
      images: [
        {
          url:
            product?.thumbnail ||
            `${protocol}://${host}/images/placeholder.svg`,
          width: 1200,
          height: 630,
          alt: product?.title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [
        product?.thumbnail || `${protocol}://${host}/images/placeholder.svg`,
      ],
    },
  }
}

export const generateCategoryMetadata = async (
  category: HttpTypes.StoreProductCategory
) => {
  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"

  return {
    robots: "index, follow",
    metadataBase: new URL(
      `${protocol}://${host}/categories/${category.handle}`
    ),
    title: `Categoría ${category.name}`,
    description: `Categoría ${category.name} - ${process.env.NEXT_PUBLIC_SITE_NAME}`,

    openGraph: {
      title: category.name,
      description: `Categoría ${category.name} - ${process.env.NEXT_PUBLIC_SITE_NAME}`,
      url: `${protocol}://${host}/categories/${category.handle}`,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME,
      images: [
        {
          url:
            `${protocol}://${host}/images/categories/${category.handle}.png` ||
            `${protocol}://${host}/images/placeholder.svg`,
          width: 1200,
          height: 630,
          alt: category.name,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: category.name,
      description: `Categoría ${category.name} - ${process.env.NEXT_PUBLIC_SITE_NAME}`,
      images: [
        `${protocol}://${host}/images/categories/${category.handle}.png` ||
          `${protocol}://${host}/images/placeholder.svg`,
      ],
    },
  }
}
