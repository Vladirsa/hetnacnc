import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { CerrarMenus } from "./CerrarMenus"
import { ServicioIcono } from "./ServicioIcono"
import { SERVICIOS_PRINCIPALES } from "./servicios-datos"

// Menú de 3 rayitas para celular: contiene TODO lo de la barra azul
// (categorías, servicios, herramientas CNC, foro, talleres, envíos).
// No usa JavaScript propio: es una casilla oculta que abre un panel a pantalla
// completa; CerrarMenus lo cierra solo al cambiar de página.

type Cat = HttpTypes.StoreProductCategory

const hijosDe = (c: Cat): Cat[] => (c.category_children as Cat[] | undefined) ?? []

const Flecha = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="opacity-60 shrink-0">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

// Una categoría; si tiene subcategorías se abre como acordeón (cualquier nivel)
const Rama = ({ c, nivel }: { c: Cat; nivel: number }) => {
  const hijos = hijosDe(c)
  const sangria = { paddingLeft: 16 + nivel * 14 }
  if (!hijos.length) {
    return (
      <LocalizedClientLink
        href={"/categories/" + c.handle}
        style={sangria}
        className="block py-2.5 pr-4 text-[14px] text-[#1B1B18]"
      >
        {c.name}
      </LocalizedClientLink>
    )
  }
  return (
    <details>
      <summary
        style={sangria}
        className="flex cursor-pointer list-none items-center justify-between py-3 pr-4 text-[14.5px] font-semibold text-[#142033] [&::-webkit-details-marker]:hidden"
      >
        {c.name}
        <Flecha />
      </summary>
      <div className="bg-[#FAF6EF]">
        <LocalizedClientLink
          href={"/categories/" + c.handle}
          style={{ paddingLeft: 16 + (nivel + 1) * 14 }}
          className="block py-2.5 pr-4 text-[13.5px] font-bold text-[#B34D07]"
        >
          Ver todo en {c.name}
        </LocalizedClientLink>
        {hijos.map((h) => (
          <Rama key={h.id} c={h} nivel={nivel + 1} />
        ))}
      </div>
    </details>
  )
}

const ENLACE_SIMPLE =
  "block border-b border-[#E7E4DC] px-4 py-4 text-[15px] font-bold text-[#142033]"

const TITULO_ACORDEON =
  "flex cursor-pointer list-none items-center justify-between border-b border-[#E7E4DC] px-4 py-4 text-[15px] font-bold text-[#142033] [&::-webkit-details-marker]:hidden"

export const MenuMovil = ({ categorias }: { categorias: Cat[] }) => {

  return (
    <div className="md:hidden shrink-0">
      <CerrarMenus />
      <input id="mm-menu" type="checkbox" data-menu-movil className="peer sr-only" />

      {/* Botón de 3 rayitas junto al logo */}
      <label
        htmlFor="mm-menu"
        aria-label="Abrir menú"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-[#142033] active:bg-[#F4F1EA]"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </label>

      {/* Panel a pantalla completa */}
      <div className="fixed inset-0 z-[80] hidden flex-col bg-white peer-checked:flex">
        <div className="flex items-center justify-between bg-[#142033] px-4 py-3 text-white">
          <span className="text-[16px] font-bold">Menú</span>
          <label htmlFor="mm-menu" aria-label="Cerrar menú" className="cursor-pointer p-2 text-[20px] leading-none">
            ✕
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          <details className="group">
            <summary className={TITULO_ACORDEON}>
              Categorías
              <Flecha />
            </summary>
            <div className="border-b border-[#E7E4DC]">
              <LocalizedClientLink href="/categories" className="block px-4 py-3 text-[14px] font-bold text-[#B34D07]">
                Ver todo el catálogo
              </LocalizedClientLink>
              {categorias.map((c) => (
                <Rama key={c.id} c={c} nivel={0} />
              ))}
            </div>
          </details>

          {/* Fabricación: la página para quien quiere que le fabriquen algo
              (antes la categoría Servicios). Las herramientas digitales van
              abajo, en su propio acordeón. */}
          <LocalizedClientLink href="/fabricacion" className={ENLACE_SIMPLE}>
            Fabricación
          </LocalizedClientLink>

          <details>
            <summary className={TITULO_ACORDEON}>
              Herramientas CNC
              <Flecha />
            </summary>
            <div className="border-b border-[#E7E4DC] p-2">
              {SERVICIOS_PRINCIPALES.map((s) => (
                <LocalizedClientLink
                  key={s.slug}
                  href={"/servicios/" + s.slug}
                  className="flex items-start gap-3 rounded-[8px] px-3 py-2.5 active:bg-[#FAF6EF]"
                >
                  <span className="mt-0.5 shrink-0 text-[#C2560A]">
                    <ServicioIcono nombre={s.icono} size={20} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[14px] font-semibold text-[#1B1B18]">{s.nombre}</span>
                    <span className="text-[12px] leading-snug text-[#6B6A63]">{s.resumen}</span>
                  </span>
                </LocalizedClientLink>
              ))}
            </div>
          </details>

          <LocalizedClientLink href="/foro-cnc" className={ENLACE_SIMPLE}>
            Foro CNC
          </LocalizedClientLink>
          <LocalizedClientLink href="/cam" className={ENLACE_SIMPLE}>
            Laboratorio CAM
          </LocalizedClientLink>
          <LocalizedClientLink href="/talleres" className={ENLACE_SIMPLE}>
            Talleres
          </LocalizedClientLink>
          <LocalizedClientLink href="/servicios/envios-hetna" className={ENLACE_SIMPLE}>
            Envíos HETNA
          </LocalizedClientLink>

          <a
            href="/seller"
            className="mx-4 my-5 block rounded-full bg-[#C2560A] py-3 text-center text-[14.5px] font-bold text-white"
          >
            Vende con nosotros
          </a>
        </div>
      </div>
    </div>
  )
}
