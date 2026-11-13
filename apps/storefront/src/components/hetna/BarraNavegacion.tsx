import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { CerrarMenus } from "./CerrarMenus"
import { ServicioIcono } from "./ServicioIcono"
import { GRUPOS_HERRAMIENTAS } from "@/lib/hetna/herramientas"
import { FABRICACION, FABRICACION_EXTRA } from "@/lib/hetna/navegacion"

// Barra de navegación HETNA (sólo computadora, desde lg). Cinco secciones:
// Categorías, Fabricación (por tipo de proceso), Herramientas CNC, Talleres y
// Foro CNC, más los accesos rápidos "Cotizar un trabajo" y "Vende con
// nosotros". Los menús se abren al pasar el mouse o con el teclado (focus).
// En celular y tableta el menú es MenuMovil (problema 5 de la auditoría: antes
// esta barra dibujaba además su propia versión de tableta y el árbol de
// categorías salía repetido en el HTML).

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
  const primero = raices[0]?.grupos[0]?.id
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
                    {/* El panel del primer grupo se ve mientras no hay otro con el
                        mouse encima (antes se dibujaba dos veces). */}
                    <div
                      className={
                        "hidden [.grupo:hover_&]:block absolute left-[240px] top-0 bottom-0 right-0 z-10 bg-white pl-3 overflow-y-auto" +
                        (g.id === primero ? " [.mega:not(:has(.grupo:hover))_&]:block" : "")
                      }
                    >
                      <PanelHojas g={g} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
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
    <LocalizedClientLink
      href="/herramientas-cnc"
      className="flex items-center justify-between rounded-[8px] px-3 py-2.5 text-[13.5px] font-bold text-[#B34D07] hover:bg-[#FAF6EF]"
    >
      Todas las herramientas
      <FlechaDerecha />
    </LocalizedClientLink>
    {GRUPOS_HERRAMIENTAS.map((g) => (
      <OpcionHerramienta
        key={g.id}
        href={g.href ?? `/herramientas-cnc#${g.id}`}
        icono={g.icono}
        titulo={g.titulo}
        texto={g.herramientas.map((h) => h.nombre).slice(0, 3).join(" · ")}
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

const MenuFabricacion = () => (
  <div className="group relative h-full flex items-center shrink-0">
    <span tabIndex={0} className={ENLACE + " cursor-default"}>
      Fabricación
      <Flecha />
    </span>
    <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full w-[620px] bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-4 whitespace-normal">
      <div className="grid grid-cols-4 gap-4">
        {FABRICACION.map((g) => (
          <div key={g.titulo}>
            <p className="pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A887F]">{g.titulo}</p>
            {g.enlaces.map((e) => (
              <LocalizedClientLink key={e.href} href={e.href} className="block rounded-[8px] py-1.5 text-[13.5px] text-[#1B1B18] hover:text-[#B34D07]">
                {e.texto}
              </LocalizedClientLink>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#E7E4DC] pt-3">
        {FABRICACION_EXTRA.map((e) => (
          <LocalizedClientLink key={e.href} href={e.href} className="text-[13px] font-semibold text-[#B34D07] hover:underline">
            {e.texto}
          </LocalizedClientLink>
        ))}
        <LocalizedClientLink href="/cotizar" className="ml-auto rounded-full bg-[#142033] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#1E2E47]">
          Cotizar un trabajo
        </LocalizedClientLink>
      </div>
    </div>
  </div>
)


export const BarraNavegacion = ({
  categorias,
}: {
  categorias: HttpTypes.StoreProductCategory[]
}) => {
  // "Servicios" no va en Categorías: sus páginas están en el menú Fabricación
  const raices = armarRaices(categorias.filter((c) => c.handle !== "servicios"))

  return (
    <>
      <CerrarMenus />
      <nav
        aria-label="Principal"
        className="relative z-40 hidden lg:flex bg-[#142033] px-4 lg:px-8 xl:px-16 h-[46px] items-center gap-7"
      >
        <MegaCategorias raices={raices} />
        <MenuFabricacion />
        <MenuHerramientas />
        <LocalizedClientLink href="/talleres" className={ENLACE}>Talleres</LocalizedClientLink>
        <LocalizedClientLink href="/foro-cnc" className={ENLACE}>Foro CNC</LocalizedClientLink>
        <span className="flex-1" />
        <LocalizedClientLink
          href="/cotizar"
          className="shrink-0 border border-white/40 hover:bg-white/10 text-white text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full"
        >
          Cotizar un trabajo
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/talleres/unete"
          className="shrink-0 bg-[#C2560A] hover:bg-[#A84A08] text-white text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full"
        >
          Vende con nosotros
        </LocalizedClientLink>
      </nav>
    </>
  )
}
