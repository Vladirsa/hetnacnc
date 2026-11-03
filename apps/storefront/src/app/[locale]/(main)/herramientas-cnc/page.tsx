import type { Metadata } from "next"
import Image from "next/image"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { SliderHerramientas } from "@/components/hetna/herramientas/SliderHerramientas"

// Calculadora y cotizador: la página que los promociona, primero la
// calculadora (gratis, atrae tráfico) y después el cotizador para talleres
// (de paga). Con capturas reales de las dos herramientas en
// public/img/herramientas/. Diseñar vive en /disenar y el CAM en
// /laboratorio-cam; aquí sólo se enlazan al final.
const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Calculadora CNC y cotizador para talleres: RPM, avance, láser y precios al momento | HETNA",
  description:
    "Calculadora CNC gratis: RPM, avance y pasadas para router, velocidad y potencia para láser CO₂, fibra, plasma e impresión 3D. Y la app HETNA Cotizador: lee tu DXF, calcula el precio y lo manda por WhatsApp.",
  alternates: {
    canonical: `${SITIO}/mx/herramientas-cnc`,
    languages: { "es-MX": `${SITIO}/mx/herramientas-cnc`, "en-US": `${SITIO}/us/herramientas-cnc` },
  },
  openGraph: {
    title: "Calculadora CNC y cotizador para talleres | HETNA",
    description: "RPM, avance y potencia exactos para tu máquina, y precios al momento para tus clientes.",
    url: `${SITIO}/mx/herramientas-cnc`,
    images: [{ url: `${SITIO}/img/herramientas/calculadora-router.jpg`, width: 1920, height: 1200 }],
  },
}

const PROCESOS_CALC = [
  ["Router CNC y fresadora", "RPM, avance, pasadas, potencia del spindle y deflexión de la fresa."],
  ["Láser CO₂", "Del K40 al tubo de 300 W: velocidad, potencia, foco, kerf y espesor máximo."],
  ["Fibra y UV", "Marcado y grabado en metal y plástico: velocidad, frecuencia y pasadas."],
  ["Corte de lámina por fibra", "Acero, inoxidable y aluminio: velocidad, gas y presión."],
  ["Plasma CNC", "Amperaje, velocidad, altura de corte y perforación."],
  ["Impresión 3D", "Temperatura, velocidad y flujo máximo de tu hotend."],
]

const PRECIOS = [
  ["Router CNC", "/cotizar/router-cnc"],
  ["Corte láser", "/cotizar/corte-laser"],
  ["Corte plasma", "/cotizar/corte-plasma"],
  ["Impresión 3D", "/cotizar/impresion-3d"],
]

const VENTAJAS_APP = [
  ["Lee tu DXF", "Mide el largo de corte, las perforaciones y el área de lámina solo."],
  ["Tres precios", "Económico, estándar y express, con tu cobro mínimo y tu utilidad."],
  ["Por WhatsApp y PDF", "El cliente recibe el mensaje y la cotización en PDF con tu marca."],
  ["Historial", "Todas tus cotizaciones guardadas para darles seguimiento."],
  ["Con tus costos", "Tus materiales, tu hora máquina y tus tarifas: el precio es el tuyo."],
  ["En el celular", "Se instala desde el navegador, sin tienda de apps."],
]

const PREGUNTAS = [
  {
    p: "¿Cómo calculo las RPM y el avance de mi fresa?",
    r: "En la calculadora CNC eliges tu máquina, el material, el diámetro de la fresa y sus filos. Te da RPM, avance, profundidad por pasada y paso lateral, y revisa que tu spindle tenga potencia y que la fresa no se flexione.",
  },
  {
    p: "¿Qué velocidad y potencia uso en mi láser CO₂?",
    r: "Elige la potencia de tu tubo (de K40 a 300 W), la lente, el material y el espesor. La calculadora te da la velocidad, la potencia en porcentaje, los mA máximos, el foco y el espesor que alcanzas en una pasada.",
  },
  {
    p: "¿La calculadora es gratis?",
    r: "Sí, gratis y sin cuenta. Puedes guardar tu máquina en el navegador para que la próxima vez ya esté puesta.",
  },
  {
    p: "¿Cuánto cuesta cortar una pieza en láser o router?",
    r: "Depende del material, el espesor y los minutos de máquina. En las calculadoras de precio pones esos datos y ves el costo al momento; si quieres precios reales de talleres, sube tu archivo a Cotizar.",
  },
  {
    p: "¿Qué es la app HETNA Cotizador?",
    r: "Es la herramienta para talleres: subes el DXF del cliente, la app mide el trabajo, calcula material, tiempo y tu utilidad, y te da tres precios que mandas por WhatsApp o en PDF. Tiene planes de pago y se usa desde el celular.",
  },
]

const Marco = ({ src, alt, ancho, alto }: { src: string; alt: string; ancho: number; alto: number }) => (
  <div className="overflow-hidden rounded-[14px] border border-[#E2DED4] bg-white shadow-[0_24px_60px_-20px_rgba(20,32,51,0.35)]">
    <div className="flex items-center gap-1.5 border-b border-[#EEE9DF] bg-[#F6F4EF] px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
    </div>
    <Image src={src} alt={alt} width={ancho} height={alto} className="h-auto w-full" sizes="(min-width: 1024px) 640px, 100vw" />
  </div>
)

const Telefono = ({ src, alt, className = "" }: { src: string; alt: string; className?: string }) => (
  <div className={`w-[200px] shrink-0 rounded-[34px] border-[9px] border-[#1C2230] bg-[#1C2230] shadow-[0_24px_60px_-20px_rgba(20,32,51,0.55)] sm:w-[220px] ${className}`}>
    <Image src={src} alt={alt} width={780} height={1560} className="h-auto w-full rounded-[25px]" sizes="220px" />
  </div>
)

export default function HerramientasCnc() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora CNC profesional de HETNA",
        url: `${SITIO}/mx/calculadora-cnc`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        inLanguage: "es-MX",
      },
      {
        "@type": "SoftwareApplication",
        name: "HETNA Cotizador para talleres CNC",
        url: `${SITIO}/mx/servicios/cotizador-cnc`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        inLanguage: "es-MX",
      },
      {
        "@type": "FAQPage",
        mainEntity: PREGUNTAS.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITIO}/mx` },
          { "@type": "ListItem", position: 2, name: "Calculadora y cotizador CNC", item: `${SITIO}/mx/herramientas-cnc` },
        ],
      },
    ],
  }

  return (
    <main className="w-full bg-[#FAF9F6]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Portada con carrusel */}
      <section
        className="relative overflow-hidden bg-[#0D1015] px-4 pb-12 pt-6 lg:px-10 lg:pb-16"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 0%, rgba(240,122,26,0.16), transparent 45%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 22px 22px",
        }}
      >
        <div className="mx-auto max-w-[1240px]">
          <nav aria-label="Ruta" className="flex flex-wrap gap-1.5 text-[13px] text-white/50">
            <LocalizedClientLink href="/" className="hover:text-white">
              Inicio
            </LocalizedClientLink>
            <span>/</span>
            <span className="text-white/80">Calculadora y cotizador CNC</span>
          </nav>
          <h1 className="sr-only">Calculadora CNC y cotizador para talleres</h1>
          <div className="mt-8">
            <SliderHerramientas />
          </div>
        </div>
      </section>

      {/* 1. Calculadora */}
      <section id="calculadora" className="scroll-mt-28 px-4 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div>
            <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#B34D07]">1 · Calculadora CNC profesional · gratis</span>
            <h2 className="m-0 mt-2 text-[28px] font-extrabold leading-tight text-[#1B1B18] lg:text-[38px]">
              Los parámetros correctos antes de cortar
            </h2>
            <p className="m-0 mt-3 text-[16px] leading-relaxed text-[#4A4943]">
              No es sólo RPM y avance: revisa que tu máquina aguante, te avisa cuando algo va a salir mal y te da consejos para
              cada material. Para máquinas caseras y de taller.
            </p>
            <ul className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2">
              {PROCESOS_CALC.map(([t, d]) => (
                <li key={t} className="rounded-[12px] border border-[#E7E4DC] bg-white p-3.5">
                  <p className="m-0 text-[14.5px] font-bold text-[#1B1B18]">{t}</p>
                  <p className="m-0 mt-0.5 text-[13px] leading-snug text-[#5B5A54]">{d}</p>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <LocalizedClientLink
                href="/calculadora-cnc"
                className="rounded-[12px] bg-[#C2560A] px-6 py-3.5 text-[15.5px] font-extrabold text-white hover:bg-[#A84A08]"
              >
                Abrir la calculadora →
              </LocalizedClientLink>
            </div>
          </div>
          <div className="relative">
            <Marco src="/img/herramientas/calculadora-router.jpg" alt="Calculadora CNC: RPM, avance y pasadas para router" ancho={1920} alto={1200} />
            <div className="absolute -bottom-8 -left-4 hidden w-[55%] lg:block">
              <Marco src="/img/herramientas/calculadora-laser.jpg" alt="Calculadora de láser CO₂: velocidad y potencia" ancho={1920} alto={1200} />
            </div>
          </div>
        </div>

        {/* Calculadoras de precio */}
        <div id="cotizar" className="mx-auto mt-20 max-w-[1240px] scroll-mt-28 rounded-[20px] bg-[#142033] p-6 text-white lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-[620px]">
              <h3 className="m-0 text-[22px] font-extrabold lg:text-[26px]">¿Cuánto cuesta tu pieza? Calcúlalo al momento</h3>
              <p className="m-0 mt-1.5 text-[14.5px] leading-relaxed text-white/70">
                Calculadoras de precio gratis por proceso. Si quieres precios reales, sube tu archivo y recibe cotizaciones de
                talleres de todo México.
              </p>
            </div>
            <LocalizedClientLink href="/cotizar" className="rounded-[10px] bg-[#FFC53D] px-5 py-3 text-[15px] font-extrabold text-[#142033] hover:brightness-105">
              Cotizar mi pieza →
            </LocalizedClientLink>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {PRECIOS.map(([t, h]) => (
              <LocalizedClientLink key={h} href={h} className="rounded-full border border-white/25 px-4 py-2 text-[14px] font-semibold hover:bg-white hover:text-[#142033]">
                {t}
              </LocalizedClientLink>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Cotizador */}
      <section
        id="cotizador"
        className="scroll-mt-28 overflow-hidden bg-[#0D1015] px-4 py-14 text-white lg:px-10 lg:py-20"
        style={{ backgroundImage: "radial-gradient(circle at 85% 30%, rgba(25,179,116,0.16), transparent 45%)" }}
      >
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="order-2 flex justify-center gap-4 lg:order-1">
            <Telefono src="/img/herramientas/cotizador-archivo.jpg" alt="App HETNA Cotizador leyendo un DXF" className="mt-16 hidden sm:block" />
            <Telefono src="/img/herramientas/cotizador-precio.jpg" alt="App HETNA Cotizador con tres precios" />
            <Telefono src="/img/herramientas/cotizador-whatsapp.jpg" alt="App HETNA Cotizador enviando por WhatsApp" className="mt-16 hidden md:block" />
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#34D399]">2 · App HETNA Cotizador para talleres</span>
            <h2 className="m-0 mt-2 text-[28px] font-extrabold leading-tight lg:text-[38px]">Cotiza en segundos, no en horas</h2>
            <p className="m-0 mt-3 text-[16px] leading-relaxed text-white/70">
              Tu cliente te manda el archivo por WhatsApp y en menos de un minuto le respondes con el precio, el PDF y tu marca.
              Con tus costos y tu utilidad, desde el celular.
            </p>
            <ul className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2">
              {VENTAJAS_APP.map(([t, d]) => (
                <li key={t} className="flex gap-3 rounded-[12px] border border-white/10 bg-white/[0.04] p-3.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#19B374] text-[12px] font-black text-white">✓</span>
                  <span>
                    <span className="block text-[14.5px] font-bold">{t}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-white/60">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <LocalizedClientLink
                href="/servicios/cotizador-cnc"
                className="rounded-[12px] bg-[#19B374] px-6 py-3.5 text-[15.5px] font-extrabold text-white hover:brightness-110"
              >
                Conocer el cotizador →
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/servicios/cotizador-cnc#planes"
                className="rounded-[12px] border border-white/25 px-6 py-3.5 text-[15.5px] font-bold text-white hover:bg-white/10"
              >
                Ver planes
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      </section>

      {/* Preguntas */}
      <section className="px-4 py-14 lg:px-10">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="m-0 text-[26px] font-extrabold leading-tight text-[#1B1B18]">Preguntas frecuentes</h2>
            <p className="m-0 mt-3 text-[15px] leading-relaxed text-[#4A4943]">
              ¿Buscas otra cosa?{" "}
              <LocalizedClientLink href="/disenar" className="font-semibold text-[#B34D07] hover:underline">
                Diseñar en 3D y 2D
              </LocalizedClientLink>
              ,{" "}
              <LocalizedClientLink href="/laboratorio-cam" className="font-semibold text-[#B34D07] hover:underline">
                DXF a G-code
              </LocalizedClientLink>{" "}
              o{" "}
              <LocalizedClientLink href="/fabricacion" className="font-semibold text-[#B34D07] hover:underline">
                que un taller te la fabrique
              </LocalizedClientLink>
              .
            </p>
          </div>
          <div className="divide-y divide-[#E7E4DC] rounded-[14px] border border-[#E7E4DC] bg-white">
            {PREGUNTAS.map((q) => (
              <details key={q.p} className="group px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-[#1B1B18]">
                  {q.p}
                  <span className="text-[18px] text-[#B34D07] transition group-open:rotate-45">+</span>
                </summary>
                <p className="m-0 mt-2 text-[14px] leading-relaxed text-[#4A4943]">{q.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
