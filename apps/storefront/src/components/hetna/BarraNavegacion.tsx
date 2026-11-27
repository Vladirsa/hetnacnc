import { TS } from "@/i18n/TS"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { CerrarMenus } from "./CerrarMenus"
import { ServicioIcono } from "./ServicioIcono"
import { GRUPOS_HERRAMIENTAS } from "@/lib/hetna/herramientas"
import { FABRICACION, FABRICACION_EXTRA } from "@/lib/hetna/navegacion"
import type { MenuTienda } from "@/lib/hetna/tienda"

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
      <TS>Ver todo en</TS> {g.nombre}
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

// "Todos los productos": al hacer clic abre la lista completa (/categories);
// al pasar el mouse muestra las categorías de la tienda con su conteo real.
// Las que aún no tienen productos dicen "Próximamente" (catálogo honesto).
const MenuProductos = ({ tienda }: { tienda: MenuTienda | null }) => (
  <div className="group relative h-full flex items-center shrink-0">
    <LocalizedClientLink
      href="/categories"
      className="h-full flex items-center gap-2 px-4 text-white text-[13.5px] font-bold bg-white/10 hover:bg-white/15"
    >
      <Hamburguesa />
      <TS>Todos los productos</TS>
      {tienda && <Flecha />}
    </LocalizedClientLink>
    {tienda && (
      <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full w-[340px] bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-2 whitespace-normal">
        <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A887F]"><TS>Categorías</TS></p>
        {tienda.categorias.map((c) => (
          <LocalizedClientLink
            key={c.clave}
            href={"/tienda/" + c.clave}
            className="flex items-center justify-between gap-3 rounded-[8px] px-3 py-2.5 text-[13.5px] font-semibold text-[#1B1B18] hover:bg-[#FAF6EF] hover:text-[#B34D07]"
          >
            <span>{c.nombre}</span>
            {c.conteo > 0 ? (
              <span className="shrink-0 font-mono text-[12px] text-[#6B6A63]">{c.conteo}</span>
            ) : (
              <span className="shrink-0 rounded bg-[#FFF4EC] px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-[#A84303]"><TS>Próximamente</TS></span>
            )}
          </LocalizedClientLink>
        ))}
        <div className="mt-1 border-t border-[#E7E4DC] pt-1">
          <LocalizedClientLink
            href="/categories"
            className="flex items-center justify-between gap-2 rounded-[8px] px-3 py-2.5 text-[13.5px] font-bold text-[#B34D07] hover:bg-[#FAF6EF]"
          >
            <TS>Ver todos los productos (</TS>{tienda.total})
            <FlechaDerecha />
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/tienda"
            className="flex items-center justify-between gap-2 rounded-[8px] px-3 py-2.5 text-[13.5px] font-semibold text-[#1B1B18] hover:bg-[#FAF6EF]"
          >
            <TS>Ir a la tienda</TS>
            <FlechaDerecha />
          </LocalizedClientLink>
        </div>
      </div>
    )}
  </div>
)

const MegaCategorias = ({ raices, tienda }: { raices: Raiz[]; tienda: MenuTienda | null }) => {
  // Catálogo honesto: si ninguna categoría del catálogo tiene productos
  // anidados, el menú muestra las categorías de la tienda con su conteo
  if (!raices.length) return <MenuProductos tienda={tienda} />
  const primero = raices[0]?.grupos[0]?.id
  return (
    <div className="group relative h-full flex items-center shrink-0">
      {/* Al pasar el mouse abre el menú; al hacer clic, todos los productos */}
      <LocalizedClientLink
        href="/categories"
        className="h-full flex items-center gap-2 px-4 text-white text-[13.5px] font-bold bg-white/10 hover:bg-white/15"
      >
        <Hamburguesa />
        <TS>Todas las categorías</TS>
      </LocalizedClientLink>
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
            <LocalizedClientLink
              href="/categories"
              className="mt-2 flex items-center justify-between gap-2 rounded-[8px] border-t border-[#E7E4DC] px-3 py-3 text-[13.5px] font-bold text-[#B34D07] hover:bg-[#FAF6EF]"
            >
              <TS>Ver todos los productos</TS>{tienda ? ` (${tienda.total})` : ""}
              <FlechaDerecha />
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/tienda"
              className="flex items-center justify-between gap-2 rounded-[8px] px-3 py-2.5 text-[13.5px] font-semibold text-[#1B1B18] hover:bg-[#FAF6EF]"
            >
              <TS>Ver toda la tienda</TS>
              <FlechaDerecha />
            </LocalizedClientLink>
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
      <span className="text-[13.5px] font-semibold text-[#1B1B18]"><TS>{titulo}</TS></span>
      {texto && <span className="text-[12px] text-[#6B6A63] leading-snug"><TS>{texto}</TS></span>}
    </span>
  </LocalizedClientLink>
)

const ListaHerramientas = () => (
  <>
    <LocalizedClientLink
      href="/herramientas-cnc"
      className="flex items-center justify-between rounded-[8px] px-3 py-2.5 text-[13.5px] font-bold text-[#B34D07] hover:bg-[#FAF6EF]"
    >
      <TS>Todas las herramientas</TS>
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
      <TS>Herramientas CNC</TS>
      <Flecha />
    </span>
    <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full w-[340px] bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-2 whitespace-normal">
      <ListaHerramientas />
    </div>
  </div>
)

const MenuFabricacion = () => (
  <div className="group relative h-full flex items-center shrink-0">
    {/* Es enlace a /fabricacion (en pantallas táctiles el hover no es confiable)
        y el desplegable se abre al pasar el mouse o con el teclado. */}
    <LocalizedClientLink href="/fabricacion" className={ENLACE}>
      <TS>Fabricación</TS>
      <Flecha />
    </LocalizedClientLink>
    <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full w-[620px] bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-4 whitespace-normal">
      <div className="grid grid-cols-4 gap-4">
        {FABRICACION.map((g) => (
          <div key={g.titulo}>
            <p className="pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8A887F]"><TS>{g.titulo}</TS></p>
            {g.enlaces.map((e) => (
              <LocalizedClientLink key={e.href} href={e.href} className="block rounded-[8px] py-1.5 text-[13.5px] text-[#1B1B18] hover:text-[#B34D07]">
                <TS>{e.texto}</TS>
              </LocalizedClientLink>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#E7E4DC] pt-3">
        {FABRICACION_EXTRA.map((e) => (
          <LocalizedClientLink key={e.href} href={e.href} className="text-[13px] font-semibold text-[#B34D07] hover:underline">
            <TS>{e.texto}</TS>
          </LocalizedClientLink>
        ))}
        <LocalizedClientLink href="/cotizar" className="ml-auto rounded-full bg-[#142033] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#1E2E47]">
          <TS>Cotizar un trabajo</TS>
        </LocalizedClientLink>
      </div>
    </div>
  </div>
)


// Comunidad (auditoría del 21 nov 2026: "Aprendizaje · Foro · Cursos ·
// Recursos técnicos" agrupados, sin llenar la barra de enlaces sueltos)
const COMUNIDAD = [
  // Orden pedido por Vlado (23 nov 2026): primero el Foro, luego la Academia
  { href: "/foro-cnc", titulo: "Foro CNC", texto: "Pregunta y ayuda a otros talleres" },
  { href: "/servicios/aprendizaje-cnc", titulo: "Academia", texto: "Cursos, libros y recursos técnicos" },
  { href: "/cnc", titulo: "Guías CNC", texto: "Router, láser, plasma, aluminio, CAM y DXF" },
  { href: "/foro-cnc/blog", titulo: "Blog", texto: "Artículos y casos reales" },
]

const MenuComunidad = () => (
  <div className="group relative h-full flex items-center shrink-0">
    <LocalizedClientLink href="/foro-cnc" className={ENLACE}>
      <TS>Comunidad</TS>
      <Flecha />
    </LocalizedClientLink>
    <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full w-[300px] bg-white border border-[#E7E4DC] rounded-b-[12px] shadow-[0_12px_30px_rgba(15,24,38,0.18)] p-2 whitespace-normal">
      {COMUNIDAD.map((c) => (
        <LocalizedClientLink key={c.href} href={c.href} className="block rounded-[8px] px-3 py-2.5 hover:bg-[#FAF6EF]">
          <span className="block text-[13.5px] font-bold text-[#1B1B18]"><TS>{c.titulo}</TS></span>
          <span className="block text-[12.5px] text-[#6B6A63]"><TS>{c.texto}</TS></span>
        </LocalizedClientLink>
      ))}
    </div>
  </div>
)

export const BarraNavegacion = ({
  categorias,
  tienda = null,
}: {
  categorias: HttpTypes.StoreProductCategory[]
  tienda?: MenuTienda | null
}) => {
  // "Servicios" no va en Categorías: sus páginas están en el menú Fabricación
  const raices = armarRaices(categorias.filter((c) => c.handle !== "servicios"))

  return (
    <>
      <CerrarMenus />
      <nav
        aria-label="Principal"
        className="relative z-40 hidden lg:flex bg-[#142033] px-4 lg:px-8 xl:px-16 h-[46px] items-center gap-5 xl:gap-7"
      >
        <MegaCategorias raices={raices} tienda={tienda} />
        <MenuFabricacion />
        <MenuHerramientas />
        <LocalizedClientLink href="/talleres" className={ENLACE}><TS>Talleres</TS></LocalizedClientLink>
        <MenuComunidad />
        <span className="flex-1" />
        {/* Desde xl: entre 1024 y 1280 px no cabe (y ya está en Fabricación) */}
        <LocalizedClientLink
          href="/cotizar"
          className="hidden xl:inline-block shrink-0 border border-white/40 hover:bg-white/10 text-white text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full"
        >
          <TS>Cotizar un trabajo</TS>
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/talleres/unete"
          className="shrink-0 bg-[#C2560A] hover:bg-[#A84A08] text-white text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full"
        >
          <TS>Vende con nosotros</TS>
        </LocalizedClientLink>
      </nav>
    </>
  )
}
