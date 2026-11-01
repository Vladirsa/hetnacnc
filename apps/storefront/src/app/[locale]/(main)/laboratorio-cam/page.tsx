import type { Metadata } from "next"
import Image from "next/image"

import { VistaColumnaTorno, VistaContornoMdf, VistaPlacaAluminio } from "@/components/hetna/cam/VistasConceptuales"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// Página del Laboratorio CAM: qué es, para quién, qué se puede hacer hoy y cómo
// se usa. Las herramientas viven en /cam/lab (3, 4 y 5 ejes), /cam/subir
// (DXF a G-code) y /cam/torno; esta página las explica y lleva a ellas.
//
// Todo lo que promete aquí existe hoy. Lo que todavía no (cajeado, SVG, láser)
// se dice tal cual en "Hoy y lo que sigue": es más fácil confiar en una
// herramienta técnica que te dice qué NO hace.
// Las imágenes son capturas reales del laboratorio con sus piezas de muestra.

const SITIO = "https://hetnacnc.com"
const URL = `${SITIO}/mx/laboratorio-cam`

export const metadata: Metadata = {
  title: "Laboratorio CAM en línea gratis: simula trayectorias y genera G-code | HETNA CNC",
  description:
    "Simula trayectorias CNC en 3, 4 y 5 ejes, revisa colisiones y tiempo de maquinado, y descarga el G-code para Mach3, LinuxCNC, GRBL, Fanuc y más. Gratis, sin cuenta y en el navegador.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Laboratorio CAM: aprende, prueba y prepara tus procesos CNC",
    description: "Simula trayectorias, revisa estrategias de corte y valida tu pieza antes de fabricarla. Gratis y sin cuenta.",
    url: URL,
    images: [{ url: `${SITIO}/laboratorio-cam/laboratorio-alabe-5-ejes.webp`, width: 1400, height: 860 }],
  },
}

const CONTROLADORES = ["Mach3", "Mach4", "LinuxCNC", "GRBL", "Fanuc", "Haas", "Siemens", "Heidenhain"]

const PUEDES = [
  { t: "Simular la trayectoria en 3D", d: "Ves por dónde pasa la fresa y cómo se va quitando el material, con reproducción de 5× a 600×." },
  { t: "Detectar colisiones y límites", d: "Marca en rojo donde la herramienta o el portaherramientas chocan, y reorienta en 5 ejes para librar la pieza." },
  { t: "Estimar el tiempo de maquinado", d: "Tiempo, metros de corte y líneas de G-code antes de prender la máquina: sirve para cotizar." },
  { t: "Probar estrategias de corte", d: "Paralela en 3 ejes, rotativa en 4, normal a la superficie y envolvente en 5, con desbaste previo." },
  { t: "Elegir material, herramienta y máquina", d: "9 materiales, fresas plana, de bola, toroidal, en V y broca, y la cinemática de tu máquina." },
  { t: "Preparar el archivo para tu máquina", d: "G-code para 8 controladores y posprocesadores para Fusion 360 y Vectric." },
]

const PARA_QUIEN = [
  { t: "Talleres CNC", d: "Valida el programa y calcula el tiempo antes de cotizar o cortar." },
  { t: "Operadores", d: "Revisa recorridos y colisiones antes de correrlo en la máquina." },
  { t: "Diseñadores", d: "Comprueba que tu pieza se puede maquinar y con qué herramienta." },
  { t: "Estudiantes y quien aprende CAM", d: "Practica con piezas de muestra sin instalar software caro." },
  { t: "Makers", d: "Pasa tu DXF a G-code para tu router en un minuto." },
  { t: "Quien manda a fabricar", d: "Valida la pieza antes de pedir cotización a los talleres." },
]

const PASOS = [
  { t: "Sube tu archivo o elige una pieza", d: "STL, OBJ, STEP o IGES en el CAM 3D; DXF en el de 2.5D. O abre una pieza de muestra." },
  { t: "Configura material y herramienta", d: "Elige el material, la fresa y tu máquina. Los avances y las revoluciones se calculan solos." },
  { t: "Simula el proceso", d: "Calcula la trayectoria y mira la simulación: tiempo, recorridos y colisiones." },
  { t: "Revisa, ajusta y descarga", d: "Cambia la estrategia si algo no convence y descarga el G-code para tu controlador." },
]

const MODOS = [
  {
    t: "Aprender",
    icono: "aprender" as const,
    puntos: ["Piezas de muestra listas: álabe de turbina, columna salomónica y relieve", "Cada aviso te dice la causa y cómo corregirlo", "Guías CNC y el foro para tus dudas"],
    cta: "Abrir una pieza de muestra",
    href: "/cam/lab",
  },
  {
    t: "Probar",
    icono: "ejes" as const,
    puntos: ["Simulación con remoción de material", "Colisiones, límites de la máquina y saltos de eje", "Tiempo estimado: compara estrategias y herramientas"],
    cta: "Simular una pieza",
    href: "/cam/lab",
  },
  {
    t: "Preparar",
    icono: "gcode" as const,
    puntos: ["G-code para tu controlador, con o sin refrigerante y números de línea", "DXF a G-code con compensación de fresa y pestañas", "Torno con eje rotativo para balaustres y columnas"],
    cta: "Subir mi archivo",
    href: "/cam/subir",
  },
]

const HERRAMIENTAS = [
  {
    t: "CAM en 3, 4 y 5 ejes",
    acepta: "STL, OBJ, STEP e IGES",
    hace: "Trayectoria 3D con simulación, anticolisión, desbaste y acabado",
    entrega: "G-code para 8 controladores, posprocesador Fusion 360 y Vectric",
    cta: "Entrar al laboratorio",
    href: "/cam/lab",
  },
  {
    t: "DXF a G-code (2.5D)",
    acepta: "DXF con contornos cerrados",
    hace: "Contorno por fuera y barrenos por dentro, pasadas según el espesor y pestañas",
    entrega: "G-code (.nc) y tiempo estimado; el archivo no se guarda",
    cta: "Subir un DXF",
    href: "/cam/subir",
  },
  {
    t: "Torno con eje rotativo",
    acepta: "Se diseña ahí mismo, por tramos (cilindro, cono, bola)",
    hace: "Escuadrado, desbaste, acabado en espiral, estrías y espiral salomónica",
    entrega: "G-code para Mach3 y Mach4 y tu diseño en .json",
    cta: "Diseñar en el torno",
    href: "/cam/torno",
  },
]

const PREGUNTAS = [
  {
    p: "¿Es gratis?",
    r: "Sí. El laboratorio CAM, el DXF a G-code y el torno se usan gratis y sin crear cuenta, y el G-code se descarga sin costo. Solo pagas si pides que un especialista te haga el programa, un posprocesador a la medida o la revisión de tu archivo.",
  },
  {
    p: "¿Necesito experiencia previa?",
    r: "No. Puedes empezar con las piezas de muestra y ver qué hace cada ajuste. Cuando algo no está bien, el laboratorio te dice la causa y cómo corregirlo. Para cortar en tu máquina sí necesitas saber ponerla en cero y operarla con seguridad.",
  },
  {
    p: "¿Qué archivos acepta?",
    r: "El CAM 3D acepta STL, OBJ, STEP e IGES (hasta 80 MB). El DXF a G-code acepta DXF de hasta 4 MB con contornos cerrados. El torno no necesita archivo: la pieza se arma ahí mismo.",
  },
  {
    p: "¿Puedo usarlo para producción real?",
    r: "Sí, el G-code es real y está hecho para tu controlador. La simulación es de referencia: antes de cortar, revisa el cero de pieza, las longitudes de herramienta y la sujeción, y corre el programa primero en vacío con avance reducido.",
  },
  {
    p: "¿Se guardan mis archivos?",
    r: "No. El DXF se procesa y no se guarda. En el CAM 3D la pieza se procesa en tu navegador. Solo cuando pides un servicio con un especialista se guarda tu trabajo en tu cuenta.",
  },
  {
    p: "¿Qué funciones vienen después?",
    r: "Estamos trabajando en cajeado (vaciar áreas completas), archivos SVG y corte láser en el convertidor 2.5D. Mientras tanto, para piezas con cajas usa el CAM 3D o pide el servicio con un especialista.",
  },
]

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E4DC] bg-white px-3 py-1 text-[13px] font-semibold text-[#1B1B18]">
    <span className="text-[#1E7B3A]">✓</span>
    {children}
  </span>
)

const Titulo = ({ eyebrow, children, id }: { eyebrow: string; children: React.ReactNode; id?: string }) => (
  <div id={id} className="scroll-mt-36">
    <p className="text-[12px] font-semibold uppercase tracking-wide text-[#B34D07]">{eyebrow}</p>
    <h2 className="mt-1 text-[24px] lg:text-[30px] font-bold leading-tight text-[#1B1B18]">{children}</h2>
  </div>
)

const BOTON = "inline-flex items-center justify-center rounded-[10px] px-5 py-3 text-[15px] font-semibold"
const PRIMARIO = `${BOTON} bg-[#C2560A] text-white hover:bg-[#A84A08]`
const SECUNDARIO = `${BOTON} border border-[#C9C4B8] bg-white text-[#1B1B18] hover:border-[#C2560A] hover:text-[#B34D07]`

export default function LaboratorioCam() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Laboratorio CAM de HETNA CNC",
        url: URL,
        applicationCategory: "DesignApplication",
        operatingSystem: "Navegador web",
        inLanguage: "es-MX",
        description: "Simulador CAM en línea para 3, 4 y 5 ejes y convertidor de DXF a G-code.",
        image: `${SITIO}/laboratorio-cam/laboratorio-alabe-5-ejes.webp`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
      },
      {
        "@type": "FAQPage",
        mainEntity: PREGUNTAS.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITIO}/mx` },
          { "@type": "ListItem", position: 2, name: "Herramientas CNC", item: `${SITIO}/mx/herramientas-cnc` },
          { "@type": "ListItem", position: 3, name: "Laboratorio CAM", item: URL },
        ],
      },
    ],
  }

  return (
    <main className="w-full bg-[#FAF9F6]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="px-4 lg:px-16 pt-6 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/herramientas-cnc" className="hover:text-[#B34D07]">Herramientas CNC</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Laboratorio CAM</span>
      </div>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-8 px-4 pt-6 lg:grid-cols-[1fr_1.15fr] lg:px-16">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[#B34D07]">Laboratorio CAM · gratis y sin cuenta</p>
          <h1 className="mt-2 text-[32px] lg:text-[44px] font-bold leading-[1.08] text-[#1B1B18]">
            Aprende, prueba y prepara tus procesos CNC
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-[#4A4943]">
            Simula trayectorias, revisa estrategias de corte y valida tu pieza antes de fabricarla. Todo en el navegador, con
            el G-code listo para tu máquina.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LocalizedClientLink href="/cam/lab" className={PRIMARIO}>Entrar al laboratorio</LocalizedClientLink>
            <LocalizedClientLink href="/cam/subir" className={SECUNDARIO}>Subir un DXF</LocalizedClientLink>
            <a href="#ejemplos" className={`${BOTON} text-[#B34D07] underline underline-offset-4`}>Ver ejemplos</a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Chip>Gratis</Chip>
            <Chip>Sin crear cuenta</Chip>
            <Chip>Nada que instalar</Chip>
            <Chip>3, 4 y 5 ejes</Chip>
          </div>
        </div>
        <figure className="m-0">
          <Image
            src="/laboratorio-cam/laboratorio-alabe-5-ejes.webp"
            alt="Laboratorio CAM simulando un álabe de turbina en 5 ejes, con tiempo estimado y verificación de colisiones"
            width={1400}
            height={860}
            priority
            sizes="(min-width: 1024px) 640px, 100vw"
            className="h-auto w-full rounded-[14px] border border-[#E7E4DC] shadow-[0_12px_40px_rgba(20,32,51,0.12)]"
          />
          <figcaption className="mt-2 text-[12.5px] text-[#6B6A63]">
            Captura real: álabe de turbina en 5 ejes, con 5:29 min estimados y cero colisiones sin resolver.
          </figcaption>
        </figure>
      </section>

      {/* Qué es, en 5 segundos */}
      <section className="mx-auto max-w-[1280px] px-4 pt-12 lg:px-16">
        <div className="rounded-[16px] bg-[#142033] p-6 text-white lg:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#F5B47E]">¿Qué es?</p>
          <p className="mt-2 max-w-[900px] text-[19px] lg:text-[22px] font-semibold leading-snug">
            Un simulador CAM en línea: le das tu pieza, eliges material, herramienta y máquina, y te enseña por dónde va a
            pasar la fresa, cuánto va a tardar y si algo choca. Cuando te convence, descargas el G-code.
          </p>
          <p className="mt-4 text-[13.5px] text-white/70">
            Genera programas para {CONTROLADORES.join(", ")}.
          </p>
        </div>
      </section>

      {/* Qué puedes hacer */}
      <section className="mx-auto max-w-[1280px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Qué puedes hacer">Lo que haces en el laboratorio</Titulo>
        <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {PUEDES.map((x) => (
            <li key={x.t} className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
              <p className="m-0 flex items-start gap-2 text-[16px] font-bold text-[#1B1B18]">
                <span className="mt-0.5 text-[#C2560A]">●</span>
                {x.t}
              </p>
              <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-[#4A4943]">{x.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Para quién */}
      <section className="mx-auto max-w-[1280px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Para quién es">Hecho para quien corta, diseña o aprende</Titulo>
        <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {PARA_QUIEN.map((x) => (
            <li key={x.t} className="rounded-[12px] bg-white px-4 py-3.5 ring-1 ring-[#E7E4DC]">
              <p className="m-0 text-[15px] font-bold text-[#142033]">{x.t}</p>
              <p className="m-0 mt-0.5 text-[13.5px] text-[#4A4943]">{x.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-[1280px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Cómo funciona">De tu archivo al G-code en 4 pasos</Titulo>
        <ol className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((x, i) => (
            <li key={x.t} className="relative rounded-[14px] border border-[#E7E4DC] bg-white p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C2560A] text-[16px] font-bold text-white">{i + 1}</span>
              <p className="m-0 mt-3 text-[16px] font-bold text-[#1B1B18]">{x.t}</p>
              <p className="m-0 mt-1 text-[14px] leading-relaxed text-[#4A4943]">{x.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <LocalizedClientLink href="/cam/lab" className={PRIMARIO}>Probar ahora</LocalizedClientLink>
        </div>
      </section>

      {/* Modos */}
      <section className="mx-auto max-w-[1280px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Modos del laboratorio">Aprender, probar y preparar</Titulo>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {MODOS.map((m) => (
            <div key={m.t} className="flex flex-col rounded-[16px] border border-[#E7E4DC] bg-white p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#FDEEE1] text-[#B34D07]">
                <ServicioIcono nombre={m.icono} size={24} />
              </span>
              <h3 className="mt-3 text-[20px] font-bold text-[#1B1B18]">{m.t}</h3>
              <ul className="m-0 mt-2 flex flex-1 list-none flex-col gap-1.5 p-0 text-[14px] text-[#4A4943]">
                {m.puntos.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <span className="text-[#1E7B3A]">✓</span>
                    {pt}
                  </li>
                ))}
              </ul>
              <LocalizedClientLink href={m.href} className={`${SECUNDARIO} mt-5 self-start`}>{m.cta}</LocalizedClientLink>
            </div>
          ))}
        </div>
      </section>

      {/* Las tres herramientas */}
      <section className="mx-auto max-w-[1280px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Elige por dónde entrar">Tres herramientas, según tu pieza</Titulo>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {HERRAMIENTAS.map((h) => (
            <div key={h.t} className="flex flex-col rounded-[16px] border border-[#E7E4DC] bg-white p-6">
              <h3 className="text-[19px] font-bold text-[#1B1B18]">{h.t}</h3>
              <dl className="m-0 mt-3 flex flex-1 flex-col gap-2 text-[14px]">
                {[
                  ["Acepta", h.acepta],
                  ["Hace", h.hace],
                  ["Entrega", h.entrega],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6A63]">{k}</dt>
                    <dd className="m-0 text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>
              <LocalizedClientLink href={h.href} className={`${PRIMARIO} mt-5`}>{h.cta}</LocalizedClientLink>
            </div>
          ))}
        </div>
      </section>

      {/* Ejemplos */}
      <section className="mx-auto max-w-[1280px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Ejemplos" id="ejemplos">Lo que puedes simular y preparar hoy</Titulo>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Ejemplo
            titulo="Relieve en madera · 3 ejes"
            texto="Desbaste y acabado de un relieve: aquí va a la mitad, con el material ya retirado. 4:32 min estimados."
            href="/cam/lab"
            cta="Abrir esta pieza"
            real
          >
            <Image src="/laboratorio-cam/simulacion-relieve-3-ejes.webp" alt="Simulación de desbaste de un relieve en 3 ejes, a la mitad del proceso" width={820} height={927} className="h-56 w-full rounded-[12px] object-cover object-center" sizes="(min-width: 1024px) 400px, 100vw" />
          </Ejemplo>
          <Ejemplo
            titulo="Álabe de turbina · 5 ejes"
            texto="Acabado normal a la superficie con reorientación automática para librar la pieza."
            href="/cam/lab"
            cta="Abrir esta pieza"
            real
          >
            <Image src="/laboratorio-cam/trayectoria-alabe-5-ejes.webp" alt="Trayectoria de acabado en 5 ejes sobre un álabe de turbina" width={820} height={927} className="h-56 w-full rounded-[12px] object-cover object-center" sizes="(min-width: 1024px) 400px, 100vw" />
          </Ejemplo>
          <Ejemplo titulo="Corte de contorno en MDF · 2.5D" texto="Contorno por fuera, barrenos por dentro, compensado a tu fresa y con pestañas para que no se suelte." href="/cam/subir" cta="Subir mi DXF">
            <VistaContornoMdf />
          </Ejemplo>
          <Ejemplo titulo="Placa de aluminio · 2.5D" texto="Elige aluminio y la fresa: las pasadas se reparten según el espesor y lo que aguanta el material." href="/cam/subir" cta="Subir mi DXF">
            <VistaPlacaAluminio />
          </Ejemplo>
          <Ejemplo titulo="Columna salomónica · torno 4 ejes" texto="Arma la pieza por tramos, agrega la espiral y descarga el G-code para Mach3 o Mach4." href="/cam/torno" cta="Diseñar en el torno">
            <VistaColumnaTorno />
          </Ejemplo>
          <div className="flex flex-col justify-center rounded-[16px] bg-[#FDEEE1] p-6">
            <h3 className="text-[19px] font-bold text-[#1B1B18]">¿Tu pieza es otra?</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-[#4A4943]">Súbela y simúlala. Si prefieres no hacerlo tú, un especialista te prepara el programa.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LocalizedClientLink href="/cam/lab" className={PRIMARIO}>Simular mi pieza</LocalizedClientLink>
              <LocalizedClientLink href="/cam/lab#precios" className={SECUNDARIO}>Ver servicio</LocalizedClientLink>
            </div>
          </div>
        </div>
      </section>

      {/* Hoy y lo que sigue */}
      <section className="mx-auto max-w-[1280px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Sin letras chiquitas">Lo que hace hoy y lo que sigue</Titulo>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[16px] border border-[#CFE6D6] bg-[#F1F9F3] p-6">
            <p className="m-0 text-[16px] font-bold text-[#14683F]">Ya funciona</p>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[14px] text-[#1B1B18]">
              {[
                "Simulación 3D con remoción de material y colisiones",
                "Estrategias de 3, 4 y 5 ejes con desbaste previo",
                "Tiempo estimado, metros de corte y líneas de G-code",
                "DXF a G-code: contornos, barrenos, compensación y pestañas",
                "Torno con eje rotativo: balaustres, patas y columnas",
                `G-code para ${CONTROLADORES.join(", ")}`,
              ].map((x) => (
                <li key={x} className="flex gap-2"><span className="text-[#1E7B3A]">✓</span>{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[16px] border border-[#E7E4DC] bg-white p-6">
            <p className="m-0 text-[16px] font-bold text-[#6B5A2E]">En desarrollo</p>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[14px] text-[#4A4943]">
              {["Cajeado: vaciar áreas completas en el convertidor 2.5D", "Archivos SVG (hoy el 2.5D acepta DXF)", "Corte y grabado láser, con su potencia y pasadas"].map((x) => (
                <li key={x} className="flex gap-2"><span className="text-[#B38A2E]">○</span>{x}</li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-[#6B6A63]">
              La simulación es de referencia: antes de cortar revisa el cero de pieza, las herramientas y la sujeción, y corre
              el programa en vacío con avance reducido.
            </p>
          </div>
        </div>
      </section>

      {/* Preguntas */}
      <section className="mx-auto max-w-[920px] px-4 pt-14 lg:px-16">
        <Titulo eyebrow="Preguntas frecuentes">Antes de empezar</Titulo>
        <div className="mt-5 flex flex-col gap-3">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="rounded-[12px] border border-[#E7E4DC] bg-white p-4">
              <summary className="cursor-pointer text-[15px] font-semibold text-[#1B1B18]">{q.p}</summary>
              <p className="mt-2 text-[14px] leading-relaxed text-[#4A4943]">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto max-w-[1280px] px-4 pb-16 pt-14 lg:px-16">
        <div className="flex flex-col items-start gap-4 rounded-[18px] bg-[#142033] p-7 text-white lg:flex-row lg:items-center lg:justify-between lg:p-9">
          <div>
            <h2 className="text-[24px] font-bold">Valida tu pieza antes de cortarla</h2>
            <p className="mt-1 text-[15px] text-white/75">Gratis, sin cuenta y en tu navegador. Y si no tienes máquina, te la fabricamos.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <LocalizedClientLink href="/cam/lab" className={PRIMARIO}>Entrar al laboratorio</LocalizedClientLink>
            <LocalizedClientLink href="/fabricacion" className={`${BOTON} border border-white/40 text-white hover:bg-white hover:text-[#142033]`}>
              Te fabricamos la pieza
            </LocalizedClientLink>
          </div>
        </div>
      </section>
    </main>
  )
}

function Ejemplo({
  titulo,
  texto,
  href,
  cta,
  real,
  children,
}: {
  titulo: string
  texto: string
  href: string
  cta: string
  real?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-[16px] border border-[#E7E4DC] bg-white p-4">
      <div className="relative">
        {children}
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#6B6A63]">
          {real ? "Captura real" : "Vista conceptual"}
        </span>
      </div>
      <h3 className="mt-3 text-[17px] font-bold text-[#1B1B18]">{titulo}</h3>
      <p className="m-0 mt-1 flex-1 text-[14px] leading-relaxed text-[#4A4943]">{texto}</p>
      <LocalizedClientLink href={href} className="mt-3 text-[14px] font-semibold text-[#B34D07] hover:underline">
        {cta} →
      </LocalizedClientLink>
    </div>
  )
}
