"use client"

// Biblioteca de recursos de la Academia: ligas a planos, guías, videos y
// programas de otros sitios, con el crédito de la fuente. Se abren en el sitio
// original (nueva pestaña). El filtro por categoría es en el navegador.
import { useMemo, useState } from "react"

import Image from "@/lib/imagenes/Imagen"
import { ServicioIcono } from "../ServicioIcono"
import { CATEGORIAS_RECURSO, TIPOS_RECURSO, type Recurso } from "@/lib/hetna/recursos-academia"

const INICIALES = 12

// Portada propia de HETNA cuando el recurso no tiene foto: color e ícono por
// categoría. No se usan imágenes de los otros sitios (derechos de autor) y no
// pesa nada: es CSS y un SVG en línea.
const PORTADA: Record<string, { icono: string; de: string; a: string }> = {
  "muebles-melamina": { icono: "mueble", de: "#7C4A1E", a: "#C98A4B" },
  carpinteria: { icono: "caja", de: "#5B3A1A", a: "#A8763E" },
  "router-cnc": { icono: "cam", de: "#142033", a: "#2F4A70" },
  "corte-laser": { icono: "grabado", de: "#7A1F12", a: "#E0532E" },
  plasma: { icono: "partir", de: "#1E2A6B", a: "#4F6BE0" },
  "impresion-3d": { icono: "extruir", de: "#0F5B4A", a: "#2DB38C" },
  electronica: { icono: "ia", de: "#1F4E2C", a: "#5BAA3C" },
  "diseno-cam": { icono: "vector", de: "#4A1F6B", a: "#9257D6" },
  programas: { icono: "gcode", de: "#0E3D63", a: "#2B8BD6" },
  otros: { icono: "aprender", de: "#3D3A33", a: "#8A8475" },
}
const dominio = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function Portada({ r }: { r: Recurso }) {
  const p = Object.prototype.hasOwnProperty.call(PORTADA, r.categoria) ? PORTADA[r.categoria] : PORTADA.otros
  const categoria = CATEGORIAS_RECURSO.find(([c]) => c === r.categoria)?.[1] || "Recurso"
  return (
    <span
      className="relative flex aspect-[16/10] flex-col justify-between overflow-hidden p-5 text-white lg:p-6"
      style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(135deg, ${p.de}, ${p.a})`, backgroundSize: "16px 16px, 100% 100%" }}
    >
      <span className="self-start rounded-full bg-black/25 px-3 py-1 text-[12.5px] font-bold uppercase tracking-wide text-white lg:text-[13.5px]">{categoria}</span>
      <span className="pointer-events-none absolute -bottom-6 -right-5 text-white/20 transition group-hover:scale-105">
        <ServicioIcono nombre={p.icono} size={190} />
      </span>
      <span className="relative flex min-w-0 items-center gap-2">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-white/15 lg:h-14 lg:w-14">
          <ServicioIcono nombre={p.icono} size={30} />
        </span>
        <span className="min-w-0 truncate rounded-[6px] bg-black/25 px-2 py-1 text-[14.5px] font-semibold text-white lg:text-[15.5px]">{dominio(r.url)}</span>
      </span>
    </span>
  )
}

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
        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 2xl:grid-cols-3">
          {lista.map((r) => (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white transition hover:-translate-y-0.5 hover:border-[#C2560A]"
              >
                {r.imagen_url ? (
                  <span className="relative block aspect-[16/10] bg-[#F3F1EA]">
                    <Image src={r.imagen_url} alt="" fill sizes="(min-width: 1536px) 31vw, (min-width: 768px) 46vw, 92vw" className="object-cover" />
                  </span>
                ) : (
                  <Portada r={r} />
                )}
                <span className="flex flex-1 flex-col gap-2.5 p-5 lg:p-6">
                  <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide">
                    <span className="rounded-full bg-[#FDEEE1] px-2 py-0.5 text-[#B34D07]">{TIPOS_RECURSO.find(([t]) => t === r.tipo)?.[1] || "Guía"}</span>
                    {r.destacado && <span className="rounded-full bg-[#142033] px-2 py-0.5 text-white">Recomendado</span>}
                  </span>
                  <span className="text-[19px] font-bold leading-snug lg:text-[21px] text-[#1B1B18] group-hover:text-[#B34D07]">{r.titulo}</span>
                  {r.descripcion && <span className="line-clamp-3 text-[15px] leading-relaxed text-[#4A4943]">{r.descripcion}</span>}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-[13.5px] text-[#6B6A63]">
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
