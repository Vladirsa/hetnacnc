// Textos propios de una categoría (lib/hetna/contenido-categorias.ts).
// IntroCategoria va arriba de los productos; GuiaCategoria, abajo.
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { ContenidoCategoria } from "@/lib/hetna/contenido-categorias"

import { JsonLd } from "./JsonLd"

export function IntroCategoria({ c }: { c: ContenidoCategoria }) {
  return <p className="mt-2 mb-4 max-w-[820px] text-[15px] leading-relaxed text-[#4A4943]">{c.intro}</p>
}

export function GuiaCategoria({ c, nombre }: { c: ContenidoCategoria; nombre: string }) {
  const faq = c.faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.pregunta,
          acceptedAnswer: { "@type": "Answer", text: f.respuesta },
        })),
      }
    : null

  return (
    <section className="mt-12 border-t border-[#E7E4DC] pt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      {faq && <JsonLd datos={faq} id="ld-faq-categoria" />}
      <div className="flex flex-col gap-6 max-w-[760px]">
        <h2 className="font-display text-[22px] font-bold text-[#1B1B18] m-0">Guía para elegir {nombre.toLowerCase()}</h2>
        {c.secciones.map((s) => (
          <div key={s.titulo} className="flex flex-col gap-2">
            <h3 className="m-0 text-[17px] font-bold text-[#1B1B18]">{s.titulo}</h3>
            {s.parrafos?.map((p, i) => (
              <p key={i} className="m-0 text-[15px] leading-relaxed text-[#4A4943]">
                {p}
              </p>
            ))}
            {s.lista && (
              <ul className="m-0 pl-5 list-disc flex flex-col gap-1 text-[15px] leading-relaxed text-[#4A4943]">
                {s.lista.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {c.faqs.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[20px] font-bold text-[#1B1B18] m-0">Preguntas frecuentes</h2>
            {c.faqs.map((f) => (
              <details key={f.pregunta} className="group bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3">
                <summary className="cursor-pointer list-none flex justify-between gap-3 text-[14.5px] font-semibold text-[#1B1B18]">
                  {f.pregunta}
                  <span aria-hidden="true" className="text-[#C2560A] group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-2 mb-0 text-[14px] leading-relaxed text-[#4A4943]">{f.respuesta}</p>
              </details>
            ))}
          </div>
        )}
        {c.enlaces && c.enlaces.length > 0 && (
          <div className="bg-[#FDEEE1] rounded-[14px] p-5 flex flex-col gap-2">
            <h2 className="m-0 text-[16px] font-bold text-[#1B1B18]">También te puede servir</h2>
            {c.enlaces.map((e) => (
              <LocalizedClientLink key={e.href} href={e.href} className="text-[14.5px] font-semibold text-[#B34D07] hover:underline">
                {e.texto} →
              </LocalizedClientLink>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
