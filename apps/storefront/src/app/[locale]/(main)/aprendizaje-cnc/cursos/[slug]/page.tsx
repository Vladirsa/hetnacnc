import Image from 'next/image'
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { getCourseBySlug } from "@/lib/data/courses"

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

const NIVEL_ETIQUETA: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
}

const formatearDuracion = (segundos: number | null) => {
  if (!segundos) return null
  const minutos = Math.round(segundos / 60)
  return `${minutos} min`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const curso = await getCourseBySlug(slug)
  if (!curso) return {}

  return {
    title: curso.title,
    description: curso.description || undefined,
    openGraph: {
      title: curso.title,
      description: curso.description || undefined,
      images: curso.thumbnail_url ? [{ url: curso.thumbnail_url }] : undefined,
      type: "website",
    },
  }
}

export default async function CursoDetalle({ params }: Props) {
  const { slug } = await params
  const curso = await getCourseBySlug(slug)
  if (!curso) notFound()

  const totalLecciones = (curso.sections || []).reduce((acc, sec) => acc + sec.lessons.length, 0)

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/aprendizaje-cnc" className="hover:text-[#B34D07]">
          Aprendizaje CNC
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">{curso.title}</span>
      </div>

      <div className="max-w-[900px] mx-auto px-4 lg:px-0 py-6 lg:py-10 flex flex-col gap-6">
        {curso.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <Image             src={curso.thumbnail_url}
            alt={curso.title}
            className="w-full rounded-[16px] object-cover aspect-video"
          width={300} height={300} />
        )}

        <div className="flex flex-col gap-3">
          <span className="self-start text-[12px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#C2560A] px-3 py-1 rounded-full">
            {NIVEL_ETIQUETA[curso.level] || curso.level}
          </span>
          <h1 className="font-display text-[28px] lg:text-[36px] font-bold m-0 text-[#1B1B18]">
            {curso.title}
          </h1>
          {curso.description && (
            <p className="m-0 text-[16px] text-[#6B6A63] leading-relaxed max-w-[680px]">
              {curso.description}
            </p>
          )}
          {totalLecciones > 0 && (
            <p className="m-0 text-[13.5px] text-[#9A978C]">
              {curso.sections?.length || 0} módulos · {totalLecciones} lecciones
            </p>
          )}

          {curso.product?.handle && (
            <LocalizedClientLink
              href={`/products/${curso.product.handle}`}
              className="self-start mt-1 inline-flex items-center gap-2 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[14.5px]"
            >
              Inscribirme al curso
            </LocalizedClientLink>
          )}
        </div>

        {curso.sections && curso.sections.length > 0 && (
          <section className="flex flex-col gap-4 border-t border-[#E7E4DC] pt-6">
            <h2 className="font-display text-[20px] font-bold m-0 text-[#1B1B18]">
              Contenido del curso
            </h2>
            <div className="flex flex-col gap-3">
              {curso.sections.map((seccion, i) => (
                <div key={seccion.id} className="bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden">
                  <div className="px-4 py-3 bg-[#FAF9F6] border-b border-[#E7E4DC]">
                    <h3 className="m-0 text-[14.5px] font-bold text-[#1B1B18]">
                      {i + 1}. {seccion.title}
                    </h3>
                  </div>
                  <ul className="m-0 p-0 list-none">
                    {seccion.lessons.map((leccion) => (
                      <li
                        key={leccion.id}
                        className="px-4 py-3 border-b border-[#F0EEE7] last:border-b-0 flex items-center justify-between gap-3 text-[13.5px] text-[#1B1B18]"
                      >
                        <span>{leccion.title}</span>
                        <span className="flex items-center gap-2 shrink-0 text-[#9A978C]">
                          {leccion.is_preview && (
                            <span className="text-[11px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#C2560A] px-2 py-0.5 rounded-full">
                              Vista previa
                            </span>
                          )}
                          {formatearDuracion(leccion.duration_seconds)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
