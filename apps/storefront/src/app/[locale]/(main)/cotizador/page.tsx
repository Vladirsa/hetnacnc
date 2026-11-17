import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CotizadorLandingEn, FAQ_EN, PRECIOS_USD_DEFAULT, type PreciosUsd } from "@/components/hetna/taller/CotizadorLandingEn"

// /us/cotizador: the HETNA CNC shop app in English, for US shops (prices in USD).
// Other countries see the Spanish page (/mx/servicios/cotizador-cnc).
// /cotizador/ without a country is the app itself (Flutter web, served by nginx).

type Props = { params: Promise<{ locale: string }> }

const SITIO = "https://hetnacnc.com"
const URL_EN = `${SITIO}/us/cotizador`
const URL_ES = `${SITIO}/mx/servicios/cotizador-cnc`

export const revalidate = 3600

export const metadata: Metadata = {
  title: { absolute: "HETNA CNC: quoting app for CNC shops | Router, laser, plasma" },
  description:
    "Quote CNC jobs in minutes with your real machine time, material and margin. Price from DXF, SVG, STL or OBJ files, send branded PDF quotes and track every customer. 14-day free trial.",
  alternates: {
    canonical: URL_EN,
    languages: { "en-US": URL_EN, "es-MX": URL_ES, "x-default": URL_ES },
  },
  openGraph: {
    type: "website",
    url: URL_EN,
    locale: "en_US",
    siteName: "HETNA CNC",
    title: "Quote CNC jobs in minutes, with your real costs",
    description: "Quoting app for router, laser, plasma and 3D printing shops. Branded PDF quotes, cost simulator, customers and follow-ups.",
  },
}

/** USD prices from the backend; if it doesn't answer, the backend defaults. */
async function preciosUsd(): Promise<PreciosUsd> {
  const base = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")
  try {
    const r = await fetch(`${base}/api/cotizador-suscripcion`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) })
    if (!r.ok) return PRECIOS_USD_DEFAULT
    const d = (await r.json()) as { planes?: Record<string, { usd?: number }>; paypal?: boolean }
    const usd = (k: keyof typeof PRECIOS_USD_DEFAULT) => {
      const v = Number(d.planes?.[k]?.usd)
      return Number.isFinite(v) && v > 0 ? v : (PRECIOS_USD_DEFAULT[k] as number)
    }
    return { taller: usd("taller"), pro: usd("pro"), industrial: usd("industrial"), paypal: d.paypal !== false }
  } catch {
    return PRECIOS_USD_DEFAULT
  }
}

export default async function CotizadorEnPage({ params }: Props) {
  const { locale } = await params
  if (locale !== "us") redirect(`/${locale}/servicios/cotizador-cnc`)
  const precios = await preciosUsd()

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "HETNA CNC",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android, iOS",
      url: URL_EN,
      inLanguage: "en-US",
      description: "Quoting and shop management app for CNC router, laser, plasma and 3D printing shops.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Shop", price: String(precios.taller), priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: String(precios.pro), priceCurrency: "USD" },
        { "@type": "Offer", name: "Industrial", price: String(precios.industrial), priceCurrency: "USD" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_EN.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <CotizadorLandingEn precios={precios} />
    </>
  )
}
