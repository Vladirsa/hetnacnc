import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"
import { ACCESO, GRUPOS_HERRAMIENTAS } from "@/lib/hetna/herramientas"

// Todas las herramientas CNC de HETNA en una sola página: diseñar y escanear
// (espacio de trabajo /disenar), programar (Laboratorio CAM), cotizar y aprender. Sustituye a /cam y a
// /servicios/generador-2d-3d, que redirigen aquí (next.config).
//
// Se llama "Herramientas CNC gratis en línea" y no solo "Herramientas CNC"
// porque esa búsqueda la hace quien quiere comprar fresas y cortadores; el
// "gratis en línea" deja claro que aquí son programas.

const SITIO = "https://hetnacnc.com"

// Esta página sólo enseña el cotizador y las calculadoras. Diseñar vive en
// /disenar (3D Studio y 2D Studio), el CAM en /laboratorio-cam y la academia
// en su propia sección; aquí sólo se enlazan al final.
const GRUPO = GRUPOS_HERRAMIENTAS.find((g) => g.id === "cotizar")!
const GRUPOS = [GRUPO]

export const metadata: Metadata = {
  title: "Cotizador CNC y calculadoras gratis: precio de corte láser, router, plasma e impresión 3D",
  description:
    "Calcula al momento el precio de tu pieza en router CNC, corte láser, plasma o impresión 3D, y las RPM, avance y pasadas para tu máquina. Gratis y sin instalar nada.",
  alternates: {
    canonical: `${SITIO}/mx/herramientas-cnc`,
    languages: { "es-MX": `${SITIO}/mx/herramientas-cnc`, "en-US": `${SITIO}/us/herramientas-cnc` },
  },
}

const PREGUNTAS = [
  {
    p: "¿Cuánto cuesta cortar una pieza en láser o router CNC?",
    r: "Depende del material, el espesor, los minutos de máquina y el diseño. En las calculadoras de precio pones esos datos y ves el costo al momento; si quieres precios reales de talleres, sube tu archivo a Cotizar.",
  },
  {
    p: "¿Las calculadoras son gratis?",
    r: "Sí. Las calculadoras de precio y la calculadora CNC profesional se usan gratis y sin cuenta. La App HETNA CNC para talleres, que cotiza con tus propios costos y cobra en línea, tiene planes.",
  },
  {
    p: "¿Cómo calculo las RPM y el avance de mi fresa?",
    r: "En la calculadora CNC profesional eliges la máquina, el material y la fresa, y te da RPM, avance, profundidad de pasada y paso lateral. Para láser y plasma te da potencia y velocidad.",
  },
]

export default function HerramientasCnc() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Cotizador y calculadoras CNC",
        url: `${SITIO}/mx/herramientas-cnc`,
        inLanguage: "es-MX",
        isPartOf: { "@type": "WebSite", name: "HETNA CNC", url: SITIO },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: GRUPO.herramientas.length,
          itemListElement: GRUPO.herramientas.map((h, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: h.nombre,
            url: `${SITIO}/mx${h.href}`,
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: PREGUNTAS.map((q) => ({
          "@type": "Question",
          name: q.p,
          acceptedAnswer: { "@type": "Answer", text: q.r },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITIO}/mx` },
          { "@type": "ListItem", position: 2, name: "Cotizador y calculadoras CNC", item: `${SITIO}/mx/herramientas-cnc` },
        ],
      },
    ],
  }

  return (
    <main className="w-full bg-[#FAF9F6] min-h-[70vh]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="px-4 lg:px-16 pt-6 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">
          Inicio
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Cotizador y calculadoras</span>
      </div>

      <section className="px-4 lg:px-16 pt-6 pb-4 max-w-[1280px]">
        <h1 className="text-[30px] lg:text-[42px] font-bold text-[#1B1B18] leading-[1.1] max-w-[820px]">
          Cotizador y calculadoras CNC
        </h1>
        <p className="mt-3 text-[16px] text-[#4A4943] leading-relaxed max-w-[720px]">
          Saca el precio de tu pieza en router CNC, corte láser, plasma o impresión 3D, y calcula RPM, avance y pasadas para tu
          máquina. Gratis y sin instalar nada.
        </p>
      </section>

      {GRUPOS.map((g) => (
        <section key={g.id} id={g.id} className="scroll-mt-36 px-4 lg:px-16 pt-10 max-w-[1280px]">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FDEEE1] text-[#B34D07]">
              <ServicioIcono nombre={g.icono} size={22} />
            </span>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#B34D07]">{g.pregunta}</p>
              <h2 className="text-[22px] lg:text-[26px] font-bold text-[#1B1B18] leading-tight">{g.titulo}</h2>
              <p className="mt-1 text-[14.5px] text-[#4A4943] leading-relaxed max-w-[720px]">{g.texto}</p>
              {!!g.puntos?.length && (
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                  {g.puntos.map((pt) => (
                    <li key={pt} className="rounded-full bg-[#FDEEE1] px-3 py-1 text-[12.5px] font-semibold text-[#8A3D06]">
                      {pt}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {g.accion && (
                  <LocalizedClientLink
                    href={g.accion.href}
                    className="inline-flex items-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]"
                  >
                    {g.accion.texto}
                  </LocalizedClientLink>
                )}
                {g.href && (
                  <LocalizedClientLink
                    href={g.href}
                    className={
                      g.accion
                        ? "inline-flex items-center border border-[#C9C4B8] bg-white hover:border-[#C2560A] hover:text-[#B34D07] text-[#1B1B18] font-semibold px-4 py-2.5 rounded-[10px] text-[14px]"
                        : "inline-flex items-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]"
                    }
                  >
                    {g.boton ?? "Abrir el espacio de trabajo"}
                  </LocalizedClientLink>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {g.herramientas.map((h) => (
              <LocalizedClientLink
                key={h.href}
                href={h.href}
                className="group flex gap-3 rounded-[14px] border border-[#E7E4DC] bg-white p-5 hover:border-[#C2560A] hover:shadow-[0_6px_20px_rgba(194,86,10,0.10)]"
              >
                <span className="mt-0.5 shrink-0 text-[#C2560A]">
                  <ServicioIcono nombre={h.icono} size={24} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[16px] font-bold text-[#1B1B18] group-hover:text-[#B34D07]">{h.nombre}</span>
                  <span className="mt-1 flex-1 text-[13.5px] text-[#4A4943] leading-relaxed">{h.texto}</span>
                  <span
                    className={`mt-3 self-start rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
                      h.acceso === "gratis" ? "bg-[#E7F5EC] text-[#1E7B3A]" : "bg-[#F3F1EA] text-[#6B675C]"
                    }`}
                  >
                    {ACCESO[h.acceso]}
                  </span>
                </span>
              </LocalizedClientLink>
            ))}
          </div>
        </section>
      ))}

      {/* Lo demás de HETNA, sólo como enlace */}
      <section className="px-4 lg:px-16 pt-12 max-w-[1280px]">
        <p className="text-[14px] text-[#4A4943]">
          ¿Buscas otra cosa?{" "}
          <LocalizedClientLink href="/disenar" className="font-semibold text-[#B34D07] hover:underline">
            Diseñar en 3D y 2D
          </LocalizedClientLink>
          {" · "}
          <LocalizedClientLink href="/laboratorio-cam" className="font-semibold text-[#B34D07] hover:underline">
            DXF a G-code y CAM
          </LocalizedClientLink>
          {" · "}
          <LocalizedClientLink href="/fabricacion" className="font-semibold text-[#B34D07] hover:underline">
            Que un taller te la fabrique
          </LocalizedClientLink>
        </p>
      </section>

      <section className="px-4 lg:px-16 pt-14 pb-16 max-w-[920px]">
        <h2 className="text-[22px] font-bold text-[#1B1B18]">Preguntas frecuentes</h2>
        <div className="mt-4 flex flex-col gap-3">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="rounded-[12px] border border-[#E7E4DC] bg-white p-4">
              <summary className="cursor-pointer text-[15px] font-semibold text-[#1B1B18]">{q.p}</summary>
              <p className="mt-2 text-[14px] text-[#4A4943] leading-relaxed">{q.r}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}
