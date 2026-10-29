"use client"

// Barra del foro: siempre a la vista, pegada abajo del encabezado del sitio,
// en todas las páginas del foro. Así nadie se pierde al entrar a Mi red, a un
// perfil o a Empleos: un clic y está de vuelta en el foro.
//
// El encabezado del sitio también es fijo y su alto cambia (celular, menú),
// así que se mide y se publica en --foro-top para que las columnas laterales
// del foro empiecen justo debajo de esta barra.
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// [ruta, nombre, nombre corto para celular]
const LIGAS = [
  ["/foro-cnc", "Foro", "Foro"],
  ["/foro-cnc/red", "Mi red", "Mi red"],
  ["/foro-cnc/empleos", "Empleos y proyectos", "Empleos"],
  ["/foro-cnc/blog", "Blog y guías", "Blog"],
  ["/foro-cnc/mi-perfil", "Mi perfil", "Perfil"],
] as const

export function BarraForo() {
  const ruta = usePathname() || ""
  const barra = useRef<HTMLDivElement>(null)
  // "/mx/foro-cnc/red?x" -> "/foro-cnc/red"
  const actual = ruta.replace(/^\/[a-z]{2}(?=\/)/, "")
  const activa = (href: string) => (href === "/foro-cnc" ? actual === "/foro-cnc" : actual.startsWith(href))

  useEffect(() => {
    const encabezado = document.querySelector<HTMLElement>('header[data-testid="header"]')
    const medir = () => {
      const alto = encabezado ? encabezado.getBoundingClientRect().height : 0
      if (barra.current) barra.current.style.top = `${alto}px`
      const total = alto + (barra.current?.offsetHeight || 0) + 12
      document.documentElement.style.setProperty("--foro-top", `${Math.round(total)}px`)
    }
    medir()
    const obs = new ResizeObserver(medir)
    if (encabezado) obs.observe(encabezado)
    window.addEventListener("resize", medir)
    return () => {
      obs.disconnect()
      window.removeEventListener("resize", medir)
      document.documentElement.style.removeProperty("--foro-top")
    }
  }, [])

  return (
    <div ref={barra} className="sticky top-0 z-40 border-b border-[#E7E4DC] bg-white/95 backdrop-blur">
      <nav aria-label="Foro CNC" className="mx-auto flex max-w-[1180px] items-center gap-2 px-4">
        <ul className="m-0 flex min-w-0 flex-1 list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none]">
          {LIGAS.map(([href, nombre, corto]) => (
            <li key={href} className="shrink-0">
              <LocalizedClientLink
                href={href}
                aria-current={activa(href) ? "page" : undefined}
                className={`block border-b-[3px] px-2.5 sm:px-3 py-2.5 text-[14px] font-semibold whitespace-nowrap ${
                  activa(href) ? "border-[#C2560A] text-[#1B1B18]" : "border-transparent text-[#6B6A63] hover:text-[#1B1B18]"
                }`}
              >
                {href === "/foro-cnc" && !activa(href) ? (
                  "← Foro"
                ) : (
                  <>
                    <span className="sm:hidden">{corto}</span>
                    <span className="hidden sm:inline">{nombre}</span>
                  </>
                )}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
        <LocalizedClientLink
          href="/foro-cnc/nuevo"
          className="shrink-0 rounded-full bg-[#C2560A] px-3.5 py-1.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08]"
        >
          + Publicar
        </LocalizedClientLink>
      </nav>
    </div>
  )
}
