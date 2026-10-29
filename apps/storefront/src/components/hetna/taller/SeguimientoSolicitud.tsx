"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { confirmarRecibido, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

// Línea de tiempo de la solicitud en la liga privada del cliente: en qué va,
// qué ya pasó y qué sigue, más lo que escribieron HETNA y el taller.
const QUIEN: Record<string, string> = { hetna: "HETNA", taller: "Taller", cliente: "Tú", sistema: "HETNA" }
const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""

export default function SeguimientoSolicitud({ token, s }: { token: string; s: VistaSolicitud }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState("")
  const linea = s.linea || []
  if (!linea.length) return null

  const confirmar = () =>
    iniciar(async () => {
      setError("")
      const r = await confirmarRecibido(token)
      if (!r.ok) setError(r.mensaje)
      else router.refresh()
    })

  return (
    <section className="mt-6 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#142033]">Seguimiento</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            s.etapa === "cancelada" ? "bg-[#FDECEA] text-[#B3261E]" : "bg-[#FFF1E6] text-[#C2560A]"
          }`}
        >
          {s.etapa_nombre}
        </span>
      </div>
      {s.etapa_explica && <p className="mt-1 text-sm text-[#6B675C]">{s.etapa_explica}</p>}

      <ol className="mt-5 grid gap-0">
        {linea.map((p, i) => {
          const hecha = p.estado === "hecha"
          const actual = p.estado === "actual"
          return (
            <li key={p.etapa} className="relative flex gap-3 pb-4 last:pb-0">
              {i < linea.length - 1 && (
                <span className={`absolute left-[11px] top-6 h-full w-0.5 ${hecha ? "bg-[#1E7B3A]" : "bg-[#E7E4DC]"}`} aria-hidden />
              )}
              <span
                className={`relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  hecha
                    ? "bg-[#1E7B3A] text-white"
                    : actual
                      ? "bg-[#C2560A] text-white ring-4 ring-[#FDEEE1]"
                      : "border-2 border-[#E7E4DC] bg-white text-[#9B978C]"
                }`}
              >
                {hecha ? "✓" : p.estado === "omitida" ? "–" : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${p.estado === "pendiente" || p.estado === "omitida" ? "text-[#9B978C]" : "text-[#142033]"}`}>
                  {p.nombre}
                  {p.fecha && <span className="ml-2 font-normal text-[#6B675C]">{fecha(p.fecha)}</span>}
                </span>
                {actual && <span className="block text-sm text-[#44433D]">{p.explica}</span>}
              </span>
            </li>
          )
        })}
      </ol>

      {s.envio && (
        <p className="mt-4 rounded-xl bg-[#F3F1EA] px-4 py-3 text-sm text-[#2B2A26]">
          Envío: <strong>{s.envio.paqueteria || "—"}</strong>
          {s.envio.guia && (
            <>
              {" "}· Guía <strong className="select-all">{s.envio.guia}</strong>
            </>
          )}
        </p>
      )}

      {s.puede_confirmar && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-[#1E7B3A] bg-[#EEF6EE] p-4">
          <p className="min-w-0 flex-1 text-sm text-[#1F5A2B]">
            ¿Ya tienes tu pedido? Confírmalo para cerrar el proyecto. Si llegó con algún problema, escríbenos antes de confirmar.
          </p>
          <button
            type="button"
            onClick={confirmar}
            disabled={pendiente}
            className="rounded-xl bg-[#1E7B3A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pendiente ? "Confirmando…" : "Ya lo recibí"}
          </button>
          {error && <p className="w-full text-sm text-[#B3261E]">{error}</p>}
        </div>
      )}

      {(s.historial || []).length > 0 && (
        <div className="mt-5 border-t border-[#E7E4DC] pt-4">
          <p className="text-sm font-bold text-[#142033]">Mensajes y avances</p>
          <ul className="mt-2 grid gap-2">
            {[...(s.historial || [])].reverse().map((h, i) => (
              <li key={i} className="text-sm text-[#40403A]">
                <span className="font-semibold text-[#142033]">{QUIEN[h.quien] || h.quien}</span>{" "}
                <span className="text-xs text-[#6B675C]">{fecha(h.fecha)}</span>
                <span className="block">{h.nota}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
