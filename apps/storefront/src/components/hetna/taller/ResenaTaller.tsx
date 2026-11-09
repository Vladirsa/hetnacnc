"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { accionEvaluacion, enviarResena, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

// HETNA Trust & Ranking (Licitaciones 3.0, Fase 4): el cliente evalúa al
// taller con 7 indicadores. Sólo trabajos pagados y entregados en HETNA. Las
// evaluaciones se publican cuando ambos evaluaron o a los 14 días.
const CRITERIOS = [
  ["calidad", "Calidad de fabricación"],
  ["tiempo", "Cumplimiento de entregas"],
  ["comunicacion", "Comunicación"],
  ["precio", "Precio (lo cotizado vs. lo cobrado)"],
  ["capacidad", "Capacidad técnica (cumplió especificaciones)"],
  ["profesionalismo", "Profesionalismo"],
  ["posventa", "Servicio posventa"],
] as const
type Clave = (typeof CRITERIOS)[number][0]
const OPCIONAL: Clave = "posventa"

const NOMBRES_CLIENTE: Record<string, string> = {
  claridad: "Claridad del proyecto",
  comunicacion: "Comunicación",
  pagos: "Cumplimiento de pagos",
  formalidad: "Formalidad",
  cambios: "Cambios de alcance",
  profesionalismo: "Profesionalismo",
  contractual: "Cumplimiento de compromisos",
}

function Estrellas({ valor, alCambiar, etiqueta }: { valor: number; alCambiar: (n: number) => void; etiqueta: string }) {
  return (
    <span className="flex gap-1" role="radiogroup" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`} onClick={() => alCambiar(n)} className={`text-2xl leading-none ${n <= valor ? "text-[#C2560A]" : "text-[#D9D5C9]"}`}>
          ★
        </button>
      ))}
    </span>
  )
}

function EvaluacionRecibida({ token, s }: { token: string; s: VistaSolicitud }) {
  const ev = s.evaluaciones
  const [modo, setModo] = useState<"" | "responder" | "reclamar">("")
  const [texto, setTexto] = useState("")
  const [nota, setNota] = useState("")
  const router = useRouter()
  if (!ev) return null
  if (!ev.recibida) {
    return ev.recibida_pendiente ? (
      <p className="mt-3 text-sm text-[#6B675C]">El taller ya te evaluó como cliente. Verás su evaluación cuando tú lo evalúes (o en {ev.dias_publicacion} días).</p>
    ) : null
  }
  const r = ev.recibida
  const enviar = async () => {
    if (!modo) return
    const x = await accionEvaluacion(token, modo, texto)
    if (!x.ok) return setNota(x.mensaje)
    setNota(modo === "reclamar" ? "Recibimos tu reclamación. HETNA la revisará." : "Respuesta publicada.")
    setModo("")
    router.refresh()
  }
  return (
    <div className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm">
      <p className="font-bold text-[#142033]">Cómo te evaluó el taller como cliente: {r.promedio.toFixed(1)} / 5</p>
      <p className="mt-1 text-xs text-[#6B675C]">
        {Object.entries(NOMBRES_CLIENTE)
          .filter(([k]) => r[k] != null)
          .map(([k, n]) => `${n} ${r[k]}/5`)
          .join(" · ")}
      </p>
      {r.comentario && <p className="mt-2 text-[#40403A]">“{r.comentario}”</p>}
      {r.respuesta && <p className="mt-2 border-l-2 border-[#E7E4DC] pl-3 text-[#40403A]">Tu respuesta: {r.respuesta}</p>}
      <div className="mt-2 flex gap-3 text-xs font-semibold">
        <button type="button" className="text-[#142033] underline" onClick={() => setModo("responder")}>Responder</button>
        <button type="button" className="text-[#B3261E] underline" onClick={() => setModo("reclamar")}>No es correcta: pedir revisión</button>
      </div>
      {modo && (
        <div className="mt-2 flex gap-2">
          <textarea rows={2} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-xl border border-[#D9D5C9] px-3 py-2 text-sm" placeholder={modo === "reclamar" ? "¿Por qué no es correcta?" : "Tu respuesta pública"} />
          <button type="button" onClick={enviar} className="rounded-xl bg-[#142033] px-4 text-sm font-semibold text-white">Enviar</button>
        </div>
      )}
      {nota && <p className="mt-2 text-xs text-[#1E7B3A]">{nota}</p>}
    </div>
  )
}

export default function ResenaTaller({ token, s }: { token: string; s: VistaSolicitud }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const inicial = Object.fromEntries(CRITERIOS.map(([k]) => [k, Number((s.resena as Record<string, unknown> | null | undefined)?.[k] || 0)])) as Record<Clave, number>
  const [notas, setNotas] = useState<Record<Clave, number>>(inicial)
  const [noAplica, setNoAplica] = useState(Boolean(s.resena && !s.resena.posventa))
  const [comentario, setComentario] = useState(s.resena?.comentario || "")
  const [editando, setEditando] = useState(!s.resena)
  const [error, setError] = useState("")
  if (!s.puede_resenar) return null

  const nombreTaller = s.propuestas.find((p) => p.id === s.propuesta_elegida)?.taller.nombre || "el taller"
  const listo = CRITERIOS.every(([k]) => notas[k] || (k === OPCIONAL && noAplica))

  const guardar = () =>
    iniciar(async () => {
      setError("")
      const r = await enviarResena(token, { ...notas, posventa: noAplica ? 0 : notas.posventa, comentario })
      if (!r.ok) return setError(r.mensaje)
      setEditando(false)
      router.refresh()
    })

  if (!editando && s.resena) {
    return (
      <section className="mt-6 rounded-2xl border border-[#1E7B3A]/30 bg-[#EEF6EE] p-5">
        <p className="font-extrabold text-[#1F5A2B]">¡Gracias por evaluar a {nombreTaller}!</p>
        <p className="mt-1 text-sm text-[#1F5A2B]">
          {CRITERIOS.filter(([k]) => (s.resena as Record<string, unknown>)[k])
            .map(([k, n]) => `${n.split(" (")[0]} ${(s.resena as Record<string, unknown>)[k]}/5`)
            .join(" · ")}
        </p>
        <button type="button" onClick={() => setEditando(true)} className="mt-2 text-sm font-semibold text-[#142033] underline">
          Cambiar mi evaluación
        </button>
        <EvaluacionRecibida token={token} s={s} />
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-[#C2560A]/40 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-[#142033]">Evalúa a {nombreTaller}</h2>
      <p className="mt-1 text-sm text-[#6B675C]">
        Tu evaluación sale en su perfil cuando los dos hayan evaluado (o en 14 días): así nadie califica condicionado por lo que dijo el otro.
      </p>
      <div className="mt-4 grid gap-3">
        {CRITERIOS.map(([k, label]) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#142033]">{label}</span>
            <span className="flex items-center gap-3">
              {(k !== OPCIONAL || !noAplica) && <Estrellas valor={notas[k]} etiqueta={label} alCambiar={(n) => setNotas((x) => ({ ...x, [k]: n }))} />}
              {k === OPCIONAL && (
                <label className="flex items-center gap-1 text-xs text-[#6B675C]">
                  <input type="checkbox" checked={noAplica} onChange={(e) => setNoAplica(e.target.checked)} className="accent-[#C2560A]" /> No aplica
                </label>
              )}
            </span>
          </div>
        ))}
      </div>
      <textarea rows={3} maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="¿Qué tal quedó tu pieza? (opcional)" className="mt-4 w-full rounded-xl border border-[#D9D5C9] px-3 py-2 text-sm" />
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={!listo || pendiente} onClick={guardar} className="rounded-xl bg-[#C2560A] px-5 py-2.5 font-semibold text-white disabled:opacity-50">
          {pendiente ? "Guardando…" : "Enviar evaluación"}
        </button>
        {error && <p className="text-sm text-[#B3261E]">{error}</p>}
      </div>
      <EvaluacionRecibida token={token} s={s} />
    </section>
  )
}
