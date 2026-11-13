import type { Metadata } from "next"

import { CalculadoraCNC } from "@/components/hetna/calculadora/CalculadoraCNC"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PROCESOS } from "@/lib/calculadora"

// Calculadora CNC profesional: velocidades y avances para router y fresadora,
// láser CO₂ por potencia de tubo, fibra y UV para marcar, corte de lámina por
// fibra, plasma e impresión 3D. El motor vive en lib/calculadora/*.

const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  // Enfocada en "calculadora de avance y revoluciones": /herramientas-cnc es la
  // página general de herramientas (no compiten por la misma búsqueda).
  title: "Calculadora CNC de avance y revoluciones (RPM)",
  description:
    "Calcula RPM y avance para router CNC y fresadora según fresa, filos y material, más potencia para láser, plasma e impresión 3D. Gratis y con fórmulas.",
  alternates: {
    canonical: `${SITIO}/mx/calculadora-cnc`,
    languages: { "es-MX": `${SITIO}/mx/calculadora-cnc` },
  },
}

const PREGUNTAS = [
  {
    p: "¿De dónde salen los números?",
    r: "De rangos publicados por fabricantes de fresas, antorchas de plasma, fuentes de fibra, máquinas láser CO₂ e impresoras, ajustados por la rigidez y la potencia de tu máquina. En noviembre de 2026 se compararon contra rangos publicados por fabricantes y se corrigieron los valores que salían de ellos. Son puntos de partida: la tabla de tu equipo y la prueba en un retazo mandan.",
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

const COMO = [
  { n: "01", t: "Rango del fabricante", d: "Carga de viruta por material y diámetro de fresa, velocidad de producción del plasma por amperaje, velocidad de la fibra por potencia y gas, flujo máximo del hotend por filamento." },
  { n: "02", t: "Límites de tu máquina", d: "RPM y avance máximos, potencia real del spindle a esas RPM, vatios reales del tubo, amperaje de la fuente. Si algo no alcanza, el resultado baja y te dice por qué." },
  { n: "03", t: "Física del corte", d: "Potencia por volumen de material removido, flexión de la fresa según lo que sobresale del collet, adelgazamiento de viruta con poco paso lateral, altura de cresta en punta bola." },
  { n: "04", t: "Avisos y medidores", d: "Cada valor se muestra contra su rango sano. Lo que queda fuera se marca, con la causa y qué cambiar. La prueba en un retazo siempre es el último paso." },
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
      <section className="relative overflow-hidden bg-[#142033] px-4 pb-28 pt-7 text-white lg:px-8 lg:pt-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#C2560A] opacity-30 blur-3xl" />
        <div className="relative mx-auto max-w-[1280px]">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#FFB27A]">Gratis · sin cuenta</span>
          <h1 className="m-0 mt-3 font-display text-[28px] font-bold leading-tight lg:text-[40px]">Calculadora CNC de avance y revoluciones (RPM)</h1>
          <p className="m-0 mt-2 max-w-[720px] text-[15px] leading-relaxed text-white/75">
            Dile qué máquina tienes y qué vas a cortar. Te da los parámetros para empezar y revisa que tu máquina pueda con ellos: potencia, flexión de la fresa, alcance del láser, perforación del plasma.
          </p>
          <ul className="m-0 mt-4 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-[13px] text-white/70">
            {["6 procesos en una sola herramienta", "Se ajusta a los límites de tu máquina", "Te avisa lo que puede salir mal"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="text-[#3FD08A]">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="relative mx-auto -mt-24 max-w-[1280px] px-4 pb-10 lg:px-8">
        <CalculadoraCNC procesoInicial={proceso} />
      </div>
      <section className="mx-auto max-w-[1280px] px-4 pb-10 lg:px-8">
        <h2 className="m-0 mb-1 font-display text-[22px] font-bold text-[#142033]">Fórmulas de revoluciones y avance</h2>
        <div className="grid gap-3 text-[14px] leading-relaxed text-[#40403A] lg:grid-cols-2">
          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
            <p className="m-0 font-bold text-[#142033]">Revoluciones (RPM)</p>
            <p className="m-0 mt-1 font-mono text-[13px]">RPM = (Vc × 1000) ÷ (π × D)</p>
            <p className="m-0 mt-1.5">Vc es la velocidad de corte del material en m/min (la da el fabricante de la fresa) y D el diámetro de la fresa en mm.</p>
          </div>
          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
            <p className="m-0 font-bold text-[#142033]">Avance (mm/min)</p>
            <p className="m-0 mt-1 font-mono text-[13px]">Avance = RPM × z × fz</p>
            <p className="m-0 mt-1.5">z es el número de filos y fz la carga de viruta por filo en mm. Si fz es muy baja la fresa roza y se quema; si es muy alta se rompe.</p>
          </div>
        </div>
        <p className="m-0 mt-3 max-w-[760px] text-[13px] leading-relaxed text-[#6B6A63]">
          Ejemplo con números redondos: una fresa de 6 mm a Vc = 300 m/min gira a (300 × 1000) ÷ (3.1416 × 6) ≈ 15,900 RPM; con 2 filos y fz = 0.1 mm,
          el avance es 15,900 × 2 × 0.1 ≈ 3,180 mm/min. La calculadora de arriba hace estas cuentas con los rangos del material y revisa que tu máquina las aguante.
        </p>
      </section>
      <section className="mx-auto max-w-[1280px] px-4 pb-10 lg:px-8">
        <h2 className="m-0 mb-1 font-display text-[22px] font-bold text-[#142033]">Cómo se calcula</h2>
        <p className="m-0 mb-4 max-w-[760px] text-[14px] leading-relaxed text-[#6B6A63]">No es una tabla fija: cada resultado sale de un rango de fabricante y después se ajusta a lo que tu máquina puede hacer.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMO.map((c) => (
            <div key={c.t} className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <span className="font-mono text-[12px] font-bold text-[#C2560A]">{c.n}</span>
              <h3 className="m-0 mt-1 text-[15px] font-bold text-[#142033]">{c.t}</h3>
              <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[#6B6A63]">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-[1280px] px-4 pb-12 lg:px-8">
        <div className="max-w-[860px]">
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
        </div>
      </section>
    </div>
  )
}
