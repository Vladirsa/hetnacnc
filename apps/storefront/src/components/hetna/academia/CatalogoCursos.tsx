"use client"

// Catálogo de la Academia: buscador y filtros en el navegador (los cursos ya
// vienen en la página, así que filtrar es instantáneo).
import { useMemo, useState } from "react"

import type { Course } from "@/lib/data/courses"
import { TarjetaCurso } from "./TarjetaCurso"
import { NIVEL } from "./formato"

type FiltroPrecio = "todos" | "gratis" | "pago"

const Chip = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    className={`shrink-0 px-3.5 py-2 rounded-full text-[13.5px] font-semibold border transition ${
      activo ? "bg-[#142033] border-[#142033] text-white" : "bg-white border-[#E7E4DC] text-[#1B1B18] hover:border-[#C2560A]"
    }`}
  >
    {children}
  </button>
)

export function CatalogoCursos({ cursos }: { cursos: Course[] }) {
  const [texto, setTexto] = useState("")
  const [nivel, setNivel] = useState<string>("todos")
  const [precio, setPrecio] = useState<FiltroPrecio>("todos")

  const lista = useMemo(() => {
    const q = texto
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
    return cursos.filter((c) => {
      if (nivel !== "todos" && c.level !== nivel) return false
      const gratis = !c.precio || c.precio.gratis
      if (precio === "gratis" && !gratis) return false
      if (precio === "pago" && gratis) return false
      if (!q) return true
      const en = `${c.title} ${c.description || ""} ${c.taller?.nombre || ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
      return en.includes(q)
    })
  }, [cursos, texto, nivel, precio])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Buscar cursos</span>
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A978C]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Busca: Fusion 360, router, láser, G-code…"
            className="w-full bg-white border border-[#E7E4DC] focus:border-[#C2560A] outline-none rounded-[12px] pl-10 pr-4 py-3 text-[15px]"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Chip activo={precio === "todos"} onClick={() => setPrecio("todos")}>Todos</Chip>
          <Chip activo={precio === "gratis"} onClick={() => setPrecio("gratis")}>Gratis</Chip>
          <Chip activo={precio === "pago"} onClick={() => setPrecio("pago")}>De pago</Chip>
          <span className="w-px bg-[#E7E4DC] mx-1 shrink-0" aria-hidden="true" />
          <Chip activo={nivel === "todos"} onClick={() => setNivel("todos")}>Todos los niveles</Chip>
          {Object.entries(NIVEL).map(([k, v]) => (
            <Chip key={k} activo={nivel === k} onClick={() => setNivel(k)}>
              {v}
            </Chip>
          ))}
        </div>
      </div>

      <p className="m-0 text-[13px] text-[#6B6A63]" aria-live="polite">
        {lista.length === 1 ? "1 curso" : `${lista.length} cursos`}
      </p>

      {lista.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {lista.map((c) => (
            <TarjetaCurso key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-[#D9D5CA] rounded-[14px] p-8 text-center text-[14.5px] text-[#6B6A63]">
          No hay cursos con esos filtros todavía.
        </div>
      )}
    </div>
  )
}
