"use client"

import { useState } from "react"

import type { HitoProduccion } from "@/lib/cotizar/solicitud-taller"

// Línea de tiempo de la producción: cada hito con su fecha planeada, la real, si va a
// tiempo o atrasado, la nota del taller y sus fotos (ligas firmadas por una hora).

const dia = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "—")

export default function HitosProduccion({ hitos }: { hitos: HitoProduccion[] }) {
  const [foto, setFoto] = useState<string | null>(null)
  if (!hitos.length) return null
  const hechos = hitos.filter((h) => h.estado === "hecho").length
  return (
    <div className="mt-5 border-t border-[#E7E4DC] pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-[#142033]">Avance de la producción</p>
        <p className="text-xs text-[#6B675C]">{hechos} de {hitos.length} etapas listas</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F3F1EA]">
        <div className="h-full rounded-full bg-[#1E7B3A]" style={{ width: `${Math.round((hechos / hitos.length) * 100)}%` }} />
      </div>
      <ol className="mt-3 grid gap-3">
        {hitos.map((h) => {
          const color = h.estado === "hecho" ? "#1E7B3A" : h.estado === "atrasado" ? "#B3261E" : "#8A867B"
          return (
            <li key={h.clave} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }}>
                {h.estado === "hecho" ? "✓" : h.orden}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#142033]">
                  {h.nombre}
                  {h.estado === "atrasado" && <span className="ml-2 rounded-full bg-[#FDECEA] px-2 py-0.5 text-xs font-bold text-[#B3261E]">Atrasado</span>}
                  {h.estado === "hecho" && h.dias_diferencia != null && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${h.dias_diferencia > 0 ? "bg-[#FFF6E0] text-[#8A5A00]" : "bg-[#E6F4EA] text-[#1E7B3A]"}`}>
                      {h.dias_diferencia > 0 ? `${h.dias_diferencia} ${h.dias_diferencia === 1 ? "día" : "días"} tarde` : "A tiempo"}
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#6B675C]">
                  Planeado: {dia(h.fecha_plan)}
                  {h.fecha_real && <> · Listo: {dia(h.fecha_real)}</>}
                </p>
                {h.nota && <p className="mt-0.5 text-sm text-[#40403A]">{h.nota}</p>}
                {h.fotos.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {h.fotos.map((f) =>
                      f.url ? (
                        <button key={f.clave} type="button" onClick={() => setFoto(f.url)} className="overflow-hidden rounded-lg border border-[#E7E4DC]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.url} alt={f.nombre} className="h-16 w-16 object-cover" loading="lazy" />
                        </button>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {foto && (
        <button type="button" onClick={() => setFoto(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" aria-label="Cerrar foto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="Foto del avance" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </div>
  )
}
