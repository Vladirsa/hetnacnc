import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { BotonImprimir } from "@/components/hetna/academia/BotonImprimir"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { getCertificadoCurso } from "@/lib/data/courses"

// Certificado de la Academia HETNA: sólo para el alumno que vio todas las
// lecciones. Se imprime o se guarda en PDF desde el navegador.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Certificado — Academia HETNA",
  robots: { index: false, follow: false },
}

const NIVEL: Record<string, string> = { principiante: "Principiante", intermedio: "Intermedio", avanzado: "Avanzado" }

export default async function Certificado({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const c = await getCertificadoCurso(slug)
  if (!c) redirect(`/${locale}/aprendizaje-cnc/cursos/${slug}#temario`)

  const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" }).format(
    new Date(c.fecha)
  )

  return (
    <main className="min-h-[80vh] bg-[#F3F1EA] px-4 py-8 print:bg-white print:p-0">
      <style>{`@page{size:landscape;margin:0}@media print{header,footer,nav,.no-imprimir{display:none!important}}`}</style>
      <div className="no-imprimir mx-auto mb-4 flex max-w-[1000px] flex-wrap items-center justify-between gap-3">
        <LocalizedClientLink href={`/aprendizaje-cnc/cursos/${slug}`} className="text-[14px] font-semibold text-[#6B6A63] hover:text-[#B34D07]">
          ← Volver al curso
        </LocalizedClientLink>
        <div className="flex flex-wrap items-center gap-3">
          <LocalizedClientLink
            href="/foro-cnc/mi-perfil#curriculum"
            className="rounded-[10px] border border-[#1F7A4D] bg-white px-4 py-2 text-[14px] font-semibold text-[#1F7A4D] hover:bg-[#EAF6EF]"
          >
            🎓 Agregar a mi perfil profesional
          </LocalizedClientLink>
          <BotonImprimir />
        </div>
      </div>

      <article className="relative mx-auto aspect-[1.414] w-full max-w-[1000px] overflow-hidden bg-white shadow-[0_20px_60px_-20px_rgba(20,32,51,0.4)] print:shadow-none">
        <div className="absolute inset-4 border-[3px] border-[#142033] sm:inset-6" />
        <div className="absolute inset-6 border border-[#C2560A] sm:inset-9" />
        <div className="relative flex h-full flex-col items-center justify-center px-10 text-center sm:px-20">
          <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.3em] text-[#C2560A] sm:text-[14px]">Academia HETNA CNC</p>
          <h1 className="m-0 mt-2 font-display text-[28px] font-extrabold text-[#142033] sm:text-[46px]">Certificado de terminación</h1>
          <p className="m-0 mt-4 text-[13px] text-[#6B6A63] sm:mt-6 sm:text-[16px]">Se otorga a</p>
          <p className="m-0 mt-1 border-b-2 border-[#E7E4DC] px-6 pb-1 font-display text-[26px] font-bold text-[#1B1B18] sm:text-[40px]">{c.alumno}</p>
          <p className="m-0 mt-4 max-w-[640px] text-[13px] leading-relaxed text-[#4A4943] sm:mt-6 sm:text-[17px]">
            por completar las {c.lecciones} lecciones del curso
          </p>
          <p className="m-0 mt-1 text-[18px] font-bold text-[#142033] sm:text-[26px]">«{c.curso}»</p>
          <p className="m-0 mt-1 text-[12px] text-[#6B6A63] sm:text-[15px]">
            {NIVEL[c.nivel] ? `Nivel ${NIVEL[c.nivel]} · ` : ""}Impartido por {c.taller}
          </p>
          <div className="mt-6 grid w-full max-w-[640px] grid-cols-2 gap-6 text-[11px] text-[#6B6A63] sm:mt-10 sm:text-[13px]">
            <div className="border-t border-[#9A978C] pt-2">
              <p className="m-0 font-semibold text-[#1B1B18]">{fecha}</p>
              <p className="m-0">Fecha de terminación</p>
            </div>
            <div className="border-t border-[#9A978C] pt-2">
              <p className="m-0 font-semibold text-[#1B1B18]">Folio {c.folio}</p>
              <p className="m-0">hetnacnc.com/academia</p>
            </div>
          </div>
        </div>
      </article>
    </main>
  )
}
