// Pasa por ImagenSegura: estas direcciones vienen de la base o del
// navegador, y next/image TRUENA con las que no empiezan en "/" o
// "https://" (una vista previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { headers } from "next/headers"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { getLearningArticleBySlug } from "@/lib/data/learning-articles"

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getLearningArticleBySlug(slug)
  if (!article) return {}

  return {
    title: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    openGraph: {
      title: article.seo_title || article.title,
      description: article.seo_description || article.excerpt,
      images: article.cover_image_url ? [{ url: article.cover_image_url }] : undefined,
      type: "article",
    },
  }
}

export default async function AprendizajeArticulo({ params }: Props) {
  const { locale, slug } = await params
  const article = await getLearningArticleBySlug(slug)
  if (!article) notFound()

  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
  const articleUrl = `${baseUrl}/${locale}/aprendizaje-cnc/${article.slug}`

  return (
    <main className="w-full bg-[#FAF9F6]">
      {/* <script> plano (no next/script): necesario en el HTML inicial para
          crawlers que no esperan a la hidratación. */}
      <script
        id="ld-learning-article"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.excerpt,
            image: article.cover_image_url ? [article.cover_image_url] : undefined,
            datePublished: article.published_at,
            author: { "@type": "Organization", name: "HETNA CNC" },
            publisher: { "@type": "Organization", name: "HETNA CNC" },
            mainEntityOfPage: articleUrl,
          }).replace(/</g, "\\u003c"),
        }}
      />

      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/aprendizaje-cnc" className="hover:text-[#B34D07]">
          Aprendizaje CNC
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">{article.title}</span>
      </div>

      <article className="max-w-[760px] mx-auto px-4 lg:px-0 py-6 lg:py-10 flex flex-col gap-5">
        {article.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <Image             src={article.cover_image_url}
            alt={article.title}
            className="w-full rounded-[16px] object-cover aspect-[16/9]"
          width={300} height={300} />
        )}
        <h1 className="font-display text-[28px] lg:text-[36px] font-bold m-0 text-[#1B1B18]">
          {article.title}
        </h1>
        <p className="m-0 text-[16px] text-[#6B6A63] leading-relaxed">{article.excerpt}</p>

        {article.video_url && (
          <div className="aspect-video w-full rounded-[16px] overflow-hidden bg-black">
            <iframe
              src={article.video_url}
              title={article.title}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        )}

        <div
          className="prose max-w-none text-[#1B1B18] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: article.content_html }}
        />

        {article.external_links && article.external_links.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-[#E7E4DC] pt-5">
            <h2 className="font-display text-[18px] font-bold m-0 text-[#1B1B18]">
              Para profundizar
            </h2>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {article.external_links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14.5px] font-semibold text-[#B34D07] hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </main>
  )
}
