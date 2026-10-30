import type { Metadata } from "next"

import { CalculadoraCNC } from "@/components/hetna/calculadora/CalculadoraCNC"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PROCESOS } from "@/lib/calculadora"

// Calculadora CNC profesional: velocidades y avances para router y fresadora,
// láser CO₂ por potencia de tubo, fibra y UV para marcar, corte de lámina por
// fibra, plasma e impresión 3D. El motor vive en lib/calculadora/*.

const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Calculadora CNC profesional: router, láser CO₂, fibra, plasma e impresión 3D",
  description:
    "Velocidades y avances para router CNC y fresadora, potencia y velocidad para láser CO₂ (K40 a 300 W), marcado con fibra y UV, corte de lámina por fibra, plasma CNC e impresión 3D. Gratis, con tu máquina guardada.",
  alternates: {
    canonical: `${SITIO}/mx/calculadora-cnc`,
    languages: { "es-MX": `${SITIO}/mx/calculadora-cnc`, "en-US": `${SITIO}/us/calculadora-cnc` },
  },
}

const PREGUNTAS = [
  {
    p: "¿De dónde salen los números?",
    r: "De rangos típicos publicados por fabricantes de fresas, tubos, fuentes láser, antorchas e impresoras, ajustados por la rigidez y potencia de tu máquina. Son puntos de partida: la prueba en un retazo manda.",
  },
  {
    p: "¿Qué tiene de distinto a otras calculadoras?",
    r: "No se queda en RPM y avance. Revisa que tu spindle tenga potencia, que la fresa no se flexione, que el tubo láser alcance el espesor, que el plasma perfore y que la impresora no pase del flujo del hotend. Y te avisa cuando algo va a salir mal.",
  },
  {
    p: "¿Sirve para máquinas caseras?",
    r: "Sí. Elige 'Desktop / 3018' o 'Hobby' en router, 'K40' en láser CO₂ o 'Q-switch 20 W' en fibra, y los parámetros se ajustan a lo que esa máquina aguanta.",
  },
  {
    p: "¿Guarda mi máquina?",
    r: "Sí, en tu navegador con el botón 'Guardar como mi máquina'. La próxima vez que entres ya estará puesta. No necesitas cuenta.",
  },
  {
    p: "¿Puedo cotizar con esto?",
    r: "Aquí obtienes el tiempo de máquina. Para convertirlo en precio con tus costos de material, mano de obra y utilidad, usa las calculadoras de precio o la app HETNA CNC para talleres.",
  },
]

export default async function CalculadoraCncPage({ searchParams }: { searchParams: Promise<{ proceso?: string }> }) {
  const { proceso } = await searchParams
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora CNC profesional HETNA",
        url: `${SITIO}/mx/calculadora-cnc`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        featureList: PROCESOS.map((p) => p.nombre).join(", "),
        inLanguage: "es-MX",
      },
      {
        "@type": "FAQPage",
        mainEntity: PREGUNTAS.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
      },
    ],
  }
  return (
    <div className="w-full bg-[#FAF9F6]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis · sin cuenta</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Calculadora CNC profesional</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[760px]">
          Velocidades y avances para router CNC y fresadora, potencia y velocidad para láser CO₂ de cualquier tubo, marcado con fibra y UV, corte de lámina por fibra, plasma e impresión 3D. Dile qué máquina tienes y te dice con qué empezar, qué revisar y qué puede salir mal.
        </p>
      </section>
      <div className="px-4 lg:px-8 pb-10">
        <CalculadoraCNC procesoInicial={proceso} />
      </div>
      <section className="px-4 lg:px-8 pb-12 max-w-[860px]">
        <h2 className="font-display text-[22px] font-bold m-0 mb-3 text-[#1B1B18]">Preguntas frecuentes</h2>
        <div className="flex flex-col gap-2">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3">
              <summary className="cursor-pointer text-[15px] font-semibold text-[#1B1B18]">{q.p}</summary>
              <p className="m-0 mt-2 text-[14px] text-[#6B6A63]">{q.r}</p>
            </details>
          ))}
        </div>
        <p className="m-0 mt-4 text-[14px] text-[#6B6A63]">
          ¿Quieres el precio de una pieza?{" "}
          <LocalizedClientLink href="/cotizar" className="font-semibold text-[#C2560A]">
            Calculadoras de precio
          </LocalizedClientLink>{" "}
          · ¿Más herramientas?{" "}
          <LocalizedClientLink href="/herramientas-cnc" className="font-semibold text-[#C2560A]">
            Todas las herramientas CNC
          </LocalizedClientLink>
        </p>
      </section>
    </div>
  )
}
