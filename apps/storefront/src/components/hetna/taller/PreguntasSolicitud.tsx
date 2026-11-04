"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { responderPregunta, type PreguntaSolicitud } from "@/lib/cotizar/solicitud-taller"

// Preguntas de los talleres sobre la solicitud. El cliente contesta aquí y la
// respuesta la ven todos los talleres, para que todos coticen con lo mismo.
export default function PreguntasSolicitud({ token, preguntas, abierta }: { token: string; preguntas: PreguntaSolicitud[]; abierta: boolean }) {
  const router = useRouter()
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState<string | null>(null)
  const [, iniciar] = useTransition()
  if (!preguntas.length) return null
  const sinContestar = preguntas.filter((p) => !p.respuesta).length

  const contestar = (id: string) =>
    iniciar(async () => {
      setError("")
      setEnviando(id)
      const r = await responderPregunta(token, id, textos[id] || "")
      setEnviando(null)
      if (!r.ok) return setError(r.mensaje)
      setTextos((t) => ({ ...t, [id]: "" }))
      router.refresh()
    })

  return (
    <section id="preguntas" className="mt-6 scroll-mt-24 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#142033]">Preguntas de los talleres</h2>
        {sinContestar > 0 && (
          <span className="rounded-full bg-[#FFF1E6] px-3 py-1 text-sm font-bold text-[#C2560A]">
            {sinContestar} sin contestar
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[#6B675C]">
        Tu respuesta la ven todos los talleres que cotizan tu trabajo. No escribas teléfono ni correo: se ocultan solos.
      </p>
      <ul className="mt-4 grid gap-3">
        {preguntas.map((p) => (
          <li key={p.id} className="rounded-xl bg-[#FAF9F5] p-4">
            <p className="text-sm text-[#142033]">
              <span className="font-bold">Taller:</span> {p.pregunta}
            </p>
            {p.respuesta ? (
              <p className="mt-2 text-sm text-[#40403A]">
                <span className="font-bold text-[#1E7B3A]">Tú:</span> {p.respuesta}
              </p>
            ) : abierta ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <textarea
                  rows={2}
                  maxLength={1200}
                  value={textos[p.id] || ""}
                  onChange={(e) => setTextos((t) => ({ ...t, [p.id]: e.target.value }))}
                  placeholder="Tu respuesta"
                  className="min-w-0 flex-1 rounded-xl border border-[#D9D5C9] bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={enviando === p.id || (textos[p.id] || "").trim().length < 2}
                  onClick={() => contestar(p.id)}
                  className="self-start rounded-xl bg-[#142033] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {enviando === p.id ? "Enviando…" : "Responder"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#9B978C]">Sin respuesta</p>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}
    </section>
  )
}
