"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { mandarContraoferta, type Propuesta } from "@/lib/cotizar/solicitud-taller"

// Versiones de la propuesta (qué cambió) y contraofertas del cliente con su respuesta.
// El cliente manda una contraoferta (precio y/o días que le funcionan y un mensaje);
// una pendiente a la vez y hasta 3 por taller.

const MAX = 3
const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" })

const ESTADO: Record<string, { t: string; c: string }> = {
  pendiente: { t: "Esperando respuesta del taller", c: "text-[#8A5A00]" },
  aceptada: { t: "✓ El taller la aceptó", c: "text-[#1E7B3A]" },
  rechazada: { t: "El taller mantiene su propuesta", c: "text-[#B3261E]" },
  respondida: { t: "El taller corrigió su propuesta", c: "text-[#1F5FBF]" },
}

export default function NegociacionPropuesta({ token, p, abierta, compacta = false }: { token: string; p: Propuesta; abierta: boolean; compacta?: boolean }) {
  const router = useRouter()
  const [abiertoForm, setAbiertoForm] = useState(false)
  const [verCambios, setVerCambios] = useState(false)
  const [precio, setPrecio] = useState("")
  const [dias, setDias] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const historial = p.historial || []
  const contras = p.contraofertas || []
  const hayPendiente = contras.some((c) => c.estado === "pendiente")
  const puede = abierta && !hayPendiente && contras.length < MAX
  const version = p.version || 1

  const enviar = () =>
    iniciar(async () => {
      setError("")
      const r = await mandarContraoferta(token, p.id, {
        precio: precio.trim() ? Number(precio.replace(/[^\d.]/g, "")) : null,
        dias: dias.trim() ? Math.round(Number(dias)) : null,
        mensaje: mensaje.trim(),
      })
      if (!r.ok) {
        setError(r.mensaje)
        return
      }
      setAbiertoForm(false)
      setPrecio("")
      setDias("")
      setMensaje("")
      router.refresh()
    })

  if (compacta && version === 1 && !contras.length && !abierta) return <span className="text-[#8A867B]">—</span>

  return (
    <div className={compacta ? "text-xs" : "mt-3 text-sm"}>
      {version > 1 && (
        <div>
          <button type="button" onClick={() => setVerCambios((v) => !v)} className="rounded-full bg-[#EAF1FB] px-2 py-0.5 font-semibold text-[#1F5FBF]">
            Versión {version} · {verCambios ? "ocultar cambios" : "ver cambios"}
          </button>
          {verCambios && (
            <ul className="mt-1 space-y-0.5 text-xs text-[#40403A]">
              {historial.map((h) => (
                <li key={h.version}>
                  <b>v{h.version}</b> · {h.precio != null ? pesos(h.precio) : "—"} · {h.dias != null ? `${h.dias} días` : "—"}
                  <span className="text-[#8A867B]"> · {fecha(h.fecha)}</span>
                  {h.origen === "contraoferta" && <span className="text-[#1E7B3A]"> · cambió por tu contraoferta</span>}
                  {h.motivo && <span className="block pl-3 italic text-[#6B675C]">“{h.motivo}”</span>}
                </li>
              ))}
              <li>
                <b>v{version}</b> (actual) · {pesos(p.precio)} · {p.dias} días
              </li>
            </ul>
          )}
        </div>
      )}

      {contras.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {contras.map((c) => (
            <li key={c.id} className="rounded-lg bg-[#FAF9F6] px-2 py-1 text-xs">
              <span className="text-[#40403A]">
                Tu contraoferta: {[c.precio != null ? pesos(c.precio) : null, c.dias != null ? `${c.dias} días` : null].filter(Boolean).join(" · ") || "mensaje"}
              </span>
              <span className={`block font-semibold ${ESTADO[c.estado]?.c || ""}`}>{ESTADO[c.estado]?.t || c.estado}</span>
              {c.nota_taller && <span className="block italic text-[#6B675C]">“{c.nota_taller}”</span>}
            </li>
          ))}
        </ul>
      )}

      {puede && !abiertoForm && (
        <button type="button" onClick={() => setAbiertoForm(true)} className="mt-1.5 rounded-xl border border-[#C2560A] px-3 py-1.5 font-semibold text-[#C2560A] hover:bg-[#FFF1E6]">
          Hacer contraoferta
        </button>
      )}
      {abiertoForm && (
        <div className="mt-2 space-y-2 rounded-xl border border-[#E7E4DC] bg-white p-3">
          <p className="text-xs text-[#6B675C]">
            Propón lo que te funciona. Si el taller acepta, su propuesta se actualiza sola. Te quedan {MAX - contras.length} de {MAX}.
          </p>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-[#40403A]">
              Precio que pides
              <input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder={String(Math.round(p.precio * 0.9))}
                className="mt-0.5 w-full rounded-lg border border-[#D9D5C9] px-2 py-1.5 text-sm" />
            </label>
            <label className="w-28 text-xs text-[#40403A]">
              Días
              <input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} placeholder={String(p.dias)}
                className="mt-0.5 w-full rounded-lg border border-[#D9D5C9] px-2 py-1.5 text-sm" />
            </label>
          </div>
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2} maxLength={800} placeholder="Mensaje para el taller (opcional)"
            className="w-full rounded-lg border border-[#D9D5C9] px-2 py-1.5 text-sm" />
          {error && <p className="text-xs text-[#B3261E]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAbiertoForm(false)} className="rounded-xl px-3 py-1.5 font-semibold text-[#40403A]">Cancelar</button>
            <button type="button" onClick={enviar} disabled={pendiente} className="rounded-xl bg-[#C2560A] px-4 py-1.5 font-semibold text-white disabled:opacity-60">
              {pendiente ? "Enviando…" : "Mandar contraoferta"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
