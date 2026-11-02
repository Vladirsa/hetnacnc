import type { Metadata } from "next"
import { IMAGEN_OG } from "@/lib/helpers/seo"
import { notFound } from "next/navigation"

import { BotonesServicio, TarjetaArticulo } from "@/components/hetna/foro/Blog"
import { LATERAL_FIJO } from "@/components/hetna/foro/Feed"
import { Migas } from "@/components/hetna/foro/Piezas"
import { VideoLigero } from "@/components/hetna/foro/VideoLigero"
import CompartirRedes from "@/components/hetna/Compartir"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { articuloBlog, urlArticulo } from "@/lib/foro/blog"
import { secciones } from "@/lib/foro/consultas"
import { leerVideo } from "@/lib/foro/contenido"
import { ctasPara, talleresDeSeccion } from "@/lib/foro/cta"
import { SITIO } from "@/lib/foro/tipos"

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const r = await articuloBlog(slug)
  if (!r) return { title: { absolute: "Artículo no encontrado | Foro CNC México" }, robots: { index: false } }
  const a = r.articulo
  const url = `${SITIO}/mx${urlArticulo(a.slug)}`
  return {
    title: { absolute: `${a.seo_title || a.title} | Blog Foro CNC` },
    description: a.seo_description || a.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: a.seo_title || a.title,
      description: a.seo_description || a.excerpt,
      url,
      type: "article",
      siteName: "HETNA CNC",
      locale: "es_MX",
      images: a.cover_image_url ? [{ url: a.cover_image_url }] : [IMAGEN_OG],
    },
  }
}

export default async function ArticuloBlog({ params }: Props) {
  const { slug } = await params
  const [r, secs] = await Promise.all([articuloBlog(slug), secciones()])
  if (!r) notFound()
  const { articulo: a, relacionados } = r
  const seccion = a.categoria ? secs?.find((s) => s.slug === a.categoria) : null
  const url = `${SITIO}/mx${urlArticulo(a.slug)}`
  const video = a.video_url ? leerVideo(a.video_url) : null
  // El artículo ya enlaza sus propias soluciones en el texto; aquí sólo la de fabricar.
  const ctas = a.categoria ? ctasPara(a.categoria, a.title).filter((c) => c.href.startsWith("/cotizar?servicio")) : []
  const talleres = a.categoria ? talleresDeSeccion(a.categoria) : null

  return (
    <main className="w-full bg-[#FAF9F6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.title,
            description: a.excerpt,
            image: a.cover_image_url ? [a.cover_image_url] : undefined,
            datePublished: a.published_at,
            dateModified: a.updated_at || a.published_at,
            author: a.autor ? { "@type": "Organization", name: a.autor } : { "@type": "Organization", name: "HETNA CNC" },
            publisher: { "@type": "Organization", name: "HETNA CNC" },
            mainEntityOfPage: url,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <div className="max-w-[1100px] mx-auto px-4 py-6 lg:py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8">
        <div className="min-w-0 flex flex-col gap-5">
          <Migas
            items={[
              { nombre: "Foro CNC", href: "/foro-cnc" },
              { nombre: "Blog", href: "/foro-cnc/blog" },
              ...(seccion ? [{ nombre: seccion.nombre, href: `/foro-cnc/blog?seccion=${seccion.slug}` }] : []),
            ]}
          />
          <article className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-8 flex flex-col gap-4">
            <p className="m-0 text-[12px] font-bold uppercase tracking-wide">
              <span className={a.guia ? "text-[#16794F]" : "text-[#C2560A]"}>{a.guia ? "Guía" : "Artículo"}</span>
              <span className="text-[#9A978C] font-medium normal-case tracking-normal">
                {" "}· {a.autor || "HETNA CNC"} · {new Date(a.published_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </p>
            <h1 className="m-0 font-display text-[26px] sm:text-[34px] leading-[1.2] font-bold text-[#1B1B18]">{a.title}</h1>
            <p className="m-0 text-[16px] text-[#55544D] leading-relaxed">{a.excerpt}</p>
            {video && <VideoLigero video={video} />}
            <div
              className="prose-blog text-[15.5px] leading-[1.75] text-[#1B1B18]"
              dangerouslySetInnerHTML={{ __html: a.content_html }}
            />
            <CompartirRedes url={url} titulo={a.title} />
          </article>

          <BotonesServicio ctas={ctas} titulo="¿Prefieres que te lo fabriquen?" />

          <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <span>
              <span className="block font-bold text-[#1B1B18]">¿Te quedó una duda?</span>
              <span className="text-[14px] text-[#55544D]">
                Pregúntala en el foro{seccion ? ` de ${seccion.nombre}` : ""}: talleres y makers de México te ayudan.
              </span>
            </span>
            <LocalizedClientLink
              href={seccion ? `/foro-cnc/nuevo?seccion=${seccion.slug}` : "/foro-cnc/nuevo"}
              className="shrink-0 rounded-[10px] bg-[#C2560A] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#A84A08]"
            >
              Hacer una pregunta
            </LocalizedClientLink>
          </section>
        </div>

        <aside className={`flex flex-col gap-4 ${LATERAL_FIJO}`}>
          {talleres && (
            <LocalizedClientLink href={talleres.href} className="bg-[#142033] text-white rounded-[14px] p-4 flex flex-col gap-1 hover:bg-[#1B2A42]">
              <strong className="text-[14.5px]">Talleres de {talleres.proceso}</strong>
              <span className="text-[13px] text-[#C9D2E0]">Ve quién hace esto cerca de ti y pídele cotización.</span>
            </LocalizedClientLink>
          )}
          {relacionados.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[12px] font-bold uppercase tracking-wide text-[#9A978C]">Sigue leyendo</span>
              {relacionados.map((x) => (
                <TarjetaArticulo key={x.id} a={x} compacta />
              ))}
            </div>
          )}
          {seccion && (
            <LocalizedClientLink href={`/foro-cnc/${seccion.slug}`} className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 hover:border-[#C2560A]">
              <strong className="block text-[14px] text-[#1B1B18]">Preguntas de {seccion.nombre}</strong>
              <span className="text-[13px] text-[#6B6A63]">Lo que la comunidad está resolviendo ahora.</span>
            </LocalizedClientLink>
          )}
        </aside>
      </div>
    </main>
  )
}
