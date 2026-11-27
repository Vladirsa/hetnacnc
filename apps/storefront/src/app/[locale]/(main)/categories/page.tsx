// /categories: todo el catálogo con pestañas (Todo · Productos · Diseños ·
// A tu medida · Talleres) y filtros con conteo (opción C que eligió Vlado,
// 23 nov 2026). Datos y filtros: lib/hetna/explorar.ts.
//
// SEO: sólo la pestaña sola (y su paginación) se indexa, cada una con su
// título y descripción; una combinación de filtros es "noindex, follow" con
// canónica a su pestaña, para que Google no la tome como página repetida.
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import { categoriasSugeridas } from "@/lib/hetna/catalogo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import AnunciosEspacio from "@/components/hetna/publicidad/AnunciosEspacio"
import { Breadcrumbs } from "@/components/atoms/Breadcrumbs/Breadcrumbs"
import { Explorar } from "@/components/hetna/explorar/Explorar"
import { paramsDe } from "@/lib/helpers/busqueda-listado"
import { IMAGEN_OG } from "@/lib/helpers/seo"
import { SITIO_CANONICO, buildHreflangAlternates } from "@/lib/helpers/hreflang"
import { PESTANAS, esIndexable, explorar, leerPestana } from "@/lib/hetna/explorar"
import { estadosParaEnlaces } from "@/lib/seo/estados"

export const revalidate = 60

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function generateMetadataEs({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params
  const sp = paramsDe(await searchParams)
  const pestana = leerPestana(sp.get("tipo"))
  const info = PESTANAS.find((p) => p.id === pestana)!
  const pagina = Math.max(1, Number(sp.get("page")) || 1)

  const qs = new URLSearchParams()
  if (pestana !== "todo") qs.set("tipo", pestana)
  const indexable = esIndexable(sp)
  if (indexable && pagina > 1) qs.set("page", String(pagina))
  const sufijo = qs.toString() ? `?${qs}` : ""
  const { canonical, languages } = buildHreflangAlternates({ path: `/categories${sufijo}`, locale })

  const titulo = pagina > 1 && indexable ? `${info.titulo} (página ${pagina})` : info.titulo
  return {
    title: titulo,
    description: info.descripcion,
    alternates: { canonical, languages },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${titulo} | HETNA CNC`,
      description: info.descripcion,
      url: canonical,
      siteName: "HETNA CNC",
      type: "website",
      images: [IMAGEN_OG],
    },
  }
}

export default async function TodosLosProductos({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = paramsDe(await searchParams)
  const [r, sugerencias, estados] = await Promise.all([
    explorar(locale, sp),
    categoriasSugeridas(),
    // Sólo en la pestaña Talleres: enlaces a "Talleres CNC en <estado>"
    leerPestana(sp.get("tipo")) === "talleres"
      ? estadosParaEnlaces().catch(() => [])
      : Promise.resolve([]),
  ])
  const info = PESTANAS.find((p) => p.id === r.pestana)!
  const url = `${SITIO_CANONICO}/mx/categories${r.pestana === "todo" ? "" : `?tipo=${r.pestana}`}`

  const lista =
    r.pestana === "talleres"
      ? r.talleres.slice(0, 12).map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITIO_CANONICO}/mx/talleres/${t.handle}`, name: t.nombre }))
      : r.productos.slice(0, 12).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITIO_CANONICO}/mx/products/${p.handle}`, name: p.title }))

  const migas = [
    { path: "/categories", label: "Todos los productos" },
    ...(r.pestana === "todo" ? [] : [{ path: `/categories?tipo=${r.pestana}`, label: info.nombre }]),
  ]

  return (
    <main className="container">
      {/* <script> plano: en el HTML inicial para buscadores que no esperan a la hidratación */}
      <script
        id="ld-explorar"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: migas.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.label, item: `${SITIO_CANONICO}/mx${m.path}` })),
            },
            { "@context": "https://schema.org", "@type": "ItemList", name: info.h1, url, itemListElement: lista },
          ]).replace(/</g, "<"),
        }}
      />
      <div className="mb-2 hidden md:block">
        <Breadcrumbs items={migas} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[26px] font-black leading-tight tracking-tight text-[#142033] sm:text-[32px]"><TS>{info.h1}</TS></h1>
        <LocalizedClientLink href="/tienda" className="mb-1 text-[14px] font-bold text-[#B34D07] hover:underline">
          <TS>Ver la tienda por categorías →</TS>
        </LocalizedClientLink>
      </div>

      <AnunciosEspacio espacio="listado_productos" className="my-4" />

      <Explorar r={r} sp={sp} locale={locale} sugerencias={sugerencias} estados={estados} />
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
