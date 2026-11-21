"use client"

import { useState } from "react"

import { registrarLatam } from "@/lib/hetna/latam"
import { PAISES_LATAM } from "./paises"

const campo = "w-full rounded-xl border border-[#E7E4DC] bg-white px-4 py-3 text-[15px] text-[#142033] outline-none focus:border-[#C2560A]"

export function FormLatam() {
  const [f, setF] = useState({ pais: "", tipo: "taller", nombre: "", empresa: "", correo: "", telefono: "", ciudad: "", maquinas: "", mensaje: "", sitio_web: "" })
  const [estado, setEstado] = useState<"" | "enviando" | "ok">("")
  const [error, setError] = useState("")
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  if (estado === "ok") {
    const p = PAISES_LATAM.find((x) => x.clave === f.pais)
    return (
      <div className="rounded-2xl border border-[#BFE3CC] bg-[#E6F4EA] p-6 text-center">
        <p className="text-3xl">{p?.bandera || "✅"}</p>
        <p className="mt-2 text-lg font-bold text-[#0F7A4A]">¡Listo, ya estás en la lista de {p?.nombre}!</p>
        <p className="mt-1 text-sm text-[#40403A]">Te avisamos a <b>{f.correo}</b> en cuanto abramos tu país, antes que a nadie.</p>
      </div>
    )
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setEstado("enviando"); setError("")
        const r = await registrarLatam(f)
        if (!r.ok) { setEstado(""); setError(r.mensaje || "No se pudo enviar."); return }
        setEstado("ok")
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {[["taller", "Tengo un taller CNC", "Quiero recibir trabajos y usar el Cotizador"], ["cliente", "Necesito piezas", "Quiero mandar a fabricar o comprar"]].map(([v, t, d]) => (
          <button type="button" key={v} onClick={() => setF({ ...f, tipo: v })} className={`rounded-xl border p-3 text-left ${f.tipo === v ? "border-[#C2560A] bg-[#FFF8F1]" : "border-[#E7E4DC] bg-white"}`}>
            <span className="block text-sm font-bold text-[#142033]">{t}</span>
            <span className="block text-xs text-[#6B675C]">{d}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select className={campo} required value={f.pais} onChange={set("pais")}>
          <option value="">¿En qué país estás? *</option>
          {PAISES_LATAM.map((p) => (
            <option key={p.clave} value={p.clave}>{p.bandera} {p.nombre}</option>
          ))}
        </select>
        <input className={campo} placeholder="Ciudad" value={f.ciudad} onChange={set("ciudad")} maxLength={80} />
        <input className={campo} required placeholder="Tu nombre *" value={f.nombre} onChange={set("nombre")} maxLength={100} />
        <input className={campo} placeholder={f.tipo === "taller" ? "Nombre del taller" : "Empresa (opcional)"} value={f.empresa} onChange={set("empresa")} maxLength={120} />
        <input className={campo} required type="email" placeholder="Correo *" value={f.correo} onChange={set("correo")} maxLength={120} />
        <input className={campo} type="tel" placeholder="WhatsApp (con código de país)" value={f.telefono} onChange={set("telefono")} maxLength={30} />
      </div>
      {f.tipo === "taller" && (
        <input className={campo} required placeholder="¿Qué máquinas tienes? (router, láser, plasma, fibra, torno, 3D…) *" value={f.maquinas} onChange={set("maquinas")} maxLength={200} />
      )}
      <textarea className={`${campo} min-h-[80px]`} placeholder={f.tipo === "taller" ? "¿Qué tipo de trabajos haces? (opcional)" : "¿Qué piezas necesitas? (opcional)"} value={f.mensaje} onChange={set("mensaje")} maxLength={600} />
      <input type="text" tabIndex={-1} autoComplete="off" value={f.sitio_web} onChange={set("sitio_web")} className="hidden" aria-hidden="true" />
      {error && <p className="text-sm font-semibold text-[#B3261E]">{error}</p>}
      <button disabled={estado === "enviando"} className="rounded-xl bg-[#C2560A] px-7 py-3.5 text-lg font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {estado === "enviando" ? "Enviando…" : f.tipo === "taller" ? "Apuntarme como taller fundador" : "Avísenme cuando abran"}
      </button>
      <p className="text-center text-[12px] text-[#7A776E]">Usamos tus datos sólo para avisarte cuando HETNA abra en tu país.</p>
    </form>
  )
}
