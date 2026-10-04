import fs from "fs"
import path from "path"

import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { BotonSlide, HeroSlider, Slide } from "@/components/hetna/HeroSlider"
import { HomeProductSection } from "@/components/sections/HomeProductSection/HomeProductSection"
import { listCategories } from "@/lib/data/categories"
import { ComoFunciona, HerramientasHome, PilaresHome } from "@/components/hetna/Secciones"
import { listarPortadas, PortadaTienda } from "@/lib/data/portadas"

const WHATSAPP_NUMERO =
  process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"

const whatsappLink = (mensaje: string) =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`

// Fotos del carrusel: van en apps/storefront/public/images/hero/.
// Si una foto no existe en el servidor, esa diapositiva usa el fondo industrial dibujado con CSS.
const fotoHero = (archivo: string) => {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", "images", "hero", archivo))
      ? `/images/hero/${archivo}`
      : null
  } catch {
    return null
  }
}

// Convierte una portada del panel en diapositiva del carrusel
const botonDe = (texto: string | null, url: string | null): BotonSlide[] =>
  texto && url ? [{ texto, href: url, externo: /^https?:\/\//i.test(url) }] : []

const aSlide = (p: PortadaTienda): Slide => ({
  etiqueta: p.etiqueta,
  titulo: p.titulo,
  texto: p.texto,
  foto: p.imagen_url,
  alt: p.titulo,
  botones: [...botonDe(p.boton1_texto, p.boton1_url), ...botonDe(p.boton2_texto, p.boton2_url)],
})

const Icono = ({ nombre, size = 28 }: { nombre: string; size?: number }) => {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  switch (nombre) {
    case "diseno":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
          <circle cx="15" cy="15" r="2.4" />
        </svg>
      )
    case "lapiz":
      return (
        <svg {...p}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      )
    case "maquila":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      )
    case "tienda":
      return (
        <svg {...p}>
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M4 9v11h16V9" />
          <path d="M9 20v-6h6v6" />
        </svg>
      )
    case "servicios":
      return (
        <svg {...p}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z" />
        </svg>
      )
    case "recursos":
      return (
        <svg {...p}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    case "marketplace":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M15 14.5c.6-.3 1.3-.5 2-.5 2.5 0 4 1.8 4 4.5" />
        </svg>
      )
    case "cotizador":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <line x1="7" y1="9" x2="17" y2="9" />
          <line x1="7" y1="13" x2="13" y2="13" />
        </svg>
      )
    case "calculadora":
      return (
        <svg {...p}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="11" x2="8" y2="11.01" />
          <line x1="12" y1="11" x2="12" y2="11.01" />
          <line x1="16" y1="11" x2="16" y2="11.01" />
          <line x1="8" y1="15" x2="8" y2="15.01" />
          <line x1="12" y1="15" x2="12" y2="15.01" />
          <line x1="16" y1="15" x2="16" y2="15.01" />
        </svg>
      )
    case "visor":
      return (
        <svg {...p}>
          <path d="M2 12l10-7 10 7-10 7z" />
          <path d="M2 12v5l10 7 10-7v-5" />
        </svg>
      )
    case "torno":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      )
    case "envio":
      return (
        <svg {...p}>
          <rect x="1" y="6" width="14" height="11" rx="1" />
          <path d="M15 10h4l3 3v4h-7z" />
          <circle cx="6" cy="18.5" r="1.5" />
          <circle cx="18" cy="18.5" r="1.5" />
        </svg>
      )
    case "pago":
      return (
        <svg {...p}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="6" y1="15" x2="10" y2="15" />
        </svg>
      )
    case "whatsapp":
      return (
        <svg {...p}>
          <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1-5.4A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
      )
    case "check":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      )
    case "mexico":
      return (
        <svg {...p}>
          <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      )
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
  }
}

const normaliza = (t?: string | null) =>
  (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()

const iconoGrupo = (nombre: string) => {
  const n = normaliza(nombre)
  if (n.includes("tienda")) return "tienda"
  if (n.includes("servicio")) return "servicios"
  if (n.includes("recurso")) return "recursos"
  if (n.includes("marketplace")) return "marketplace"
  return "diseno"
}

const confianza = [
  { texto: "Envíos a toda la República", icono: "envio" },
  { texto: "Paga con tarjeta o Mercado Pago", icono: "pago" },
  { texto: "Atención directa por WhatsApp", icono: "whatsapp" },
  { texto: "Hecho en México", icono: "mexico" },
]

export const HetnaHome = async ({ locale }: { locale: string }) => {
  const [{ categories, parentCategories }, portadas] = await Promise.all([
    listCategories({
      query: { include_ancestors_tree: true },
    }).catch(() => ({ categories: [], parentCategories: [] })) as Promise<{
      categories: HttpTypes.StoreProductCategory[]
      parentCategories: HttpTypes.StoreProductCategory[]
    }>,
    listarPortadas(),
  ])

  // Busca una categoria por nombre para ligar las tarjetas de los pilares
  const ligaCategoria = (nombre: string) => {
    const buscado = normaliza(nombre)
    const c = [...categories, ...parentCategories].find(
      (x) => normaliza(x.name) === buscado
    )
    return c ? `/categories/${c.handle}` : "/categories"
  }

  const hijosDe = (padre: HttpTypes.StoreProductCategory) => {
    const hijos = categories.filter((c) => c.parent_category_id === padre.id)
    return hijos.length ? hijos : padre.category_children || []
  }

  const pilares = [
    {
      icono: "tienda",
      titulo: "Marketplace de máquinas, herramientas y materiales",
      texto: "Routers, láser, plasma, fresas y materiales de vendedores y talleres de todo México.",
      accion: "Explorar tienda",
      href: "/categories",
    },
    {
      icono: "diseno",
      titulo: "Diseños digitales listos para cortar",
      texto: "Archivos DXF, SVG y STL para descargar y fabricar en tu máquina.",
      accion: "Ver diseños",
      href: ligaCategoria("Diseños digitales"),
    },
    {
      icono: "maquila",
      titulo: "Maquila y piezas terminadas",
      texto: "Te lo diseñamos y te lo fabricamos en router, láser o plasma.",
      accion: "Pedir maquila",
      href: ligaCategoria("Maquinado"),
    },
    {
      icono: "herramientas",
      titulo: "Herramientas digitales para talleres",
      texto: "Cotizador, generador 2D/3D y calculadoras para trabajar más rápido.",
      accion: "Ver herramientas",
      href: "/servicios",
    },
  ]

  const herramientas = [
    {
      icono: "cotizador",
      nombre: "Cotizador CNC",
      que: "Calcula el precio de tu pieza según material, tiempo de máquina y acabado.",
      beneficio: "Obtén precios estimados en minutos",
      disponible: true,
      href: "/servicios/cotizador-cnc",
    },
    {
      icono: "generador",
      nombre: "Generador 2D y 3D",
      que: "Cajas, letreros, despieces y vectorizado: descarga en DXF, SVG o PDF.",
      beneficio: "De la idea al archivo listo para cortar",
      disponible: true,
      href: "/servicios/generador-2d-3d",
    },
    {
      icono: "corte",
      nombre: "Calculadora de corte",
      que: "Velocidades, avances y tiempos por material y herramienta.",
      beneficio: "Optimiza tiempos y costos",
      disponible: false,
    },
    {
      icono: "visor",
      nombre: "Visor de archivos",
      que: "Abre y revisa DXF, SVG y STL desde el navegador.",
      beneficio: "Revisa tu diseño antes de fabricar",
      disponible: false,
    },
    {
      icono: "torno",
      nombre: "Calculadora de torno",
      que: "RPM, avance y pasadas para trabajos en torno CNC.",
      beneficio: "Menos errores y menos material perdido",
      disponible: false,
    },
  ]

  // Portadas fijas: se usan mientras no haya portadas creadas en /dashboard → Portadas
  const slidesFijas: Slide[] = [
    {
      etiqueta: "Marketplace CNC de México",
      titulo: "Todo lo que tu taller CNC necesita, en un solo lugar",
      texto:
        "Máquinas, herramientas, materiales y diseños listos para cortar. Cotiza y produce tus piezas con talleres de todo México.",
      foto: fotoHero("hetna-hero.jpg"),
      alt: "Router CNC cortando madera en un taller",
      botones: [
        { texto: "Explorar tienda", href: "/categories" },
        { texto: "Cotizar proyecto", href: "/servicios/cotizador-cnc" },
      ],
    },
    {
      etiqueta: "Corte y grabado láser",
      titulo: "Corte láser en madera, MDF y acrílico",
      texto:
        "Envía tu archivo y te cotizamos el corte, o compra diseños listos para tu máquina láser.",
      foto: fotoHero("hero-laser.jpg"),
      alt: "Láser CO2 cortando triplay",
      botones: [
        { texto: "Cotizar corte láser", href: "/servicios/cotizador-cnc" },
        { texto: "Ver diseños", href: ligaCategoria("Diseños digitales") },
      ],
    },
    {
      etiqueta: "Corte por plasma",
      titulo: "Plasma CNC para lámina y placa de acero",
      texto:
        "Rejas, letreros, piezas y estructuras metálicas cortadas a la medida.",
      foto: fotoHero("hero-plasma.jpg"),
      alt: "Mesa de plasma CNC cortando placa de acero",
      botones: [
        { texto: "Cotizar corte plasma", href: "/servicios/cotizador-cnc" },
        { texto: "Ver plasma", href: ligaCategoria("Plasma") },
      ],
    },
    {
      etiqueta: "Impresión 3D y prototipos",
      titulo: "De tu idea a la pieza en 3D",
      texto:
        "Modelamos tu pieza, la imprimimos o te entregamos el archivo listo para fabricar.",
      foto: fotoHero("hero-3d.jpg"),
      alt: "Impresora 3D fabricando una pieza",
      botones: [
        {
          texto: "Cotizar impresión 3D",
          href: whatsappLink("Hola HETNA CNC, quiero cotizar una impresión 3D"),
          externo: true,
        },
        { texto: "Diseño 2D / 3D", href: "/servicios/generador-2d-3d" },
      ],
    },
    {
      etiqueta: "Grabado en metal",
      titulo: "Grabado láser de fibra en acero y aluminio",
      texto:
        "Placas, herramientas, piezas industriales y marcaje permanente.",
      foto: fotoHero("hero-fibra.jpg"),
      alt: "Láser de fibra grabando una placa de acero",
      botones: [
        {
          texto: "Cotizar grabado",
          href: whatsappLink("Hola HETNA CNC, quiero cotizar un grabado láser en metal"),
          externo: true,
        },
        { texto: "Ver máquinas láser", href: ligaCategoria("Láser") },
      ],
    },
  ]

  const slides = portadas.length > 0 ? portadas.map(aSlide) : slidesFijas

  return (
    <div className="w-full bg-[#FAF9F6] text-[#1B1B18]">
      <HeroSlider slides={slides} />

      {/* Franja de confianza */}
      <section className="w-full bg-[#1B2A42] text-white">
        <ul className="m-0 p-0 list-none max-w-[1180px] mx-auto px-4 lg:px-16 py-3 grid grid-cols-2 lg:grid-cols-4 gap-y-2.5">
          {confianza.map((c, i) => (
            <li
              key={c.texto}
              className={`flex items-center justify-center text-left gap-2 px-2 ${
                i > 0 ? "lg:border-l lg:border-white/15" : ""
              }`}
            >
              <span className="text-[#F2A65E] shrink-0">
                <Icono nombre={c.icono} size={20} />
              </span>
              <span className="text-[11.5px] lg:text-[12px] font-semibold uppercase tracking-[0.05em] text-[#E6EBF3]">
                {c.texto}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <PilaresHome pilares={pilares} />

      {/* Compra por categoria */}
      {parentCategories.length > 0 && (
        <section className="px-4 lg:px-16 pb-10">
          <h2 className="font-display text-[20px] font-semibold m-0 mb-4">
            Compra por categoría
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {parentCategories.map((padre) => (
              <div
                key={padre.id}
                className="bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col"
              >
                <LocalizedClientLink
                  href={`/categories/${padre.handle}`}
                  className="h-[96px] flex items-center justify-center text-[#142033]"
                  style={{
                    backgroundColor: "#F4F1EA",
                    backgroundImage:
                      "radial-gradient(circle, #E7E4DC 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                  }}
                  aria-label={padre.name}
                >
                  <Icono nombre={iconoGrupo(padre.name)} size={38} />
                </LocalizedClientLink>
                <div className="p-4 flex flex-col gap-2">
                  <LocalizedClientLink
                    href={`/categories/${padre.handle}`}
                    className="font-display font-semibold text-[15px] hover:text-[#B34D07]"
                  >
                    {padre.name}
                  </LocalizedClientLink>
                  <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                    {hijosDe(padre).map((hijo) => (
                      <li key={hijo.id}>
                        <LocalizedClientLink
                          href={`/categories/${hijo.handle}`}
                          className="text-[13px] text-[#6B6A63] hover:text-[#B34D07]"
                        >
                          {hijo.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Productos reales */}
      <section className="px-4 lg:px-16 pb-6">
        <HomeProductSection heading="Lo más nuevo" locale={locale} home />
      </section>

      <HerramientasHome herramientas={herramientas} />

      <ComoFunciona />

      {/* Banner proyecto a la medida */}
      <section className="mx-4 lg:mx-16 mb-12 bg-[#142033] rounded-[20px] px-6 py-8 lg:px-12 lg:py-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-2.5 max-w-[560px]">
          <span className="uppercase tracking-[0.08em] text-[11.5px] font-semibold text-[#F2A65A]">
            Proyectos a la medida
          </span>
          <h3 className="font-display m-0 text-[24px] lg:text-[26px] font-bold text-white">
            ¿Tienes una idea? Nosotros la hacemos realidad
          </h3>
          <p className="m-0 text-[14px] leading-[1.6] text-[#C9D2E0]">
            Cuéntanos qué necesitas y te cotizamos el diseño, el corte o la
            pieza terminada.
          </p>
        </div>
        <a
          href={whatsappLink("Hola HETNA CNC, tengo un proyecto a la medida")}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 bg-[#C2560A] hover:bg-[#A84A08] text-white px-6 py-3 rounded-[10px] text-[14.5px] font-semibold"
        >
          Cotizar por WhatsApp
        </a>
      </section>
    </div>
  )
}
