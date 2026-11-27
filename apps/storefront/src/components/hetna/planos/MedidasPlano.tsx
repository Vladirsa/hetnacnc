"use client"

// "Modifica las medidas" de un plano: el cliente escribe ancho, fondo y alto y
// la página se vuelve a dibujar con esas medidas (?ancho=&fondo=&alto=). Los
// espesores del triplay no cambian: sólo se estiran los huecos (lib/planos/medidas.ts).
import { T } from "@/components/hetna/i18n/Idioma"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"

import { LIMITE, type Medidas } from "@/lib/planos/medidas"

const campo = "mt-1 min-h-[44px] w-full rounded-md border border-[#C5CCD3] bg-white px-2.5 text-[15px] outline-none focus:border-[#E85D04]"

export default function MedidasPlano({ original, actual, ajustado = false }: { original: Medidas; actual: Medidas; ajustado?: boolean }) {
  const router = useRouter()
  const ruta = usePathname()
  // conserva el tipo de unión elegido (?uniones=ranuras)
  const extra = useSearchParams().get("uniones") === "ranuras" ? "uniones=ranuras" : ""
  const [v, setV] = useState<Medidas>(actual)
  const [cargando, iniciar] = useTransition()
  const cambiado = (["ancho", "fondo", "alto"] as const).some((k) => actual[k] !== original[k])

  const ir = (m: Medidas | null) =>
    iniciar(() => {
      router.replace(
        m ? `${ruta}?ancho=${Math.round(m.ancho)}&fondo=${Math.round(m.fondo)}&alto=${Math.round(m.alto)}${extra ? `&${extra}` : ""}` : `${ruta}${extra ? `?${extra}` : ""}`,
        { scroll: false }
      )
    })

  return (
    <form
      className="mb-4 rounded-2xl border border-[#E7E4DC] bg-white p-4 print:hidden"
      onSubmit={(e) => {
        e.preventDefault()
        ir(v)
      }}
    >
      <p className="m-0 text-[15px] font-bold text-[#142033]"><T>Modifica las medidas</T></p>
      <p className="m-0 mt-0.5 text-[13px] text-[#6B6A63]">
        <T>Cambia el ancho, fondo o alto (en mm) y se recalculan el dibujo, la lista de corte, el acomodo, el DXF y el precio. El triplay conserva su grosor. Entre</T> {Math.round(LIMITE.min * 100)} % y {Math.round(LIMITE.max * 100)} <T>% de la medida original.</T>
      </p>
      {ajustado ? (
        <p className="m-0 mt-2 rounded-md bg-[#FFF4E5] px-3 py-2 text-[13px] text-[#8A4B00]">
          <T>Con esas medidas algunas piezas ya no caben en una hoja de triplay de 2440 × 1220 mm. Lo dejamos en la medida más grande que sí cabe:</T> {actual.ancho} × {actual.fondo} × {actual.alto} <T>mm.</T>
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-[520px]">
        {(["ancho", "fondo", "alto"] as const).map((k) => (
          <label key={k} className="block text-[12.5px] font-semibold capitalize text-[#1E2329]">
            {k} <T>(mm)</T>
            <input
              type="number"
              inputMode="numeric"
              min={Math.round(original[k] * LIMITE.min)}
              max={Math.round(original[k] * LIMITE.max)}
              step={10}
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })}
              className={campo}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={cargando} className="inline-flex min-h-[44px] items-center rounded-[12px] bg-[#FF6A1A] px-5 text-[15px] font-bold text-white disabled:opacity-60">
          {cargando ? "Recalculando…" : "Aplicar medidas"}
        </button>
        {cambiado ? (
          <button type="button" onClick={() => { setV(original); ir(null) }} className="text-[14px] font-semibold text-[#B34D07]">
            <T>Volver a las originales (</T>{original.ancho} × {original.fondo} × {original.alto})
          </button>
        ) : null}
      </div>
    </form>
  )
}
