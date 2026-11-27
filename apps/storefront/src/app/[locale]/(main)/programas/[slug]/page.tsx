import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PROGRAMAS, programaDe } from "@/lib/seo/programas"

// Página para buscadores de una herramienta de diseño o CAM: qué hace, cómo se
// usa, qué incluye, cuánto cuesta y preguntas frecuentes (con datos
// estructurados), y el botón que lleva a la herramienta.
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; slug: string }> }

// Se arma en cada visita, como el resto de la tienda: el layout lee cabeceras y
// cookies (idioma, sesión), y como página estática daba DYNAMIC_SERVER_USAGE (500).
export const dynamic = "force-dynamic"

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const p = programaDe(slug)
  if (!p) return {}
  const url = `${SITIO}/mx/programas/${p.slug}`
  return {
    title: p.titulo,
    description: p.meta,
    keywords: p.palabras,
    alternates: { canonical: url, languages: { "es-MX": url } },
    openGraph: { type: "website", locale: "es_MX", siteName: "HETNA CNC", title: p.titulo, description: p.meta, url, images: [{ url: "/og-hetna.png", width: 1200, height: 630, alt: "HETNA CNC" }] },
    twitter: { card: "summary_large_image", title: p.titulo, description: p.meta, images: ["/og-hetna.png"] },
  }
}

export default async function PaginaPrograma({ params }: Props) {
  const { slug } = await params
  const p = programaDe(slug)
  if (!p) notFound()
  const url = `${SITIO}/mx/programas/${p.slug}`
  const datos = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: p.herramienta.nombre,
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      url: `${SITIO}/mx${p.herramienta.href}`,
      description: p.meta,
      offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
      publisher: { "@type": "Organization", name: "HETNA CNC", url: SITIO },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.preguntas.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITIO}/mx` },
        { "@type": "ListItem", position: 2, name: "Herramientas", item: `${SITIO}/mx/herramientas-cnc` },
        { "@type": "ListItem", position: 3, name: p.herramienta.nombre, item: url },
      ],
    },
  ]
  const otras = PROGRAMAS.filter((x) => x.slug !== p.slug)
  return (
    <main className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, "\\u003c") }} />
      <section className="container py-10 md:py-14">
        <nav className="flex flex-wrap gap-1.5 text-[13px] text-[#6B6A63]" aria-label="Migas">
          <LocalizedClientLink href="/" className="hover:text-[#B34D07]"><TS>Inicio</TS></LocalizedClientLink>
          <span>/</span>
          <LocalizedClientLink href="/herramientas-cnc" className="hover:text-[#B34D07]"><TS>Herramientas</TS></LocalizedClientLink>
          <span>/</span>
          <span className="font-medium text-[#1B1B18]">{p.herramienta.nombre}</span>
        </nav>
        <h1 className="mt-4 max-w-[900px] text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-[#0E2A5C] md:text-[46px]"><TS>{p.titulo}</TS></h1>
        <p className="mt-4 max-w-[760px] text-[17px] leading-relaxed text-[#40403A]"><TS>{p.intro}</TS></p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <LocalizedClientLink href={p.herramienta.href} className="rounded-[12px] bg-[#C2560A] px-7 py-4 text-[17px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(217,96,11,0.9)] hover:bg-[#A84A08]">
            <TS>{p.herramienta.boton}</TS>
          </LocalizedClientLink>
          <span className="text-[14px] text-[#6B6A63]"><TS>Gratis en el navegador, sin instalar nada.</TS></span>
        </div>
      </section>

      <section className="border-y border-[#EEEAE2] bg-[#FAF8F4]">
        <div className="container grid gap-5 py-10 md:grid-cols-3">
          {p.pasos.map((s, i) => (
            <div key={s.t} className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
              <span className="text-[13px] font-bold text-[#C2560A]"><TS>Paso</TS> {i + 1}</span>
              <h2 className="mt-1 text-[19px] font-bold text-[#1B1B18]">{s.t}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container grid gap-10 py-12 md:grid-cols-2">
        <div>
          <h2 className="text-[24px] font-bold text-[#0E2A5C]"><TS>Qué incluye</TS></h2>
          <ul className="mt-4 flex flex-col gap-2.5 p-0">
            {p.incluye.map((x) => (
              <li key={x} className="flex list-none gap-2.5 text-[16px] leading-relaxed text-[#40403A]">
                <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-[#C2560A]" aria-hidden="true" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[24px] font-bold text-[#0E2A5C]"><TS>Cuánto cuesta</TS></h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[#40403A]">{p.precio}</p>
          <LocalizedClientLink href="/user/creditos" className="mt-3 inline-block text-[15px] font-semibold text-[#B34D07] underline"><TS>Ver paquetes de créditos</TS></LocalizedClientLink>
        </div>
      </section>

      <section className="container pb-12">
        <h2 className="text-[24px] font-bold text-[#0E2A5C]"><TS>Preguntas frecuentes</TS></h2>
        <div className="mt-4 flex flex-col gap-3">
          {p.preguntas.map((q) => (
            <details key={q.p} className="rounded-[12px] border border-[#E7E4DC] bg-white px-5 py-4">
              <summary className="cursor-pointer text-[17px] font-semibold text-[#1B1B18]">{q.p}</summary>
              <p className="mt-2 text-[15.5px] leading-relaxed text-[#4A4943]">{q.r}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 rounded-[16px] bg-[#0E2A5C] p-6 text-white md:flex md:items-center md:justify-between">
          <div>
            <p className="m-0 text-[22px] font-bold"><TS>Pruébalo ahora, es gratis</TS></p>
            <p className="m-0 mt-1 text-[15px] text-[#C9D2E0]"><TS>¿No tienes máquina? Un taller de HETNA te lo fabrica.</TS></p>
          </div>
          <LocalizedClientLink href={p.herramienta.href} className="mt-4 inline-block rounded-[12px] bg-[#C2560A] px-6 py-3.5 text-[16px] font-bold text-white hover:bg-[#A84A08] md:mt-0">
            <TS>{p.herramienta.boton}</TS>
          </LocalizedClientLink>
        </div>
      </section>

      <section className="container pb-14">
        <h2 className="text-[19px] font-bold text-[#1B1B18]"><TS>Otras herramientas</TS></h2>
        <ul className="mt-3 grid gap-2 p-0 sm:grid-cols-2">
          {otras.map((x) => (
            <li key={x.slug} className="list-none">
              <LocalizedClientLink href={`/programas/${x.slug}`} className="text-[15px] font-semibold text-[#B34D07] hover:underline">
                <TS>{x.titulo}</TS>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
