"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"
import { ESCANEAR, HERRAMIENTAS_DISENO, buscarHerramientaDiseno } from "@/lib/hetna/disenar"

// Menú del espacio "Diseñar y escanear". En pantallas grandes es una columna
// a la izquierda; en tableta y celular, una fila que se desliza arriba de la
// herramienta. Las dos versiones marcan la herramienta abierta. (La columna no
// es "sticky" porque el encabezado del sitio ya lo es y la taparía.)

const GENERADORES = HERRAMIENTAS_DISENO.filter((h) => h.slug !== ESCANEAR)
const ESCANEO = buscarHerramientaDiseno(ESCANEAR)!

// /mx/disenar/caja-con-juntas → "caja-con-juntas"; /mx/disenar → ""
const useActiva = () => {
  const ruta = usePathname() || ""
  const partes = ruta.split("/")
  const i = partes.indexOf("disenar")
  return i >= 0 ? partes[i + 1] || "" : ""
}

export const MigasDisenar = () => {
  const activa = useActiva()
  const h = activa ? buscarHerramientaDiseno(activa) : undefined
  return (
    <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B6A63]">
      <LocalizedClientLink href="/" className="hover:text-[#B34D07]">
        Inicio
      </LocalizedClientLink>
      <span>/</span>
      <LocalizedClientLink href="/herramientas-cnc" className="hover:text-[#B34D07]">
        Herramientas CNC
      </LocalizedClientLink>
      <span>/</span>
      {h ? (
        <>
          <LocalizedClientLink href="/disenar" className="hover:text-[#B34D07]">
            Diseñar y escanear
          </LocalizedClientLink>
          <span>/</span>
          <span className="font-medium text-[#1B1B18]">{h.nombre}</span>
        </>
      ) : (
        <span className="font-medium text-[#1B1B18]">Diseñar y escanear</span>
      )}
    </nav>
  )
}

const Opcion = ({ slug, nombre, icono, activa }: { slug: string; nombre: string; icono: string; activa: boolean }) => (
  <LocalizedClientLink
    href={slug ? `/disenar/${slug}` : "/disenar"}
    aria-current={activa ? "page" : undefined}
    className={`flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[14px] ${
      activa ? "bg-[#FDEEE1] font-semibold text-[#B34D07]" : "text-[#1B1B18] hover:bg-[#F3F1EA]"
    }`}
  >
    <span className={activa ? "text-[#B34D07]" : "text-[#C2560A]"}>
      <ServicioIcono nombre={icono} size={18} />
    </span>
    {nombre}
  </LocalizedClientLink>
)

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 pt-4 pb-1 text-[11.5px] font-semibold uppercase tracking-wide text-[#8A877D]">{children}</p>
)

// Columna izquierda (pantallas grandes)
export const ColumnaDisenar = () => {
  const activa = useActiva()
  return (
    <aside className="hidden xl:block border-r border-[#E7E4DC] bg-white">
      <nav aria-label="Herramientas para diseñar y escanear" className="p-3 pb-8">
        <Opcion slug="" nombre="Todas" icono="generador" activa={activa === ""} />
        <Titulo>Generar un archivo</Titulo>
        {GENERADORES.map((h) => (
          <Opcion key={h.slug} slug={h.slug} nombre={h.nombre} icono={h.icono} activa={activa === h.slug} />
        ))}
        <Titulo>De una pieza que ya existe</Titulo>
        <Opcion slug={ESCANEO.slug} nombre={ESCANEO.nombre} icono={ESCANEO.icono} activa={activa === ESCANEO.slug} />

        <div className="mt-5 rounded-[12px] border border-[#E7E4DC] bg-[#FAF9F6] p-3">
          <p className="text-[13px] font-semibold text-[#1B1B18]">¿Ya tienes el archivo?</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#6B6A63]">Pásalo a G-code con el avance y las revoluciones calculados.</p>
          <LocalizedClientLink href="/cam/subir" className="mt-2 inline-block text-[13px] font-semibold text-[#B34D07] hover:underline">
            DXF a G-code
          </LocalizedClientLink>
        </div>
        <div className="mt-3 rounded-[12px] border border-[#E7E4DC] bg-[#FAF9F6] p-3">
          <p className="text-[13px] font-semibold text-[#1B1B18]">¿No tienes máquina?</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#6B6A63]">Talleres CNC de todo México te cotizan la pieza.</p>
          <LocalizedClientLink href="/fabricacion" className="mt-2 inline-block text-[13px] font-semibold text-[#B34D07] hover:underline">
            Te fabricamos tu pieza
          </LocalizedClientLink>
        </div>
      </nav>
    </aside>
  )
}

// Fila deslizable (tableta y celular)
export const FilaDisenar = () => {
  const activa = useActiva()
  const fila = useRef<HTMLDivElement>(null)

  // Deja la herramienta abierta a la vista, sin mover la página hacia abajo
  useEffect(() => {
    const c = fila.current
    const el = c?.querySelector<HTMLElement>("[aria-current='page']")
    if (c && el) c.scrollLeft = el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2
  }, [activa])

  const todas = [{ slug: "", nombre: "Todas", icono: "generador" }, ...HERRAMIENTAS_DISENO]
  return (
    <nav aria-label="Herramientas para diseñar y escanear" className="xl:hidden border-b border-[#E7E4DC] bg-white">
      <div ref={fila} className="flex gap-2 overflow-x-auto px-4 lg:px-8 py-2.5 [scrollbar-width:none]">
        {todas.map((h) => {
          const es = activa === h.slug
          return (
            <LocalizedClientLink
              key={h.slug || "todas"}
              href={h.slug ? `/disenar/${h.slug}` : "/disenar"}
              aria-current={es ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap ${
                es ? "border-[#C2560A] bg-[#C2560A] text-white" : "border-[#E7E4DC] bg-white text-[#1B1B18]"
              }`}
            >
              <ServicioIcono nombre={h.icono} size={16} />
              {h.nombre}
            </LocalizedClientLink>
          )
        })}
      </div>
    </nav>
  )
}
