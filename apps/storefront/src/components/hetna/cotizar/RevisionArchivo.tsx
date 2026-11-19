"use client"

import type { GeoCad } from "@/lib/cotizador/archivo-cad"
import { puntosRevision, type Proceso } from "@/lib/cotizador/revision-archivo"

// Lista ✓/⚠ de la revisión automática del archivo (lib/cotizador/revision-archivo.ts).
// Sólo informa: nunca bloquea el precio.

const ICONO = { ok: "✓", revisar: "•", problema: "⚠" } as const
const COLOR = { ok: "text-[#2E7D32]", revisar: "text-[#8A6D1F]", problema: "text-[#B42318]" } as const

export function RevisionArchivo({ geo, proceso, espesor_mm }: { geo: GeoCad; proceso?: Proceso; espesor_mm?: number }) {
  const puntos = puntosRevision(geo, { proceso, espesor_mm })
  if (!puntos.length) return null
  const problemas = puntos.filter((p) => p.nivel === "problema").length
  const revisar = puntos.filter((p) => p.nivel === "revisar").length
  return (
    <div className="rounded-[10px] border border-[#E7E4DC] bg-white p-3 text-left">
      <p className="m-0 text-[13px] font-bold text-[#1B1B18]">
        Revisión de tu archivo:{" "}
        {problemas ? (
          <span className="text-[#B42318]">{problemas === 1 ? "1 cosa por corregir" : `${problemas} cosas por corregir`}</span>
        ) : revisar ? (
          <span className="text-[#8A6D1F]">{revisar === 1 ? "1 detalle por revisar" : `${revisar} detalles por revisar`}</span>
        ) : (
          <span className="text-[#2E7D32]">todo bien</span>
        )}
      </p>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
        {puntos.map((p) => (
          <li key={p.titulo} className="flex gap-2 text-[12.5px] leading-snug">
            <span className={`shrink-0 font-bold ${COLOR[p.nivel]}`}>{ICONO[p.nivel]}</span>
            <span className="text-[#40403A]">
              <b className="font-semibold text-[#1B1B18]">{p.titulo}</b>
              {p.detalle ? <span className="block text-[#6B6A63]">{p.detalle}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {problemas ? <p className="m-0 mt-2 text-[11.5px] text-[#7A776E]">Puedes pedir tu precio igual; corregirlo evita retrasos y cobros de más.</p> : null}
    </div>
  )
}
