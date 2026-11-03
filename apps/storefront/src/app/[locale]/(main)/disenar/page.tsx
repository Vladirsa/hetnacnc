import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { BloquePublicidad } from "@/components/hetna/disenar/BloquePublicidad"
import { CarruselEstudio, type TarjetaEstudio } from "@/components/hetna/disenar/CarruselEstudio"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"
import { ESCANEAR, ESTUDIOS, HERRAMIENTAS_DISENO, buscarHerramientaDiseno, type Estudio } from "@/lib/hetna/disenar"
import { DISENO_A_LA_MEDIDA } from "@/lib/hetna/herramientas"

// Portada de "Diseñar": vende los dos estudios (3D y 2D) con un carrusel cada
// uno, cuenta lo demás que hace HETNA y trae el texto y las preguntas para
// Google. Sin menú lateral: la navegación entre herramientas vive dentro de
// cada estudio.
const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Diseño 3D y 2D gratis para CNC, láser e impresión 3D: imagen a 3D, cajas, vectorizar | HETNA",
  description:
    "Convierte una foto en modelo 3D con IA, crea letras 3D, llaveros, litofanías, cajas para láser, letreros y vectoriza imágenes a DXF. Gratis, en el navegador y listo para fabricar.",
  alternates: {
    canonical: `${SITIO}/mx/disenar`,
    languages: { "es-MX": `${SITIO}/mx/disenar`, "en-US": `${SITIO}/us/disenar` },
  },
  openGraph: {
    title: "HETNA 3D Studio y 2D Studio: diseña para CNC gratis",
    description: "De una foto a un modelo 3D, cajas para láser, letreros y vectores DXF. Sin instalar nada.",
    url: `${SITIO}/mx/disenar`,
    type: "website",
  },
}

const tarjetas = (e: Estudio): TarjetaEstudio[] =>
  ESTUDIOS[e].herramientas.map((x) => {
    const h = buscarHerramientaDiseno(x.slug)!
    const ia = x.slug === ESCANEAR
    return {
      slug: x.slug,
      nombre: ia ? "Imagen a 3D con IA" : h.nombre,
      texto: ia ? "Sube una foto y la IA crea el modelo 3D con textura. Descarga GLB o STL." : h.texto,
      icono: ia ? "ia" : h.icono,
      gratis: h.acceso === "gratis",
    }
  })

const SERVICIOS = [
  { icono: "cotizador", t: "Cotiza tu pieza", d: "Sube tu archivo y recibe precios de talleres CNC de todo México.", href: "/cotizar" },
  { icono: "tienda", t: "Fabrícamelo", d: "¿No tienes máquina? Un taller cerca de ti corta, graba o imprime tu diseño.", href: "/fabricacion" },
  { icono: "gcode", t: "DXF a G-code", d: "Pasadas, avance y revoluciones calculados para tu router o láser.", href: "/cam/subir" },
  { icono: "aprender", t: "Aprende CNC", d: "Cursos, guías y el foro de la comunidad para resolver dudas.", href: "/aprendizaje-cnc" },
  { icono: "calculadora", t: "Calculadoras CNC", d: "Avance, velocidad de corte, costos y tiempos de maquinado.", href: "/calculadora-cnc" },
  { icono: "caja", t: "Talleres y vendedores", d: "Encuentra talleres verificados o vende tus productos y archivos.", href: "/talleres" },
]

const FAQ = [
  {
    p: "¿Cómo convierto una foto en un modelo 3D?",
    r: "Entra al 3D Studio, abre Imagen a 3D y sube una foto de la pieza con fondo liso y buena luz. La IA genera el modelo con textura en 3 a 5 minutos y lo descargas en GLB (con color) o en STL para imprimir en 3D o maquinar. El primer modelo de cada mes es gratis.",
  },
  {
    p: "¿Qué puedo diseñar gratis para corte láser?",
    r: "En el 2D Studio tienes generador de cajas con juntas de dedo, más de 35 plantillas de empaque, letreros con nombre, rompecabezas, mandalas en capas, despiece de muebles y foto para grabado. Todo se descarga en DXF, SVG o PDF.",
  },
  {
    p: "¿Cómo vectorizo una imagen a DXF para CNC?",
    r: "Abre el Vectorizador en el 2D Studio, sube tu logotipo o dibujo y ajusta el umbral. Descargas los contornos en DXF o SVG listos para router, láser o plasma.",
  },
  {
    p: "¿Qué archivos me entrega cada herramienta?",
    r: "Las herramientas 2D entregan DXF, SVG y PDF. Las 3D entregan STL para impresión 3D y CAM, y en Imagen a 3D también GLB con textura para mostrar el modelo en web o en tienda.",
  },
  {
    p: "¿Necesito instalar algún programa o crear cuenta?",
    r: "No necesitas instalar nada: todo corre en el navegador, también en el celular. Las herramientas 2D y la mayoría de las 3D se usan sin cuenta; para Imagen a 3D sí necesitas entrar, porque tus modelos se guardan en tu perfil.",
  },
  {
    p: "No tengo máquina, ¿quién me fabrica la pieza?",
    r: "Con Fabrícamelo mandas tu diseño a talleres CNC de HETNA: ves el precio estimado, eliges el taller y recibes tu pieza en casa o la recoges.",
  },
]

const TarjetaEstudioGrande = ({
  e,
  titulo,
  texto,
  puntos,
  acento,
}: {
  e: Estudio
  titulo: string
  texto: string
  puntos: string[]
  acento: string
}) => (
  <LocalizedClientLink
    href={`/disenar/${ESTUDIOS[e].herramientas[0].slug}`}
    className="group relative flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#141922] p-6 transition hover:-translate-y-1 hover:border-white/25 lg:p-7"
  >
    <span
      className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl transition group-hover:opacity-60"
      style={{ background: acento }}
      aria-hidden="true"
    />
    <span className="relative text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: acento }}>
      HETNA {ESTUDIOS[e].nombre}
    </span>
    <span className="relative mt-2 text-[24px] font-extrabold leading-tight text-white lg:text-[28px]">{titulo}</span>
    <span className="relative mt-2 text-[14.5px] leading-relaxed text-white/65">{texto}</span>
    <span className="relative mt-4 flex flex-wrap gap-1.5">
      {puntos.map((p) => (
        <span key={p} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold text-white/75">
          {p}
        </span>
      ))}
    </span>
    <span className="relative mt-6 inline-flex self-start rounded-[10px] px-5 py-3 text-[15px] font-extrabold text-white" style={{ background: acento }}>
      Abrir {ESTUDIOS[e].nombre} →
    </span>
  </LocalizedClientLink>
)

export default function DisenarInicio() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "HETNA 3D Studio y 2D Studio",
      url: `${SITIO}/mx/disenar`,
      inLanguage: "es-MX",
      isPartOf: { "@type": "WebSite", name: "HETNA CNC", url: SITIO },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: HERRAMIENTAS_DISENO.length,
        itemListElement: HERRAMIENTAS_DISENO.map((h, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: h.nombre,
          url: `${SITIO}/mx/disenar/${h.slug}`,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.p, acceptedAnswer: { "@type": "Answer", text: f.r } })),
    },
  ]

  return (
    <div className="bg-[#0D1015]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Portada */}
      <section
        className="relative overflow-hidden px-4 pb-10 pt-10 lg:px-8 lg:pb-14 lg:pt-14"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(240,122,26,0.18), transparent 45%), radial-gradient(circle at 90% 10%, rgba(56,189,248,0.14), transparent 40%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 22px 22px",
        }}
      >
        <div className="mx-auto max-w-[1240px]">
          <span className="inline-block rounded-full bg-[#F07A1A]/15 px-3 py-1 text-[12px] font-extrabold uppercase tracking-wide text-[#F59A4A]">
            Gratis · en tu navegador · listo para fabricar
          </span>
          <h1 className="m-0 mt-4 max-w-[880px] text-[34px] font-extrabold leading-[1.05] text-white lg:text-[54px]">
            Diseña en 3D y 2D para tu CNC, láser o impresora 3D
          </h1>
          <p className="m-0 mt-4 max-w-[720px] text-[16.5px] leading-relaxed text-white/70">
            Convierte una foto en modelo 3D con IA, crea letras 3D y llaveros, o arma cajas, letreros y vectores DXF. Descarga el
            archivo o mándalo a fabricar con un taller de HETNA.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <TarjetaEstudioGrande
              e="3d"
              titulo="De una foto a un modelo 3D"
              texto="Modelos con textura para mostrar, imprimir o maquinar. Visor 3D profesional y descarga en STL o GLB."
              puntos={["Imagen a 3D con IA", "Letras 3D", "Llaveros", "Litofanías", "SVG a STL"]}
              acento="#F07A1A"
            />
            <TarjetaEstudioGrande
              e="2d"
              titulo="Vectores listos para cortar"
              texto="Cajas, empaques, letreros y vectorizado para láser, router y plasma. DXF, SVG o PDF en segundos."
              puntos={["Cajas con juntas", "Vectorizador", "Letreros", "Muebles", "Empaques", "Anidado"]}
              acento="#0EA5E9"
            />
          </div>

          <dl className="m-0 mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["15+", "herramientas de diseño"],
              ["170+", "cajas y empaques listos"],
              ["DXF · SVG · STL", "archivos para tu máquina"],
              ["3–5 min", "de foto a modelo 3D"],
            ].map(([n, t]) => (
              <div key={t} className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3">
                <dt className="text-[20px] font-extrabold text-white">{n}</dt>
                <dd className="m-0 text-[13px] text-white/55">{t}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Carruseles */}
      <div className="mx-auto max-w-[1400px]">
        <CarruselEstudio
          id="estudio-3d"
          etiqueta="HETNA 3D Studio"
          titulo="Crea en 3D: de una foto, un texto o un logotipo"
          texto="Modelos para impresión 3D, router 3D y para mostrar tus productos en línea."
          abrir={ESCANEAR}
          herramientas={tarjetas("3d")}
          acento="#F07A1A"
        />
        <CarruselEstudio
          id="estudio-2d"
          etiqueta="HETNA 2D Studio"
          titulo="Corta en 2D: cajas, letreros, vectores y muebles"
          texto="Archivos DXF, SVG y PDF para corte láser, router CNC y plasma, con medidas exactas."
          abrir={ESTUDIOS["2d"].herramientas[0].slug}
          herramientas={tarjetas("2d")}
          acento="#0EA5E9"
        />
      </div>

      {/* Cajas: catálogo grande */}
      <section className="px-4 pb-12 pt-2 lg:px-8">
        <LocalizedClientLink
          href="/disenar/cajas"
          className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 rounded-[20px] bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] px-6 py-6 text-white hover:brightness-110 lg:px-8"
        >
          <span>
            <span className="block text-[22px] font-extrabold lg:text-[26px]">Más de 170 cajas y empaques listos para cortar</span>
            <span className="mt-1 block text-[14.5px] text-white/85">
              Cajas con tapa, organizadores, cajas de regalo y de pizza. Pones tus medidas y descargas el DXF.
            </span>
          </span>
          <span className="rounded-[10px] bg-white px-5 py-3 text-[15px] font-extrabold text-[#1E3A8A]">Ver catálogo de cajas →</span>
        </LocalizedClientLink>
      </section>

      {/* Lo que hacemos */}
      <section className="bg-[#F7F6F2] px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#B34D07]">Todo HETNA CNC</span>
          <h2 className="m-0 mt-1.5 text-[26px] font-extrabold leading-tight text-[#1B1B18] lg:text-[34px]">
            Diseñas aquí. Lo fabricas con nosotros.
          </h2>
          <p className="m-0 mt-2 max-w-[720px] text-[15px] leading-relaxed text-[#4A4943]">
            HETNA es el marketplace de CNC de México: talleres, máquinas, herramientas, archivos y cursos en un solo lugar.
          </p>
          <ul className="m-0 mt-7 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICIOS.map((s) => (
              <li key={s.t}>
                <LocalizedClientLink
                  href={s.href}
                  className="group flex h-full gap-4 rounded-[16px] border border-[#E7E4DC] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(20,32,51,0.10)]"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-[#FDEEE1] text-[#B34D07]">
                    <ServicioIcono nombre={s.icono} size={26} />
                  </span>
                  <span>
                    <span className="block text-[16px] font-bold text-[#1B1B18] group-hover:text-[#B34D07]">{s.t}</span>
                    <span className="mt-1 block text-[13.5px] leading-relaxed text-[#4A4943]">{s.d}</span>
                  </span>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>

          {/* Cómo funciona */}
          <ol className="m-0 mt-12 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1", "#F07A1A", "Diseña gratis", "Pones medidas, escribes un texto o subes una foto. Lo ves en 3D al instante."],
              ["2", "#0EA5E9", "Descarga", "DXF, SVG, PDF o STL para tu máquina, sin marcas de agua."],
              ["3", "#19B374", "O fabrícalo", "Toca «Fabrícamelo» y ve el precio de talleres cerca de ti."],
              ["4", "#8B5CF6", "Recibe tu pieza", "Pagas en HETNA; el taller cobra cuando entrega."],
            ].map(([n, c, t, d]) => (
              <li key={n}>
                <span className="text-[36px] font-extrabold leading-none" style={{ color: c }}>
                  {n}
                </span>
                <p className="m-0 mt-1.5 text-[16px] font-bold text-[#1B1B18]">{t}</p>
                <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-[#4A4943]">{d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[16px] bg-[#142033] p-6 text-white">
              <h2 className="m-0 text-[19px] font-bold">¿Prefieres que te hagamos el diseño?</h2>
              <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-white/75">
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
            <BloquePublicidad compacto />
          </div>
        </div>
      </section>

      {/* Texto para buscadores y preguntas */}
      <section className="bg-white px-4 py-12 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="text-[15px] leading-relaxed text-[#4A4943]">
            <h2 className="m-0 text-[24px] font-extrabold leading-tight text-[#1B1B18]">Diseño CNC en línea, gratis y en español</h2>
            <p className="mt-3">
              Con <strong>HETNA 3D Studio</strong> conviertes una <strong>imagen a 3D</strong> con inteligencia artificial: subes la
              foto de una figura, una pieza o un producto y recibes el modelo con textura en GLB y en{" "}
              <strong>STL para impresión 3D</strong> o router. También haces <strong>letras 3D</strong> para anuncios luminosos,{" "}
              <strong>llaveros con nombre</strong>, <strong>litofanías</strong> y extruyes cualquier SVG o DXF a STL.
            </p>
            <p className="mt-3">
              En <strong>HETNA 2D Studio</strong> generas <strong>cajas para corte láser</strong> con juntas de dedo, plantillas de
              empaque, letreros, rompecabezas y despiece de muebles, y <strong>vectorizas imágenes a DXF</strong> para router CNC,
              láser y plasma. Todo con medidas exactas, el espesor de tu material y el ajuste del kerf.
            </p>
            <p className="mt-3">
              Cuando tengas tu archivo, pásalo a G-code o mándalo a fabricar con talleres CNC de todo México sin salir de HETNA.
            </p>
          </div>
          <div>
            <h2 className="m-0 text-[24px] font-extrabold leading-tight text-[#1B1B18]">Preguntas frecuentes</h2>
            <div className="mt-3 divide-y divide-[#E7E4DC] rounded-[14px] border border-[#E7E4DC]">
              {FAQ.map((f) => (
                <details key={f.p} className="group px-4 py-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-[#1B1B18]">
                    {f.p}
                    <span className="text-[18px] text-[#B34D07] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="m-0 mt-2 text-[14px] leading-relaxed text-[#4A4943]">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
