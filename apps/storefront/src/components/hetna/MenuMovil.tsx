"use client"

// Menú de 3 rayitas para celular y tableta (hasta lg). Problema 5 de la
// auditoría: más compacto y sin inflar el HTML.
//
//   - Arriba, los accesos rápidos (cotizar, precio al instante, calculadora).
//   - Luego las cinco secciones del menú principal: Categorías, Fabricación
//     (por tipo de proceso), Herramientas CNC, Talleres y Foro CNC.
//   - Los árboles (categorías, fabricación, herramientas) se dibujan SÓLO
//     cuando se abre; antes va un primer nivel ligero de enlaces. Antes el árbol
//     completo de categorías iba en el HTML de cada página aunque nadie
//     abriera el menú (los buscadores ya lo leen en la barra de computadora).
//
// La casilla oculta sigue abriendo el panel con CSS; CerrarMenus la desmarca
// al cambiar de página.
import { useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ACCESOS_RAPIDOS, FABRICACION, FABRICACION_EXTRA } from "@/lib/hetna/navegacion"

import { CerrarMenus } from "./CerrarMenus"
import { ServicioIcono } from "./ServicioIcono"

// Árbol mínimo de categorías (nombre, handle, hijos): lo arma HetnaHeader
export type NodoMenu = { n: string; h: string; c: NodoMenu[] }
// Herramientas reducidas a lo que el menú muestra (también desde HetnaHeader):
// así los datos completos de lib/hetna/herramientas no viajan al navegador.
export type HerramientaMenu = { id: string; titulo: string; href: string; icono: string }

const Flecha = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="opacity-60 shrink-0">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const Rama = ({ c, nivel }: { c: NodoMenu; nivel: number }) => {
  const sangria = { paddingLeft: 16 + nivel * 14 }
  if (!c.c.length) {
    return (
      <LocalizedClientLink href={"/categories/" + c.h} style={sangria} className="block py-2.5 pr-4 text-[14px] text-[#1B1B18]">
        {c.n}
      </LocalizedClientLink>
    )
  }
  return (
    <details>
      <summary
        style={sangria}
        className="flex cursor-pointer list-none items-center justify-between py-3 pr-4 text-[14.5px] font-semibold text-[#142033] [&::-webkit-details-marker]:hidden"
      >
        {c.n}
        <Flecha />
      </summary>
      <div className="bg-[#FAF6EF]">
        <LocalizedClientLink
          href={"/categories/" + c.h}
          style={{ paddingLeft: 16 + (nivel + 1) * 14 }}
          className="block py-2.5 pr-4 text-[13.5px] font-bold text-[#B34D07]"
        >
          Ver todo en {c.n}
        </LocalizedClientLink>
        {c.c.map((h) => (
          <Rama key={h.h} c={h} nivel={nivel + 1} />
        ))}
      </div>
    </details>
  )
}

const ENLACE_SIMPLE = "block border-b border-[#E7E4DC] px-4 py-4 text-[15px] font-bold text-[#142033]"
const TITULO_ACORDEON =
  "flex cursor-pointer list-none items-center justify-between border-b border-[#E7E4DC] px-4 py-4 text-[15px] font-bold text-[#142033] [&::-webkit-details-marker]:hidden"

// Primer nivel, siempre en la página: así el panel nunca sale vacío aunque el
// JavaScript no haya cargado (o falle). Al abrirlo con JS se cambia por el
// menú completo con acordeones.
const Ligero = () => (
  <div className="flex-1 overflow-y-auto">
    <div className="grid grid-cols-3 gap-2 border-b border-[#E7E4DC] bg-[#FAF6EF] p-3">
      {ACCESOS_RAPIDOS.map((a) => (
        <LocalizedClientLink key={a.href} href={a.href} className="rounded-[10px] bg-white p-2.5 text-center shadow-sm">
          <span className="block text-[13px] font-bold leading-tight text-[#142033]">{a.texto}</span>
        </LocalizedClientLink>
      ))}
    </div>
    <LocalizedClientLink href="/categories" className={ENLACE_SIMPLE}>Categorías</LocalizedClientLink>
    <LocalizedClientLink href="/fabricacion" className={ENLACE_SIMPLE}>Fabricación</LocalizedClientLink>
    <LocalizedClientLink href="/herramientas-cnc" className={ENLACE_SIMPLE}>Herramientas CNC</LocalizedClientLink>
    <LocalizedClientLink href="/talleres" className={ENLACE_SIMPLE}>Talleres</LocalizedClientLink>
    <LocalizedClientLink href="/foro-cnc" className={ENLACE_SIMPLE}>Foro CNC</LocalizedClientLink>
  </div>
)

const Contenido = ({ arbol, herramientas }: { arbol: NodoMenu[]; herramientas: HerramientaMenu[] }) => (
  <div className="flex-1 overflow-y-auto">
    {/* Accesos rápidos */}
    <div className="grid grid-cols-3 gap-2 border-b border-[#E7E4DC] bg-[#FAF6EF] p-3">
      {ACCESOS_RAPIDOS.map((a) => (
        <LocalizedClientLink key={a.href} href={a.href} className="rounded-[10px] bg-white p-2.5 text-center shadow-sm active:bg-[#F4F1EA]">
          <span className="block text-[13px] font-bold leading-tight text-[#142033]">{a.texto}</span>
          {a.detalle && <span className="mt-0.5 block text-[11px] leading-tight text-[#6B6A63]">{a.detalle}</span>}
        </LocalizedClientLink>
      ))}
    </div>

    <details>
      <summary className={TITULO_ACORDEON}>
        Categorías
        <Flecha />
      </summary>
      <div className="border-b border-[#E7E4DC]">
        <LocalizedClientLink href="/categories" className="block px-4 py-3 text-[14px] font-bold text-[#B34D07]">
          Ver todo el catálogo
        </LocalizedClientLink>
        {arbol.map((c) => (
          <Rama key={c.h} c={c} nivel={0} />
        ))}
      </div>
    </details>

    <details>
      <summary className={TITULO_ACORDEON}>
        Fabricación
        <Flecha />
      </summary>
      <div className="border-b border-[#E7E4DC] bg-[#FAF6EF] px-4 py-2">
        {FABRICACION.map((g) => (
          <div key={g.titulo} className="py-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8A887F]">{g.titulo}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {g.enlaces.map((e) => (
                <LocalizedClientLink key={e.href} href={e.href} className="rounded-full border border-[#E7E4DC] bg-white px-3 py-1.5 text-[13px] text-[#142033]">
                  {e.texto}
                </LocalizedClientLink>
              ))}
            </div>
          </div>
        ))}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#E7E4DC] py-2">
          {FABRICACION_EXTRA.map((e) => (
            <LocalizedClientLink key={e.href} href={e.href} className="text-[13.5px] font-semibold text-[#B34D07]">
              {e.texto}
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </details>

    <details>
      <summary className={TITULO_ACORDEON}>
        Herramientas CNC
        <Flecha />
      </summary>
      <div className="border-b border-[#E7E4DC] p-2">
        <LocalizedClientLink href="/herramientas-cnc" className="block rounded-[8px] px-3 py-2.5 text-[14px] font-bold text-[#B34D07] active:bg-[#FAF6EF]">
          Todas las herramientas
        </LocalizedClientLink>
        {herramientas.map((g) => (
          <LocalizedClientLink key={g.id} href={g.href} className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 active:bg-[#FAF6EF]">
            <span className="shrink-0 text-[#C2560A]">
              <ServicioIcono nombre={g.icono} size={18} />
            </span>
            <span className="text-[14px] font-semibold text-[#1B1B18]">{g.titulo}</span>
          </LocalizedClientLink>
        ))}
      </div>
    </details>

    <LocalizedClientLink href="/talleres" className={ENLACE_SIMPLE}>
      Talleres
    </LocalizedClientLink>
    <LocalizedClientLink href="/foro-cnc" className={ENLACE_SIMPLE}>
      Foro CNC
    </LocalizedClientLink>

    <LocalizedClientLink href="/talleres/unete" className="mx-4 my-5 block rounded-full bg-[#C2560A] py-3 text-center text-[14.5px] font-bold text-white">
      Vende con nosotros
    </LocalizedClientLink>
  </div>
)

export const MenuMovil = ({ arbol, herramientas }: { arbol: NodoMenu[]; herramientas: HerramientaMenu[] }) => {
  // Se dibuja la primera vez que se abre y se queda (abrir de nuevo es instantáneo)
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="lg:hidden shrink-0">
      <CerrarMenus />
      <input
        id="mm-menu"
        type="checkbox"
        data-menu-movil
        className="peer sr-only"
        onChange={(e) => e.target.checked && setAbierto(true)}
      />

      {/* El nombre va como texto oculto: aria-label no está permitido en <label> */}
      <label htmlFor="mm-menu" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-[#142033] active:bg-[#F4F1EA]">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="sr-only">Abrir menú</span>
      </label>

      <div className="fixed inset-0 z-[80] hidden flex-col bg-white peer-checked:flex">
        <div className="flex items-center justify-between bg-[#142033] px-4 py-3 text-white">
          <span className="text-[16px] font-bold">Menú</span>
          <label htmlFor="mm-menu" className="cursor-pointer p-2 text-[20px] leading-none">
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Cerrar menú</span>
          </label>
        </div>
        {abierto ? <Contenido arbol={arbol} herramientas={herramientas} /> : <Ligero />}
      </div>
    </div>
  )
}
