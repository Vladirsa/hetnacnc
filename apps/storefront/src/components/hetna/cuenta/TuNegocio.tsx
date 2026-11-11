"use client"

// "Tu negocio": a qué se dedica el cliente. Lo ven los talleres que le venden
// (Mis clientes, en su panel) para entender qué necesita — nunca su correo ni
// su teléfono. Se guarda en metadata.giro de la cuenta.
import { useState, useTransition } from "react"

import { guardarGiro } from "@/lib/cuenta/giro"

export const GIROS = [
  "Carpintería y muebles",
  "Publicidad y señalética",
  "Metalmecánica y herrería",
  "Arquitectura e interiorismo",
  "Industria y manufactura",
  "Construcción",
  "Educación",
  "Artesanía y regalos",
  "Particular / hobby",
]

export function TuNegocio({ inicial }: { inicial: string }) {
  const enLista = GIROS.includes(inicial)
  const [opcion, setOpcion] = useState(inicial ? (enLista ? inicial : "otro") : "")
  const [otro, setOtro] = useState(enLista ? "" : inicial)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pendiente, empezar] = useTransition()
  const valor = opcion === "otro" ? otro.trim() : opcion

  return (
    <section id="negocio" className="scroll-mt-28 rounded-[16px] bg-white/80 p-5 shadow-[0_8px_24px_-12px_rgba(20,32,51,0.18)] ring-1 ring-[#142033]/5 backdrop-blur-md sm:p-6">
      <h2 className="m-0 text-[19px] font-bold text-[#142033]">Tu negocio</h2>
      <p className="m-0 mb-4 mt-1 text-[14px] text-[#6B6A63]">
        ¿A qué te dedicas? Así los talleres entienden mejor lo que necesitas. Nunca compartimos tu correo ni tu teléfono.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={opcion}
          onChange={(e) => setOpcion(e.target.value)}
          className="h-11 rounded-[10px] border border-[#D9D5C9] bg-white px-3 text-[15px] text-[#1B1B18]"
        >
          <option value="">Elige tu giro</option>
          {GIROS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
          <option value="otro">Otro…</option>
        </select>
        {opcion === "otro" && (
          <input
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            maxLength={60}
            placeholder="Escribe tu giro"
            className="h-11 rounded-[10px] border border-[#D9D5C9] bg-white px-3 text-[15px]"
          />
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pendiente || !valor || valor === inicial}
          onClick={() =>
            empezar(async () => {
              const r = await guardarGiro(valor)
              setMsg(r.ok ? { ok: true, t: "Guardado." } : { ok: false, t: r.error })
            })
          }
          className="rounded-[10px] bg-gradient-to-b from-[#D9600B] to-[#C2560A] px-5 py-2.5 text-[14.5px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(217,96,11,0.7)] disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {msg && <span className={`text-[14px] font-semibold ${msg.ok ? "text-[#14683F]" : "text-[#B3261E]"}`}>{msg.t}</span>}
      </div>
    </section>
  )
}
