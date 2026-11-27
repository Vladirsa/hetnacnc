"use client"

// Formulario del buzón: calificación 0 a 10 (opcional) y qué mejorarías.
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

import { enviarOpinion } from "@/lib/opinion/acciones"

const IDEAS = [
  "Encontrar talleres cerca de mí",
  "Cotizar más rápido",
  "Precios y comisiones",
  "Pagos y envíos",
  "Usar la página en el celular",
  "Más productos y diseños",
]

export function FormOpinion({ token, puntajeInicial, quien }: { token?: string; puntajeInicial?: number | null; quien?: "taller" | "cliente" }) {
  const [puntaje, setPuntaje] = useState<number | null>(puntajeInicial ?? null)
  const [comentario, setComentario] = useState("")
  const [estado, setEstado] = useState<"" | "enviando" | "listo">("")
  const [error, setError] = useState("")

  const enviar = async () => {
    setEstado("enviando")
    setError("")
    const r = await enviarOpinion({ t: token, puntaje, comentario, pagina: token ? undefined : "Mi cuenta" })
    if (r.ok) setEstado("listo")
    else {
      setEstado("")
      setError(r.mensaje)
    }
  }

  if (estado === "listo")
    return (
      <div className="rounded-[14px] border border-[#CFE6D3] bg-[#F1F8F2] p-6 text-center">
        <p className="text-[20px] font-bold text-[#1E7B3A]"><T>¡Gracias! Ya lo recibimos.</T></p>
        <p className="mt-2 text-[15px] text-[#4A4943]"><T>Lo leemos todo. Si nos dejaste una idea, te avisamos cuando la tengamos lista.</T></p>
      </div>
    )

  const color = (n: number) =>
    puntaje === n ? "bg-[#C2560A] text-white border-[#C2560A]" : n <= 6 ? "bg-[#FBF1EC]" : n <= 8 ? "bg-[#FBF6E7]" : "bg-[#EEF7EF]"

  return (
    <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5 lg:p-6">
      <p className="text-[15px] font-semibold text-[#1B1B18]"><T>Del 0 al 10, ¿qué tanto recomendarías HETNA CNC a un colega o amigo?</T></p>
      <div className="mt-3 grid grid-cols-11 gap-1" role="radiogroup" aria-label="Calificación del 0 al 10">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={puntaje === n}
            onClick={() => setPuntaje(puntaje === n ? null : n)}
            className={`h-10 rounded-[8px] border border-[#E7E4DC] text-[15px] font-bold text-[#1B1B18] ${color(n)}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-[#6B6A63]">
        <span><T>Nada probable</T></span>
        <span><T>Muy probable</T></span>
      </div>

      <label htmlFor="opinion-comentario" className="mt-5 block text-[15px] font-semibold text-[#1B1B18]">
        {puntaje !== null && puntaje <= 6 ? "¿Qué nos faltó? ¿Qué te hizo dudar?" : "¿Qué mejorarías o qué te gustaría que tuviera HETNA?"}
      </label>
      <textarea
        id="opinion-comentario"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={2000}
        rows={5}
        placeholder={quien === "taller" ? "Ej.: me gustaría recibir solicitudes de mi ciudad por WhatsApp…" : "Ej.: me gustaría ver el precio antes de pedir cotización…"}
        className="mt-2 w-full rounded-[10px] border border-[#D9D6CC] p-3 text-[15px] focus:border-[#C2560A] focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {IDEAS.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setComentario((c) => (c.includes(i) ? c : `${c ? `${c.trim()}\n` : ""}${i}: `))}
            className="rounded-full border border-[#E7E4DC] bg-[#F7F6F2] px-3 py-1 text-[13px] text-[#4A4943] hover:border-[#C2560A]"
          >
            + {i}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-[14px] text-[#B42318]">{error}</p>}
      <button
        type="button"
        onClick={() => void enviar()}
        disabled={estado === "enviando" || (puntaje === null && comentario.trim().length < 3)}
        className="mt-5 w-full rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50 sm:w-auto"
      >
        {estado === "enviando" ? "Enviando…" : "Enviar mi opinión"}
      </button>
    </div>
  )
}
