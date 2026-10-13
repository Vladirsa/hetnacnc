import type { ReactNode } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, ligaWhatsApp } from "@/lib/hetna/empresa"

const REJILLA =
  "repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 28px)"

// Plantilla de páginas informativas y legales con el estilo HETNA.
export default function PaginaInfo({
  etiqueta,
  titulo,
  resumen,
  actualizado,
  children,
  jsonLd,
}: {
  etiqueta: string
  titulo: string
  resumen?: string
  actualizado?: boolean
  children: ReactNode
  jsonLd?: Record<string, unknown>
}) {
  return (
    <main className="w-full bg-[#FAF9F6]">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <div className="mx-auto w-full max-w-[920px] px-4 py-8 lg:px-6">
        <div className="mb-4 flex flex-wrap gap-1.5 text-[13px] text-[#6B6A63]">
          <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
          <span>/</span>
          <span className="font-medium text-[#1B1B18]">{titulo}</span>
        </div>

        <header className="overflow-hidden rounded-3xl bg-[#142033] p-7 text-white sm:p-10" style={{ backgroundImage: REJILLA }}>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">{etiqueta}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">{titulo}</h1>
          {resumen && <p className="mt-3 max-w-2xl text-white/75">{resumen}</p>}
          {actualizado && <p className="mt-4 text-xs text-white/50">Última actualización: {EMPRESA.actualizado}</p>}
        </header>

        <article className="info-hetna mt-6 rounded-2xl border border-[#E7E4DC] bg-white p-6 text-[15px] leading-relaxed text-[#40403A] sm:p-9 [&_a]:font-semibold [&_a]:text-[#B34D07] [&_a:hover]:underline [&_h2]:mb-2 [&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-[#142033] [&_h2:first-child]:mt-0 [&_li]:mb-1.5 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </article>

        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E7E4DC] bg-white p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-[#142033]">¿Tienes otra duda?</p>
            <p className="text-sm text-[#6B675C]">{EMPRESA.horario}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={ligaWhatsApp("Hola HETNA CNC, tengo una duda")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#C2560A] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Escríbenos por WhatsApp
            </a>
            <LocalizedClientLink
              href="/contacto"
              className="rounded-xl border border-[#142033] px-5 py-2.5 text-sm font-semibold text-[#142033] hover:bg-[#142033] hover:text-white"
            >
              Contacto
            </LocalizedClientLink>
          </div>
        </section>
      </div>
    </main>
  )
}
