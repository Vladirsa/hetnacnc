import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { ServicioIcono } from "./ServicioIcono"
import { SERVICIOS_PRINCIPALES, subServicios } from "./servicios-datos"

// Barra azul marino: Tienda (con sus categorias) y los servicios de HETNA CNC.
// En computadora los menus se abren al pasar el mouse; en celular la barra
// se desliza de lado y cada boton lleva a la pagina del servicio.

const ENLACE =
  "h-full flex items-center gap-1 text-white text-[13.5px] font-medium hover:text-[#F2A65A] shrink-0"

const Flecha = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="hidden lg:block opacity-70">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const Menu = ({
  etiqueta,
  href,
  ancho = "min-w-[260px]",
  children,
}: {
  etiqueta: string
  href: string
  ancho?: string
  children: React.ReactNode
}) => (
  <div className="group relative h-full flex items-center shrink-0">
    <LocalizedClientLink href={href} className={ENLACE}>
      {etiqueta}
      <Flecha />
    </LocalizedClientLink>
    <div
      className={`hidden lg:group-hover:block lg:group-focus-within:block absolute left-0 top-full ${ancho} bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-2 whitespace-normal`}
    >
      {children}
    </div>
  </div>
)

const OpcionMenu = ({
  href,
  icono,
  titulo,
  texto,
}: {
  href: string
  icono?: string
  titulo: string
  texto?: string
}) => (
  <LocalizedClientLink
    href={href}
    className="flex gap-3 items-start rounded-[8px] px-3 py-2.5 hover:bg-[#FAF6EF]"
  >
    {icono && (
      <span className="mt-0.5 text-[#C2560A] shrink-0">
        <ServicioIcono nombre={icono} size={20} />
      </span>
    )}
    <span className="flex flex-col">
      <span className="text-[13.5px] font-semibold text-[#1B1B18]">{titulo}</span>
      {texto && <span className="text-[12px] text-[#6B6A63] leading-snug">{texto}</span>}
    </span>
  </LocalizedClientLink>
)

export const ServiciosNav = ({
  categorias,
}: {
  categorias: HttpTypes.StoreProductCategory[]
}) => (
  <nav
    aria-label="Servicios"
    className="relative z-40 bg-[#142033] px-4 lg:px-8 xl:px-16 h-[46px] flex items-center gap-6 lg:gap-5 xl:gap-7 overflow-x-auto lg:overflow-visible scrollbar-hide whitespace-nowrap"
  >
    <Menu etiqueta="Tienda" href="/categories" ancho="w-[440px]">
      <div className="grid grid-cols-2 gap-x-2">
        {categorias.map((c) => (
          <LocalizedClientLink
            key={c.id}
            href={`/categories/${c.handle}`}
            className="rounded-[8px] px-3 py-2 text-[13.5px] text-[#1B1B18] hover:bg-[#FAF6EF] hover:text-[#B34D07]"
          >
            {c.name}
          </LocalizedClientLink>
        ))}
      </div>
      <LocalizedClientLink
        href="/categories"
        className="mt-1 block border-t border-[#E7E4DC] px-3 pt-2.5 pb-1.5 text-[13px] font-semibold text-[#B34D07] hover:underline"
      >
        Ver todo el catálogo
      </LocalizedClientLink>
    </Menu>

    {SERVICIOS_PRINCIPALES.map((s) => {
      const hijos = subServicios(s.slug)
      if (!hijos.length) {
        return (
          <LocalizedClientLink key={s.slug} href={`/servicios/${s.slug}`} className={ENLACE}>
            {s.nombre}
          </LocalizedClientLink>
        )
      }
      return (
        <Menu key={s.slug} etiqueta={s.nombre} href={`/servicios/${s.slug}`} ancho="w-[320px]">
          <OpcionMenu href={`/servicios/${s.slug}`} icono={s.icono} titulo={s.nombre} texto={s.resumen} />
          {hijos.map((h) => (
            <OpcionMenu
              key={h.slug}
              href={`/servicios/${h.slug}`}
              icono={h.icono}
              titulo={h.nombre}
              texto={h.resumen}
            />
          ))}
        </Menu>
      )
    })}

    <span className="flex-1" />
    <a
      href="/seller"
      className="shrink-0 bg-[#C2560A] hover:bg-[#A84A08] text-white text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full"
    >
      Vende con nosotros
    </a>
  </nav>
)
