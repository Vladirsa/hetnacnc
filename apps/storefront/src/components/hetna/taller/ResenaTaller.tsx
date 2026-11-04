"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { enviarResena, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

// Calificación del taller al terminar: calidad, tiempo y trato (1 a 5).
// Sólo para trabajos pagados en HETNA; sale en el perfil del taller.
const CRITERIOS = [
  ["calidad", "Calidad del trabajo"],
  ["tiempo", "Cumplió el tiempo"],
  ["trato", "Trato y comunicación"],
] as const

type Notas = { calidad: number; tiempo: number; trato: number }

export default function ResenaTaller({ token, s }: { token: string; s: VistaSolicitud }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [notas, setNotas] = useState<Notas>({
    calidad: s.resena?.calidad || 0,
    tiempo: s.resena?.tiempo || 0,
    trato: s.resena?.trato || 0,
  })
  const [comentario, setComentario] = useState(s.resena?.comentario || "")
  const [editando, setEditando] = useState(!s.resena)
  const [error, setError] = useState("")
  if (!s.puede_resenar) return null

  const nombreTaller = s.propuestas.find((p) => p.id === s.propuesta_elegida)?.taller.nombre || "el taller"
  const listo = notas.calidad && notas.tiempo && notas.trato

  const guardar = () =>
    iniciar(async () => {
      setError("")
      const r = await enviarResena(token, { ...notas, comentario })
      if (!r.ok) return setError(r.mensaje)
      setEditando(false)
      router.refresh()
    })

  if (!editando && s.resena) {
    return (
      <section className="mt-6 rounded-2xl border border-[#1E7B3A]/30 bg-[#EEF6EE] p-5">
        <p className="font-extrabold text-[#1F5A2B]">¡Gracias por calificar a {nombreTaller}!</p>
        <p className="mt-1 text-sm text-[#1F5A2B]">
          Calidad {s.resena.calidad}/5 · Tiempo {s.resena.tiempo}/5 · Trato {s.resena.trato}/5
        </p>
        <button type="button" onClick={() => setEditando(true)} className="mt-2 text-sm font-semibold text-[#142033] underline">
          Cambiar mi calificación
        </button>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-[#C2560A]/40 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-[#142033]">Califica a {nombreTaller}</h2>
      <p className="mt-1 text-sm text-[#6B675C]">Tu opinión sale en su perfil y ayuda a otros clientes a elegir bien.</p>
      <div className="mt-4 grid gap-3">
        {CRITERIOS.map(([k, label]) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#142033]">{label}</span>
            <span className="flex gap-1" role="radiogroup" aria-label={label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={notas[k] === n}
                  aria-label={`${n} de 5`}
                  onClick={() => setNotas((x) => ({ ...x, [k]: n }))}
                  className={`text-2xl leading-none ${n <= notas[k] ? "text-[#C2560A]" : "text-[#D9D5C9]"}`}
                >
                  ★
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <textarea
        rows={3}
        maxLength={1000}
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="¿Qué tal quedó tu pieza? (opcional)"
        className="mt-4 w-full rounded-xl border border-[#D9D5C9] px-3 py-2 text-sm"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!listo || pendiente}
          onClick={guardar}
          className="rounded-xl bg-[#C2560A] px-5 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Enviar calificación"}
        </button>
        {error && <p className="text-sm text-[#B3261E]">{error}</p>}
      </div>
    </section>
  )
}
