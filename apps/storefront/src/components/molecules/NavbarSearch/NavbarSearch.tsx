"use client"

// Buscador del encabezado con autocompletado (problema 5 de la auditoría).
// Mientras escribes sugiere productos, categorías, servicios de fabricación,
// guías y herramientas (lib/hetna/buscar.ts). Enter sin elegir nada busca en
// la tienda (/<país>/categories?query=...).
//
// Accesible: combobox con lista (flechas, Enter, Escape) y anuncios ARIA.
import clsx from "clsx"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

import { SearchIcon } from "@/icons"
import { sugerencias, type Sugerencia } from "@/lib/hetna/buscar"

interface Props {
  className?: string
}

const ETIQUETA: Record<Sugerencia["tipo"], string> = {
  producto: "Producto",
  categoria: "Categoría",
  servicio: "Fabricación",
  guia: "Guía",
  herramienta: "Herramienta",
}

export const NavbarSearch = ({ className }: Props) => {
  const searchParams = useSearchParams()
  const ruta = usePathname()
  const router = useRouter()
  const id = useId()
  const [texto, setTexto] = useState(searchParams.get("query") || "")
  const [lista, setLista] = useState<Sugerencia[]>([])
  const [abierta, setAbierta] = useState(false)
  const [activa, setActiva] = useState(-1)
  const ultima = useRef(0)
  const caja = useRef<HTMLDivElement>(null)

  // País de la URL (/mx/...) para que la búsqueda no pierda el prefijo
  const pais = ruta?.match(/^\/([a-z]{2})(\/|$)/i)?.[1] || "mx"

  // Las sugerencias son una server action: un POST a la página actual. En
  // /<país>/user y /user/register nginx limita los POST a 10 por minuto (login,
  // infra/nginx/hetna-limites.conf): ahí no se piden, para no gastarle el cupo
  // de inicio de sesión a quien escribe en el buscador.
  const sinSugerencias = /^\/[a-z]{2}\/user(\/register)?\/?$/i.test(ruta || "")

  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2 || sinSugerencias) {
      setLista([])
      return
    }
    const n = ++ultima.current
    const t = setTimeout(async () => {
      const r = await sugerencias(q).catch(() => [])
      if (n === ultima.current) {
        setLista(r)
        setActiva(-1)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [texto, sinSugerencias])

  // Cerrar al tocar fuera
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false)
    }
    document.addEventListener("mousedown", fuera)
    return () => document.removeEventListener("mousedown", fuera)
  }, [])

  const ir = (href: string) => {
    setAbierta(false)
    router.push(`/${pais}${href}`)
  }

  const buscar = () => {
    const q = texto.trim()
    ir(q ? `/categories?query=${encodeURIComponent(q)}` : "/categories")
  }

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && lista.length) {
      e.preventDefault()
      setAbierta(true)
      setActiva((a) => (a + 1) % lista.length)
    } else if (e.key === "ArrowUp" && lista.length) {
      e.preventDefault()
      setActiva((a) => (a <= 0 ? lista.length - 1 : a - 1))
    } else if (e.key === "Escape") {
      setAbierta(false)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (abierta && activa >= 0 && lista[activa]) ir(lista[activa].href)
      else buscar()
    }
  }

  const mostrar = abierta && texto.trim().length >= 2 && lista.length > 0

  return (
    <div ref={caja} className={clsx("relative w-full", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
      >
        <div className="relative">
          <button
            type="submit"
            aria-label="Buscar"
            className="absolute left-[8px] top-1/2 flex h-[32px] w-[32px] -translate-y-1/2 items-center justify-center rounded-sm"
          >
            <SearchIcon />
          </button>
          <input
            type="search"
            role="combobox"
            aria-expanded={mostrar}
            aria-controls={`${id}-lista`}
            aria-autocomplete="list"
            aria-activedescendant={mostrar && activa >= 0 ? `${id}-op-${activa}` : undefined}
            aria-label="Buscar productos, servicios y herramientas"
            placeholder="Buscar productos y servicios"
            autoComplete="off"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setAbierta(true)
            }}
            onFocus={() => setAbierta(true)}
            onKeyDown={alTeclear}
            className="w-full rounded-sm border bg-component-secondary py-[12px] pl-[48px] pr-[16px] focus:border-primary focus:outline-none focus:ring-0"
          />
        </div>
      </form>

      {mostrar && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-[70vh] overflow-y-auto rounded-[10px] border border-[#E7E4DC] bg-white py-1 shadow-[0_12px_30px_rgba(15,24,38,0.18)]"
        >
          {lista.map((s, i) => (
            <li
              key={s.href}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={i === activa}
              onMouseDown={(e) => {
                e.preventDefault()
                ir(s.href)
              }}
              onMouseEnter={() => setActiva(i)}
              className={clsx("flex cursor-pointer items-center gap-3 px-3 py-2", i === activa && "bg-[#FAF6EF]")}
            >
              {s.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imagen} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <span className="h-8 w-8 shrink-0 rounded bg-[#F4F1EA]" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-[14px] text-[#1B1B18]">{s.texto}</span>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#8A887F]">{ETIQUETA[s.tipo]}</span>
            </li>
          ))}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={(e) => {
              e.preventDefault()
              buscar()
            }}
            className="cursor-pointer border-t border-[#E7E4DC] px-3 py-2 text-[13.5px] font-semibold text-[#B34D07]"
          >
            Buscar “{texto.trim()}” en la tienda
          </li>
        </ul>
      )}
    </div>
  )
}
