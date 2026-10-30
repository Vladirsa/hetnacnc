import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"
import {
  ACCESO,
  DISENO_A_LA_MEDIDA,
  GRUPOS_HERRAMIENTAS,
  TOTAL_HERRAMIENTAS,
} from "@/lib/hetna/herramientas"

// Todas las herramientas CNC de HETNA en una sola página: diseñar y escanear
// (espacio de trabajo /disenar), programar (Laboratorio CAM), cotizar y aprender. Sustituye a /cam y a
// /servicios/generador-2d-3d, que redirigen aquí (next.config).
//
// Se llama "Herramientas CNC gratis en línea" y no solo "Herramientas CNC"
// porque esa búsqueda la hace quien quiere comprar fresas y cortadores; el
// "gratis en línea" deja claro que aquí son programas.

const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Herramientas CNC gratis en línea: DXF a G-code, CAM 3–5 ejes y generadores",
  description:
    "Herramientas CNC gratis en línea: convierte DXF a G-code, programa en 3, 4 y 5 ejes, genera cajas con juntas, letreros, despiece de muebles y litofanías, escanea piezas y cotiza tu corte. Sin instalar nada.",
  alternates: {
    canonical: `${SITIO}/mx/herramientas-cnc`,
    languages: { "es-MX": `${SITIO}/mx/herramientas-cnc`, "en-US": `${SITIO}/us/herramientas-cnc` },
  },
}

const PREGUNTAS = [
  {
    p: "¿Las herramientas son gratis?",
    r: "Sí. Los generadores, el DXF a G-code, el laboratorio CAM, el torno y las calculadoras se usan gratis y sin cuenta. Solo el escaneo 3D que mide de verdad se paga con créditos, y el cotizador profesional para talleres tiene planes.",
  },
  {
    p: "¿Tengo que instalar algún programa?",
    r: "No. Todo funciona en el navegador, en la computadora o en el celular. Descargas el archivo (DXF, SVG, PDF, STL o G-code) y lo llevas a tu máquina.",
  },
  {
    p: "¿El G-code funciona con mi máquina?",
    r: "El laboratorio CAM genera programas para Mach3, LinuxCNC, GRBL, Fanuc y otros controladores, y el torno para Mach3 y Mach4. Antes de cortar, revisa la simulación y haz una prueba en vacío.",
  },
  {
    p: "¿Y si no sé diseñar o no tengo máquina?",
    r: "Te hacemos el diseño a la medida o te fabricamos la pieza con talleres CNC de todo México. Abajo están las dos opciones.",
  },
]

export default function HerramientasCnc() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Herramientas CNC gratis en línea",
        url: `${SITIO}/mx/herramientas-cnc`,
        inLanguage: "es-MX",
        isPartOf: { "@type": "WebSite", name: "HETNA CNC", url: SITIO },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: TOTAL_HERRAMIENTAS,
          itemListElement: GRUPOS_HERRAMIENTAS.flatMap((g) => g.herramientas).map((h, i) => ({
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
          { "@type": "ListItem", position: 2, name: "Herramientas CNC", item: `${SITIO}/mx/herramientas-cnc` },
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
        <span className="text-[#1B1B18] font-medium">Herramientas CNC</span>
      </div>

      <section className="px-4 lg:px-16 pt-6 pb-4 max-w-[1280px]">
        <h1 className="text-[30px] lg:text-[42px] font-bold text-[#1B1B18] leading-[1.1] max-w-[820px]">
          Herramientas CNC gratis en línea
        </h1>
        <p className="mt-3 text-[16px] text-[#4A4943] leading-relaxed max-w-[720px]">
          Diseña, programa y cotiza sin instalar nada: convierte tu DXF a G-code, programa piezas en 3, 4 y 5 ejes,
          genera cajas, letreros y despieces de muebles, escanea una pieza o pregúntale al Copiloto IA. Casi todas son
          gratis y sin cuenta.
        </p>

        {/* Por dónde empezar: cada botón baja a su grupo */}
        <nav aria-label="Grupos de herramientas" className="mt-6 flex flex-wrap gap-2">
          {GRUPOS_HERRAMIENTAS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-[#E7E4DC] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1B1B18] hover:border-[#C2560A] hover:text-[#B34D07]"
            >
              <span className="text-[#C2560A]">
                <ServicioIcono nombre={g.icono} size={16} />
              </span>
              {g.titulo}
              <span className="font-normal text-[#6B6A63]">· {g.pregunta}</span>
            </a>
          ))}
        </nav>
      </section>

      {GRUPOS_HERRAMIENTAS.map((g) => (
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

      {/* Cuando la herramienta no basta: lo hacemos nosotros */}
      <section className="px-4 lg:px-16 pt-14 max-w-[1280px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-[14px] bg-[#142033] p-6 text-white">
            <h2 className="text-[20px] font-bold">¿Prefieres que te hagamos el diseño?</h2>
            <p className="mt-2 text-[14px] text-white/75 leading-relaxed">
              De tu idea, foto o boceto a un archivo listo para tu máquina, hecho a la medida.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DISENO_A_LA_MEDIDA.map((s) => (
                <LocalizedClientLink
                  key={s.href}
                  href={s.href}
                  className="rounded-full border border-white/30 px-3.5 py-1.5 text-[13px] font-semibold hover:bg-white hover:text-[#142033]"
                >
                  {s.nombre}
                </LocalizedClientLink>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-6">
            <h2 className="text-[20px] font-bold text-[#1B1B18]">¿No tienes máquina?</h2>
            <p className="mt-2 text-[14px] text-[#4A4943] leading-relaxed">
              Corte, grabado, maquinado en 3, 4 y 5 ejes, torno e impresión 3D con talleres CNC de todo México. Subes tu
              archivo y recibes cotizaciones.
            </p>
            <LocalizedClientLink
              href="/fabricacion"
              className="mt-4 inline-flex justify-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
            >
              Te fabricamos tu pieza
            </LocalizedClientLink>
          </div>
        </div>
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
