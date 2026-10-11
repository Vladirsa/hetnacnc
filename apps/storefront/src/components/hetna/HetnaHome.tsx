import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { HomeProductSection } from "@/components/sections/HomeProductSection/HomeProductSection"
import { listCategories } from "@/lib/data/categories"
import { listLearningArticles } from "@/lib/data/learning-articles"

const WHATSAPP_NUMERO =
  process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"

const whatsappLink = (mensaje: string) =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`

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

const herramientas = [
  { nombre: "Cotizador CNC", icono: "cotizador" },
  { nombre: "Calculadora de corte", icono: "calculadora" },
  { nombre: "Visor de archivos", icono: "visor" },
  { nombre: "Calculadora de torno", icono: "torno" },
]

const confianza = [
  { texto: "Envíos a toda la República", icono: "envio" },
  { texto: "Atención directa por WhatsApp", icono: "whatsapp" },
  { texto: "Diseño y maquila a la medida", icono: "check" },
  { texto: "Hecho en México", icono: "mexico" },
]

export const HetnaHome = async ({ locale }: { locale: string }) => {
  const { categories, parentCategories } = (await listCategories({
    query: { include_ancestors_tree: true },
  }).catch(() => ({ categories: [], parentCategories: [] }))) as {
    categories: HttpTypes.StoreProductCategory[]
    parentCategories: HttpTypes.StoreProductCategory[]
  }

  const { learning_articles: articulosAprendizaje } = await listLearningArticles({
    limit: 3,
  })

  // Busca una categoria por nombre para ligar las tarjetas de "Asi trabajamos"
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

  const formas = [
    {
      icono: "diseno",
      titulo: "Compra el diseño",
      texto:
        "¿Ya tienes máquina? Descarga archivos DXF, SVG y STL listos para cortar.",
      accion: "Ver diseños",
      href: ligaCategoria("Diseños digitales"),
    },
    {
      icono: "lapiz",
      titulo: "Te lo diseñamos",
      texto:
        "¿Tienes la idea pero no el archivo? Lo diseñamos en CAD/CAM a tu medida.",
      accion: "Diseño a la medida",
      href: ligaCategoria("Diseño CAD/CAM"),
    },
    {
      icono: "maquila",
      titulo: "Te lo maquilamos",
      texto:
        "¿No tienes cómo cortarlo? Lo fabricamos en router, láser o plasma.",
      accion: "Servicio de maquila",
      href: ligaCategoria("Maquinado"),
    },
  ]

  return (
    <div className="w-full bg-[#FAF9F6] text-[#1B1B18]">
      {/* Hero */}
      <section className="px-4 lg:px-16 py-10 lg:py-14 flex flex-col lg:flex-row gap-10 lg:gap-12 items-center">
        <div className="flex-1 flex flex-col gap-5">
          <span className="uppercase tracking-[0.08em] text-[12px] font-semibold text-[#B34D07]">
            Marketplace especializado en CNC
          </span>
          <h1 className="font-display m-0 text-[34px] leading-[1.1] lg:text-[46px] lg:leading-[1.08] font-bold tracking-[-0.02em]">
            Diseño, maquila o pieza terminada: tú eliges
          </h1>
          <p className="m-0 text-[16px] leading-[1.6] text-[#4A4A45] max-w-[500px]">
            Diseños listos para cortar, máquinas, herramientas, materiales y
            servicios de maquila, de talleres y vendedores de todo México.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <LocalizedClientLink
              href="/categories"
              className="bg-[#C2560A] hover:bg-[#A84A08] text-white px-6 py-3.5 rounded-[10px] text-[15px] font-semibold"
            >
              Explorar catálogo
            </LocalizedClientLink>
            <a
              href={whatsappLink("Hola HETNA CNC, quiero cotizar un proyecto")}
              target="_blank"
              rel="noopener noreferrer"
              className="border-[1.5px] border-[#142033] text-[#142033] hover:bg-[#142033] hover:text-white px-6 py-3.5 rounded-[10px] text-[15px] font-semibold"
            >
              Cotizar por WhatsApp
            </a>
          </div>
        </div>
        {/* Panel visual: se reemplaza por una foto del taller cuando la tengamos */}
        <div
          className="w-full lg:flex-1 h-[240px] lg:h-[360px] rounded-[20px] border border-[#E7E4DC] flex items-center justify-center text-[#C2560A]"
          style={{
            backgroundColor: "#FDEEE1",
            backgroundImage:
              "radial-gradient(circle, #E7C9AC 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <Icono nombre="diseno" size={120} />
        </div>
      </section>

      {/* Asi trabajamos */}
      <section className="px-4 lg:px-16 pb-10">
        <h2 className="font-display text-[20px] font-semibold m-0 mb-4">
          Así trabajamos contigo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {formas.map((f) => (
            <LocalizedClientLink
              key={f.titulo}
              href={f.href}
              className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(27,27,24,0.08)]"
            >
              <span className="text-[#142033]">
                <Icono nombre={f.icono} />
              </span>
              <span className="font-display font-semibold text-[17px]">
                {f.titulo}
              </span>
              <span className="text-[14px] leading-[1.55] text-[#4A4A45]">
                {f.texto}
              </span>
              <span className="mt-auto text-[13.5px] font-semibold text-[#B34D07]">
                {f.accion} →
              </span>
            </LocalizedClientLink>
          ))}
        </div>
      </section>

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

      {/* Herramientas (proximamente) */}
      <section className="px-4 lg:px-16 pb-10">
        <h2 className="font-display text-[20px] font-semibold m-0 mb-4">
          Herramientas para tu taller
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {herramientas.map((h) => (
            <div
              key={h.nombre}
              className="bg-white border border-[#E7E4DC] rounded-[14px] p-5 flex flex-col gap-2.5"
            >
              <span className="text-[#142033]">
                <Icono nombre={h.icono} size={26} />
              </span>
              <span className="font-semibold text-[14.5px]">{h.nombre}</span>
              <span className="text-[12.5px] font-semibold text-[#6B6A63]">
                Próximamente
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Aprendizaje CNC: artículos reales, solo si ya hay contenido publicado */}
      {articulosAprendizaje.length > 0 && (
        <section className="px-4 lg:px-16 pb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[20px] font-semibold m-0">
              Aprendizaje CNC
            </h2>
            <LocalizedClientLink
              href="/servicios/aprendizaje-cnc"
              className="text-[13.5px] font-semibold text-[#B34D07] hover:underline"
            >
              Ver todo
            </LocalizedClientLink>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articulosAprendizaje.map((a) => (
              <LocalizedClientLink
                key={a.id}
                href={`/aprendizaje-cnc/${a.slug}`}
                className="group bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col hover:border-[#C2560A] hover:shadow-[0_8px_24px_rgba(27,27,24,0.08)] transition"
              >
                {a.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.cover_image_url}
                    alt={a.title}
                    className="w-full aspect-video object-cover"
                  />
                )}
                <div className="p-4 flex flex-col gap-2">
                  <h3 className="font-display text-[15.5px] font-bold m-0 text-[#1B1B18] line-clamp-2">
                    {a.title}
                  </h3>
                  <p className="m-0 text-[13px] text-[#6B6A63] leading-relaxed line-clamp-2">
                    {a.excerpt}
                  </p>
                </div>
              </LocalizedClientLink>
            ))}
          </div>
        </section>
      )}

      {/* Banner proyecto a la medida */}
      <section className="mx-4 lg:mx-16 mb-10 bg-[#142033] rounded-[20px] px-6 py-8 lg:px-12 lg:py-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
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

      {/* Franja de confianza */}
      <section className="px-4 lg:px-16 pb-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {confianza.map((c) => (
          <div key={c.texto} className="flex items-center gap-3">
            <span className="text-[#16794F] shrink-0">
              <Icono nombre={c.icono} size={26} />
            </span>
            <span className="text-[13px] font-medium">{c.texto}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
