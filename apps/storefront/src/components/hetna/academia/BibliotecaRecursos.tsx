"use client"

// Biblioteca de recursos de la Academia: ligas a planos, guías, videos y
// programas de otros sitios, con el crédito de la fuente. Se abren en el sitio
// original (nueva pestaña). El filtro por categoría es en el navegador.
import { useMemo, useState } from "react"

import Image from "@/lib/imagenes/Imagen"
import { CATEGORIAS_RECURSO, TIPOS_RECURSO, type Recurso } from "@/lib/hetna/recursos-academia"

const INICIALES = 12

export function BibliotecaRecursos({ recursos }: { recursos: Recurso[] }) {
  const [cat, setCat] = useState("todas")
  const [texto, setTexto] = useState("")
  const [todos, setTodos] = useState(false)

  const categorias = useMemo(
    () => CATEGORIAS_RECURSO.filter(([c]) => recursos.some((r) => r.categoria === c)),
    [recursos]
  )
  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return recursos.filter(
      (r) =>
        (cat === "todas" || r.categoria === cat) &&
        (!q || `${r.titulo} ${r.descripcion} ${r.fuente}`.toLowerCase().includes(q))
    )
  }, [recursos, cat, texto])
  const lista = todos ? visibles : visibles.slice(0, INICIALES)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar planos, guías, programas…"
          aria-label="Buscar en la biblioteca"
          className="w-full rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[14.5px] sm:max-w-[320px]"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[["todas", "Todas"] as [string, string], ...categorias].map(([c, n]) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition ${
                cat === c ? "border-[#142033] bg-[#142033] text-white" : "border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#C2560A]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="m-0 text-[14.5px] text-[#6B6A63]">No hay recursos con esa búsqueda.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((r) => (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white transition hover:-translate-y-0.5 hover:border-[#C2560A]"
              >
                {r.imagen_url && (
                  <span className="relative block aspect-[16/9] bg-[#F3F1EA]">
                    <Image src={r.imagen_url} alt="" fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw" className="object-cover" />
                  </span>
                )}
                <span className="flex flex-1 flex-col gap-2 p-4">
                  <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide">
                    <span className="rounded-full bg-[#FDEEE1] px-2 py-0.5 text-[#B34D07]">{TIPOS_RECURSO.find(([t]) => t === r.tipo)?.[1] || "Guía"}</span>
                    {r.destacado && <span className="rounded-full bg-[#142033] px-2 py-0.5 text-white">Recomendado</span>}
                  </span>
                  <span className="text-[16px] font-bold leading-snug text-[#1B1B18] group-hover:text-[#B34D07]">{r.titulo}</span>
                  {r.descripcion && <span className="line-clamp-3 text-[13.5px] leading-relaxed text-[#4A4943]">{r.descripcion}</span>}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-1 text-[12.5px] text-[#6B6A63]">
                    <span className="truncate">Fuente: {r.fuente}</span>
                    <span className="shrink-0 font-bold text-[#C2560A]">Abrir ↗</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {!todos && visibles.length > INICIALES && (
        <button
          type="button"
          onClick={() => setTodos(true)}
          className="self-center rounded-[10px] border border-[#E7E4DC] bg-white px-5 py-2.5 text-[14px] font-bold text-[#1B1B18] hover:border-[#C2560A]"
        >
          Ver los {visibles.length} recursos
        </button>
      )}
      <p className="m-0 text-[12.5px] text-[#6B6A63]">
        Estos materiales son de sus autores y se abren en su sitio original. HETNA sólo los recomienda.
      </p>
    </div>
  )
}
