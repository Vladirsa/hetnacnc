// Pasa por ImagenSegura: estas direcciones vienen de la base o del
// navegador, y next/image TRUENA con las que no empiezan en "/" o
// "https://" (una vista previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { AccionCurso } from "@/components/hetna/academia/AccionCurso"
import { Temario } from "@/components/hetna/academia/Temario"
import { NIVEL, duracionTexto, precioTexto } from "@/components/hetna/academia/formato"
import { getAccesoCurso, getCourseBySlug } from "@/lib/data/courses"

type Props = {
  params: Promise<{ locale: string; slug: string }>
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
  const [curso, acceso] = await Promise.all([getCourseBySlug(slug), getAccesoCurso(slug)])
  if (!curso) notFound()

  const secciones = curso.sections || []
  const totalLecciones = curso.lecciones ?? secciones.reduce((acc, sec) => acc + sec.lessons.length, 0)
  const gratis = !curso.precio || curso.precio.gratis
  const duracion = duracionTexto(curso.duracion_segundos)

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/aprendizaje-cnc" className="hover:text-[#B34D07]">
          Academia CNC
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">{curso.title}</span>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-6 lg:py-10 grid gap-8 lg:grid-cols-[1fr_340px] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide bg-[#FDEEE1] text-[#C2560A] px-3 py-1 rounded-full">
                {NIVEL[curso.level] || curso.level}
              </span>
              {gratis && (
                <span className="text-[12px] font-bold uppercase tracking-wide bg-[#1F7A4D] text-white px-3 py-1 rounded-full">
                  Gratis
                </span>
              )}
            </div>
            <h1 className="font-display text-[28px] lg:text-[38px] leading-tight font-bold m-0 text-[#1B1B18]">{curso.title}</h1>
            {curso.description && (
              <p className="m-0 text-[16px] text-[#6B6A63] leading-relaxed whitespace-pre-line">{curso.description}</p>
            )}
            <p className="m-0 text-[13.5px] text-[#6B6A63]">
              {[
                curso.taller?.nombre ? `Por ${curso.taller.nombre}` : null,
                totalLecciones ? `${totalLecciones} lecciones` : null,
                duracion,
                (curso.alumnos ?? 0) > 0 ? `${curso.alumnos} ${curso.alumnos === 1 ? "alumno" : "alumnos"}` : null,
                "En español",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {secciones.length > 0 ? (
            <Temario secciones={secciones} acceso={acceso} />
          ) : (
            <p className="m-0 text-[14.5px] text-[#6B6A63]">El taller está preparando el temario.</p>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 bg-white border border-[#E7E4DC] rounded-[16px] overflow-hidden shadow-[0_8px_24px_rgba(27,27,24,0.06)]">
          {curso.thumbnail_url && (
            <Image src={curso.thumbnail_url} alt={curso.title} className="w-full aspect-video object-cover" width={480} height={270} />
          )}
          <div className="p-5 flex flex-col gap-4">
            <span className={`text-[28px] font-bold ${gratis ? "text-[#1F7A4D]" : "text-[#1B1B18]"}`}>{precioTexto(curso)}</span>
            <AccionCurso
              slug={curso.slug}
              gratis={gratis}
              precio={precioTexto(curso)}
              productHandle={curso.product?.handle ?? null}
              inscrito={!!acceso?.inscrito}
            />
            <ul className="m-0 p-0 list-none flex flex-col gap-2 text-[13.5px] text-[#1B1B18]">
              <li>✓ Acceso sin fecha de vencimiento</li>
              <li>✓ En el celular o la computadora</li>
              {(curso.vistas_previas ?? 0) > 0 && !gratis && <li>✓ {curso.vistas_previas} lecciones de muestra gratis</li>}
              {!gratis && <li>✓ Pago seguro con Mercado Pago, tarjeta o PayPal</li>}
            </ul>
            {curso.taller?.handle && (
              <LocalizedClientLink href={`/sellers/${curso.taller.handle}`} className="text-[13.5px] font-semibold text-[#B34D07] hover:underline">
                Conoce el taller {curso.taller.nombre}
              </LocalizedClientLink>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
