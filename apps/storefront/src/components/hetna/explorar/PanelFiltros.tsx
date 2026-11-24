"use client"

// Partes con interacción de /categories (lib/hetna/explorar.ts):
// - PanelFiltros: en computadora es la columna izquierda; en celular, un botón
//   "Filtros (n)" que abre los filtros desde abajo. Los filtros son enlaces: al
//   tocar uno la página se actualiza detrás y el panel sigue abierto con los
//   números nuevos, hasta que se toca "Ver N productos".
// - OrdenarExplorar: el orden de la lista.
import { ReactNode, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function PanelFiltros({ children, activos, total, unidad }: { children: ReactNode; activos: number; total: number; unidad: string }) {
  const [abierto, setAbierto] = useState(false)

  // Sin scroll de la página de atrás mientras el panel está abierto
  useEffect(() => {
    if (!abierto) return
    const antes = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = antes
    }
  }, [abierto])

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#142033] text-[14px] font-bold text-white md:hidden"
        data-testid="abrir-filtros"
      >
        ⚙ Filtros{activos ? ` (${activos})` : ""}
      </button>

      {/* Fondo oscuro del panel en celular */}
      {abierto && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setAbierto(false)} aria-hidden />}

      <aside
        aria-label="Filtros"
        className={
          abierto
            ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl md:static md:z-auto md:max-h-none md:rounded-none md:bg-transparent md:shadow-none"
            : "hidden md:block"
        }
      >
        <div className="overflow-y-auto px-5 pb-24 pt-3 md:overflow-visible md:p-0">
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[#D4D9DF] md:hidden" />
          {children}
        </div>
        {abierto && (
          <div className="absolute inset-x-0 bottom-0 bg-white p-4 shadow-[0_-6px_16px_rgba(0,0,0,.06)] md:hidden">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="h-12 w-full rounded-xl bg-[#C2560A] text-[15px] font-extrabold text-white"
            >
              Ver {total} {unidad}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

const ORDENES: [string, string][] = [
  ["created_at", "Más recientes"],
  ["price_asc", "Precio: menor a mayor"],
  ["price_desc", "Precio: mayor a menor"],
]

export function OrdenarExplorar({ valor }: { valor: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  return (
    <label className="flex items-center gap-2 text-[13px] text-[#40403A]">
      <span className="hidden sm:inline">Ordenar:</span>
      <select
        value={valor}
        onChange={(e) => {
          const out = new URLSearchParams(sp.toString())
          out.delete("page")
          if (e.target.value === "created_at") out.delete("sortBy")
          else out.set("sortBy", e.target.value)
          const q = out.toString()
          router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
        }}
        className="h-9 rounded-lg border border-[#D4D9DF] bg-white px-2.5 text-[13px] font-semibold text-[#1E2329]"
        aria-label="Ordenar"
      >
        {ORDENES.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  )
}
