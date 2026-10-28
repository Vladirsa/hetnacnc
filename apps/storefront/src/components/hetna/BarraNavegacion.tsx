import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { CerrarMenus } from "./CerrarMenus"
import { ServicioIcono } from "./ServicioIcono"
import { SERVICIOS_PRINCIPALES } from "./servicios-datos"

// Barra de navegacion HETNA: "Todas las categorias" (Tienda, Digital y
// Servicios juntas), Fabricación y Herramientas CNC. En computadora los menus
// se abren al pasar el mouse; en celular la barra cabe completa y cada boton
// abre un panel a pantalla completa con acordeones (sin JavaScript).

type Cat = HttpTypes.StoreProductCategory
type Grupo = { id: string; nombre: string; handle: string; hojas: Cat[]; esRaiz: boolean }
type Raiz = { id: string; nombre: string; handle: string; grupos: Grupo[] }

const hijosDe = (c: Cat): Cat[] => (c.category_children as Cat[] | undefined) ?? []

const armarRaices = (cats: Cat[]): Raiz[] =>
  cats
    .filter((r) => hijosDe(r).length > 0)
    .map((r) => {
      const hijos = hijosDe(r)
      const conNietos = hijos.some((h) => hijosDe(h).length > 0)
      const grupos: Grupo[] = conNietos
        ? hijos.map((h) => ({ id: h.id, nombre: h.name, handle: h.handle, hojas: hijosDe(h), esRaiz: false }))
        : [{ id: r.id, nombre: r.name, handle: r.handle, hojas: hijos, esRaiz: true }]
      return { id: r.id, nombre: r.name, handle: r.handle, grupos }
    })

const ENLACE =
  "h-full flex items-center gap-1 text-white text-[13.5px] font-bold hover:text-[#F2A65A] shrink-0"

const Hamburguesa = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const Flecha = ({ clase = "" }: { clase?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className={"opacity-70 shrink-0 " + clase}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const FlechaDerecha = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="opacity-60 shrink-0">
    <path d="M9 6l6 6-6 6" />
  </svg>
)

const PanelHojas = ({ g }: { g: Grupo }) => (
  <div className="flex flex-col">
    <LocalizedClientLink
      href={"/categories/" + g.handle}
      className="rounded-[8px] px-3 py-2 text-[13px] font-bold text-[#B34D07] hover:underline"
    >
      Ver todo en {g.nombre}
    </LocalizedClientLink>
    <div className="grid grid-cols-2 gap-x-2">
      {g.hojas.map((h) => (
        <LocalizedClientLink
          key={h.id}
          href={"/categories/" + h.handle}
          className="rounded-[8px] px-3 py-2 text-[13.5px] text-[#1B1B18] hover:bg-[#FAF6EF] hover:text-[#B34D07]"
        >
          {h.name}
        </LocalizedClientLink>
      ))}
    </div>
  </div>
)

// ---------- Computadora ----------

const MegaCategorias = ({ raices }: { raices: Raiz[] }) => {
  const primero = raices[0]?.grupos[0]
  return (
    <div className="group relative h-full flex items-center shrink-0">
      <button
        type="button"
        className="h-full flex items-center gap-2 px-4 text-white text-[13.5px] font-bold bg-white/10 hover:bg-white/15"
      >
        <Hamburguesa />
        Todas las categorías
      </button>
      <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full w-[720px] bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-2 whitespace-normal">
        <div className="mega relative flex min-h-[380px]">
          <div className="w-[240px] shrink-0 border-r border-[#E7E4DC] pr-1 pb-2">
            {raices.map((r) => (
              <div key={r.id}>
                <p className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A887F]">
                  {r.nombre}
                </p>
                {r.grupos.map((g) => (
                  <div key={g.id} className="grupo">
                    <LocalizedClientLink
                      href={"/categories/" + g.handle}
                      className="flex items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-[13.5px] font-bold text-[#1B1B18] hover:bg-[#FAF6EF] hover:text-[#B34D07]"
                    >
                      {g.esRaiz ? "Ver todos" : g.nombre}
                      <FlechaDerecha />
                    </LocalizedClientLink>
                    <div className="hidden [.grupo:hover_&]:block absolute left-[240px] top-0 bottom-0 right-0 z-10 bg-white pl-3 overflow-y-auto">
                      <PanelHojas g={g} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {primero && (
            <div className="absolute left-[240px] top-0 bottom-0 right-0 pl-3 overflow-y-auto [.mega:has(.grupo:hover)_&]:hidden">
              <PanelHojas g={primero} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const OpcionHerramienta = ({
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

const ListaHerramientas = () => (
  <>
    {SERVICIOS_PRINCIPALES.map((s) => (
      <OpcionHerramienta
        key={s.slug}
        href={"/servicios/" + s.slug}
        icono={s.icono}
        titulo={s.nombre}
        texto={s.resumen}
      />
    ))}
  </>
)

const MenuHerramientas = () => (
  <div className="group relative h-full flex items-center shrink-0">
    <span tabIndex={0} className={ENLACE + " cursor-default"}>
      Herramientas CNC
      <Flecha />
    </span>
    <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full w-[340px] bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-2 whitespace-normal">
      <ListaHerramientas />
    </div>
  </div>
)

// ---------- Celular ----------

const BotonVender = () => (
  <a
    href="/seller"
    className="mx-4 my-4 block rounded-full bg-[#C2560A] py-3 text-center text-[14px] font-bold text-white"
  >
    Vende con nosotros
  </a>
)

const AcordeonCategorias = ({ raices }: { raices: Raiz[] }) => (
  <>
    {raices.map((r) => (
      <details key={r.id} className="border-b border-[#E7E4DC]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-[15px] font-bold text-[#142033] [&::-webkit-details-marker]:hidden">
          {r.nombre}
          <Flecha />
        </summary>
        <div className="bg-[#FAF6EF] pb-2">
          {r.grupos.map((g) =>
            g.esRaiz ? (
              <div key={g.id} className="flex flex-col pl-4">
                <LocalizedClientLink href={"/categories/" + g.handle} className="px-4 py-2.5 text-[14px] font-bold text-[#B34D07]">
                  Ver todo en {g.nombre}
                </LocalizedClientLink>
                {g.hojas.map((h) => (
                  <LocalizedClientLink key={h.id} href={"/categories/" + h.handle} className="px-4 py-2.5 text-[14px] text-[#1B1B18]">
                    {h.name}
                  </LocalizedClientLink>
                ))}
              </div>
            ) : (
              <details key={g.id} className="pl-2">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold text-[#1B1B18] [&::-webkit-details-marker]:hidden">
                  {g.nombre}
                  <Flecha />
                </summary>
                <div className="flex flex-col pl-4 pb-1">
                  <LocalizedClientLink href={"/categories/" + g.handle} className="px-4 py-2 text-[13.5px] font-bold text-[#B34D07]">
                    Ver todo en {g.nombre}
                  </LocalizedClientLink>
                  {g.hojas.map((h) => (
                    <LocalizedClientLink key={h.id} href={"/categories/" + h.handle} className="px-4 py-2 text-[13.5px] text-[#1B1B18]">
                      {h.name}
                    </LocalizedClientLink>
                  ))}
                </div>
              </details>
            )
          )}
        </div>
      </details>
    ))}
  </>
)

const EncabezadoPanel = ({ titulo, para }: { titulo: string; para: string }) => (
  <div className="flex items-center justify-between bg-[#142033] px-4 py-3 text-white">
    <span className="text-[15px] font-bold">{titulo}</span>
    <label htmlFor={para} aria-label="Cerrar" className="cursor-pointer p-2 text-[18px] leading-none">
      ✕
    </label>
  </div>
)

export const BarraNavegacion = ({
  categorias,
}: {
  categorias: HttpTypes.StoreProductCategory[]
}) => {
  const raices = armarRaices(categorias)
  // "Fabricación" es la página para quien quiere que le fabriquen algo
  // (antes este botón decía Servicios y llevaba a la categoría). Las
  // herramientas digitales siguen en su propio menú.
  const hrefFabricacion = "/fabricacion"

  return (
    <>
      <CerrarMenus />

      {/* Computadora */}
      <nav
        aria-label="Principal"
        className="relative z-40 hidden lg:flex bg-[#142033] px-4 lg:px-8 xl:px-16 h-[46px] items-center gap-7"
      >
        <MegaCategorias raices={raices} />
        <LocalizedClientLink href={hrefFabricacion} className={ENLACE}>
          Fabricación
        </LocalizedClientLink>
        <MenuHerramientas />
        <LocalizedClientLink href="/foro-cnc" className={ENLACE}>
          Foro CNC
        </LocalizedClientLink>
        <LocalizedClientLink href="/cam" className={ENLACE}>Laboratorio CAM</LocalizedClientLink>
        <LocalizedClientLink href="/talleres" className={ENLACE}>Talleres</LocalizedClientLink>
        <LocalizedClientLink href="/servicios/envios-hetna" className={ENLACE}>Envíos HETNA</LocalizedClientLink>
        <span className="flex-1" />
        <a
          href="/seller"
          className="shrink-0 bg-[#C2560A] hover:bg-[#A84A08] text-white text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full"
        >
          Vende con nosotros
        </a>
      </nav>

      {/* Celular: barra de 3 botones que cabe completa */}
      <div className="lg:hidden">
        <input id="mm-cat" type="checkbox" data-menu-movil className="peer/cat sr-only" />
        <input id="mm-herr" type="checkbox" data-menu-movil className="peer/herr sr-only" />

        <nav aria-label="Principal" className="grid grid-cols-3 bg-[#142033] text-white text-[12px] font-bold">
          <label htmlFor="mm-cat" className="flex cursor-pointer items-center justify-center gap-1 py-3.5 active:bg-white/10">
            <Hamburguesa size={14} />
            Categorías
          </label>
          <LocalizedClientLink href={hrefFabricacion} className="flex items-center justify-center border-x border-white/10 py-3.5 active:bg-white/10">
            Fabricación
          </LocalizedClientLink>
          <label htmlFor="mm-herr" className="flex cursor-pointer items-center justify-center gap-1 py-3.5 active:bg-white/10">
            Herramientas
          </label>
          <LocalizedClientLink href="/foro-cnc" className="flex items-center justify-center border-l border-t border-white/10 py-3.5 active:bg-white/10">
            Foro
          </LocalizedClientLink>
          <LocalizedClientLink href="/talleres" className="flex items-center justify-center border-x border-t border-white/10 py-3.5 active:bg-white/10">Talleres</LocalizedClientLink>
          <LocalizedClientLink href="/servicios/envios-hetna" className="flex items-center justify-center border-t border-white/10 py-3.5 active:bg-white/10">Envíos</LocalizedClientLink>
        </nav>

        <div className="fixed inset-0 z-[70] hidden flex-col bg-white peer-checked/cat:flex">
          <EncabezadoPanel titulo="Categorías" para="mm-cat" />
          <div className="flex-1 overflow-y-auto">
            <AcordeonCategorias raices={raices} />
            <BotonVender />
          </div>
        </div>

        <div className="fixed inset-0 z-[70] hidden flex-col bg-white peer-checked/herr:flex">
          <EncabezadoPanel titulo="Herramientas CNC" para="mm-herr" />
          <div className="flex-1 overflow-y-auto p-2">
            <ListaHerramientas />
            <BotonVender />
          </div>
        </div>
      </div>
    </>
  )
}
