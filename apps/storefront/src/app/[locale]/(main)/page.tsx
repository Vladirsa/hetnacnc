import { HetnaHome } from "@/components/hetna/HetnaHome"
import { BannerSection } from "@/components/sections/BannerSection/BannerSection"
import { BlogSection } from "@/components/sections/BlogSection/BlogSection"
import { Hero } from "@/components/sections/Hero/Hero"
import { HomeCategories } from "@/components/sections/HomeCategories/HomeCategories"
import { HomeProductSection } from "@/components/sections/HomeProductSection/HomeProductSection"
import { ShopByStyleSection } from "@/components/sections/ShopByStyle/ShopByStyleSection"

import type { Metadata } from "next"
import { headers } from "next/headers"
import { listRegions } from "@/lib/data/regions"
import { EMPRESA } from "@/lib/hetna/empresa"
import {
  buildHreflangAlternates,
  getStorefrontLocales,
  toHreflang,
} from "@/lib/helpers/hreflang"

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
    path: "",
    locale,
    locales,
  })

  // /us sale en inglés: título, descripción e imagen para Google y redes en inglés
  const enIngles = locale.toLowerCase() === "us"
  const title = enIngles ? "CNC marketplace, quotes and shop software" : "Inicio"
  const description = enIngles
    ? "HETNA CNC: the CNC marketplace. DXF, SVG and STL designs, machines, tooling, materials, CNC quoting software and design and machining services."
    : "HETNA CNC: marketplace de CNC en México. Diseños DXF, SVG y STL, máquinas, herramientas, materiales y servicios de diseño y maquila."
  const ogImage = enIngles ? "/og-hetna-en.png" : "/og-hetna.png"

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: `${title} | ${
        process.env.NEXT_PUBLIC_SITE_NAME ||
        "HETNA CNC"
      }`,
      description,
      url: canonical,
      siteName:
        process.env.NEXT_PUBLIC_SITE_NAME ||
        "HETNA CNC",
      type: "website",
      locale: enIngles ? "en_US" : "es_MX",
      images: [
        {
          url: ogImage.startsWith("http") ? ogImage : `${baseUrl}${ogImage}`,
          width: 1200,
          height: 630,
          alt:
            process.env.NEXT_PUBLIC_SITE_NAME ||
            "HETNA CNC",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.startsWith("http") ? ogImage : `${baseUrl}${ogImage}`],
    },
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

  const siteName =
    process.env.NEXT_PUBLIC_SITE_NAME ||
    "HETNA CNC"

  return (
    <main className="flex flex-col w-full text-primary">
      {/* <script> plano (no next/script): los crawlers que no ejecutan JS
          necesitan este JSON-LD presente en el HTML inicial, no inyectado
          tras la hidratación. */}
      <script
        id="ld-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${baseUrl}/#organization`,
            name: "HETNA CNC",
            alternateName: ["HETNA", "Hetna CNC", "hetnacnc"],
            url: baseUrl,
            logo: `${baseUrl}/Logo.png`,
            image: `${baseUrl}/og-hetna.png`,
            description:
              "Marketplace y software para talleres CNC: diseños, máquinas, herramientas, cotizador y maquila.",
            address: {
              "@type": "PostalAddress",
              addressLocality: EMPRESA.ciudad,
              addressRegion: EMPRESA.estado,
              addressCountry: "MX",
            },
            contactPoint: {
              "@type": "ContactPoint",
              telephone: `+${EMPRESA.whatsapp}`,
              contactType: "customer service",
              availableLanguage: ["es", "en"],
            },
            // Solo perfiles de la marca (no la cuenta personal ni el grupo)
            sameAs: EMPRESA.redes
              .filter((r) => !["LinkedIn", "Grupo Router CNC México"].includes(r.nombre))
              .map((r) => r.url),
          }).replace(/</g, "\\u003c"),
        }}
      />
      <script
        id="ld-website"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: siteName,
            alternateName: "HETNA",
            url: `${baseUrl}/${locale}`,
            inLanguage: toHreflang(locale),
            publisher: { "@id": `${baseUrl}/#organization` },
          }).replace(/</g, "\\u003c"),
        }}
      />

      <HetnaHome locale={locale} />
    </main>
  )
}
