import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"
import { ESCANEAR, HERRAMIENTAS_DISENO } from "@/lib/hetna/disenar"
import { ACCESO, DISENO_A_LA_MEDIDA } from "@/lib/hetna/herramientas"

// Inicio del espacio "Diseñar y escanear": todas las herramientas a la vista.
const SITIO = "https://hetnacnc.com"

export const metadata: Metadata = {
  title: "Diseñar y escanear para CNC gratis: cajas, letreros, vectorizar, muebles y escaneo 3D",
  description:
    "Espacio de trabajo gratis para CNC y láser: caja con juntas de dedo, letreros en DXF, vectorizador, despiece de muebles, empaques, grabado de fotos, litofanías, mandalas, convertidor DXF/SVG/STL y escaneo 3D de piezas. Sin instalar nada.",
  alternates: {
    canonical: `${SITIO}/mx/disenar`,
    languages: { "es-MX": `${SITIO}/mx/disenar`, "en-US": `${SITIO}/us/disenar` },
  },
}

const GENERADORES = HERRAMIENTAS_DISENO.filter((h) => h.slug !== ESCANEAR)
const ESCANEO = HERRAMIENTAS_DISENO.find((h) => h.slug === ESCANEAR)!

const Tarjeta = ({ h }: { h: (typeof HERRAMIENTAS_DISENO)[number] }) => (
  <LocalizedClientLink
    href={`/disenar/${h.slug}`}
    className="group flex gap-3 rounded-[14px] border border-[#E7E4DC] bg-white p-4 hover:border-[#C2560A] hover:shadow-[0_6px_20px_rgba(194,86,10,0.10)]"
  >
    <span className="mt-0.5 shrink-0 text-[#C2560A]">
      <ServicioIcono nombre={h.icono} size={24} />
    </span>
    <span className="flex flex-1 flex-col">
      <span className="text-[15.5px] font-bold text-[#1B1B18] group-hover:text-[#B34D07]">{h.nombre}</span>
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
)

export default function DisenarInicio() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Diseñar y escanear",
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
  }

  return (
    <div className="px-4 lg:px-8 pt-6 pb-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-[28px] lg:text-[36px] font-bold text-[#1B1B18] leading-[1.1]">Diseñar y escanear</h1>
      <p className="mt-2 text-[15.5px] text-[#4A4943] leading-relaxed max-w-[720px]">
        Elige una herramienta y trabaja aquí mismo: pones las medidas o subes tu imagen y descargas el archivo listo para
        láser, router CNC o impresora 3D. Si la pieza ya existe, la escaneas con fotos. Cambias de herramienta desde el
        menú sin salir de esta página.
      </p>

      <h2 className="mt-8 text-[18px] font-bold text-[#1B1B18]">Generar un archivo</h2>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
        {GENERADORES.map((h) => (
          <Tarjeta key={h.slug} h={h} />
        ))}
      </div>

      <h2 className="mt-8 text-[18px] font-bold text-[#1B1B18]">De una pieza que ya existe</h2>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
        <Tarjeta h={ESCANEO} />
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[14px] bg-[#142033] p-5 text-white">
          <h2 className="text-[18px] font-bold">¿Prefieres que te hagamos el diseño?</h2>
          <p className="mt-1.5 text-[14px] text-white/75 leading-relaxed">
            De tu idea, foto o boceto a un archivo listo para tu máquina, hecho a la medida.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
          <h2 className="text-[18px] font-bold text-[#1B1B18]">¿Ya tienes el archivo?</h2>
          <p className="mt-1.5 text-[14px] text-[#4A4943] leading-relaxed">
            Pásalo a G-code con las pasadas, el avance y las revoluciones calculados, o mándalo a fabricar con talleres CNC
            de todo México.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LocalizedClientLink
              href="/cam/subir"
              className="inline-flex bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]"
            >
              DXF a G-code
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/fabricacion"
              className="inline-flex border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18] font-semibold px-4 py-2.5 rounded-[10px] text-[14px]"
            >
              Te fabricamos tu pieza
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </div>
  )
}
