"use client"

// Galería de un diseño para descargar: las fotos del producto y, si el
// producto trae sus medidas, un esquema dibujado con ellas (rotulado como
// esquema: no se hace pasar por foto ni por el archivo). Sello "Descarga
// inmediata" siempre visible.
import Image from "@/lib/imagenes/Imagen"
import { useState } from "react"

export type VistaGaleria =
  | { clave: string; tipo: "foto"; url: string; titulo: string }
  | { clave: string; tipo: "esquema"; svg: string; titulo: string }

export function GaleriaDescarga({ vistas, titulo }: { vistas: VistaGaleria[]; titulo: string }) {
  const [i, setI] = useState(0)
  if (!vistas.length) return null
  const v = vistas[Math.min(i, vistas.length - 1)]
  const mover = (d: number) => setI((x) => (x + d + vistas.length) % vistas.length)

  return (
    <div className="flex flex-col gap-3" data-testid="galeria-descarga">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-[#D4D9DF] bg-[#F4F5F7]">
        {v.tipo === "foto" ? (
          <Image
            src={v.url}
            alt={`${titulo} — ${v.titulo}`}
            fill
            priority={i === 0}
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: v.svg }} />
        )}

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded bg-[#1E2329] px-2.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M10 3v10m0 0l-4-4m4 4l4-4M4 17h12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Descarga inmediata
        </span>

        <span className="absolute bottom-3 left-3 max-w-[80%] rounded bg-white/95 px-2.5 py-1 text-[12.5px] font-semibold text-[#1E2329] shadow-sm">
          {v.titulo}
          {v.tipo === "esquema" && <span className="font-normal text-[#5B6370]"> · esquema con las medidas del archivo</span>}
        </span>

        {vistas.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Vista anterior"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[22px] text-[#1E2329] shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Vista siguiente"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[22px] text-[#1E2329] shadow hover:bg-white"
            >
              ›
            </button>
          </>
        )}
      </div>

      {vistas.length > 1 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Vistas">
          {vistas.map((x, n) => (
            <li key={x.clave}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={x.titulo}
                aria-current={n === i}
                className={`relative block aspect-square w-full overflow-hidden rounded border-2 bg-[#F4F5F7] ${n === i ? "border-[#E85D04]" : "border-transparent hover:border-[#C5CCD3]"}`}
              >
                {x.tipo === "foto" ? (
                  <Image src={x.url} alt="" fill sizes="120px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: x.svg }} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
