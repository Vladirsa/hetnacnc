"use client"

// Formulario para distribuidores: la solicitud queda dentro de HETNA (panel →
// Referidos y distribuidores) y el código se le manda por correo. No sale a
// WhatsApp ni a ningún canal de fuera.
import { useState } from "react"

const campo = "w-full rounded-xl border border-[#E7E4DC] bg-white px-4 py-3 text-[15px] text-[#142033] outline-none focus:border-[#C2560A]"

export function FormDistribuidor() {
  const [f, setF] = useState({ empresa: "", contacto: "", correo: "", telefono: "", ciudad: "", maquinas: "", ventas_mes: "", mensaje: "", sitio_web: "" })
  const [estado, setEstado] = useState<"" | "enviando" | "ok">("")
  const [error, setError] = useState("")
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  if (estado === "ok") {
    return (
      <div className="rounded-2xl border border-[#BFE3CC] bg-[#E6F4EA] p-6 text-center">
        <p className="text-3xl">✅</p>
        <p className="mt-2 text-lg font-bold text-[#0F7A4A]">¡Recibimos tu solicitud!</p>
        <p className="mt-1 text-sm text-[#40403A]">Te mandamos tu código y tu página propia a <b>{f.correo}</b> en cuanto la revisemos.</p>
      </div>
    )
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setEstado("enviando"); setError("")
        try {
          const r = await fetch("/api/distribuidor-solicitud", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) })
          const j = (await r.json().catch(() => ({}))) as { message?: string }
          if (!r.ok) { setEstado(""); setError(j.message || "No se pudo enviar."); return }
          setEstado("ok")
        } catch {
          setEstado(""); setError("No se pudo enviar. Revisa tu conexión.")
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={campo} required placeholder="Empresa *" value={f.empresa} onChange={set("empresa")} maxLength={100} />
        <input className={campo} required placeholder="Tu nombre *" value={f.contacto} onChange={set("contacto")} maxLength={80} />
        <input className={campo} required type="email" placeholder="Correo (ahí te llega tu código) *" value={f.correo} onChange={set("correo")} maxLength={120} />
        <input className={campo} type="tel" placeholder="Teléfono" value={f.telefono} onChange={set("telefono")} maxLength={30} />
        <input className={campo} placeholder="Ciudad y estado" value={f.ciudad} onChange={set("ciudad")} maxLength={80} />
        <select className={campo} value={f.ventas_mes} onChange={set("ventas_mes")}>
          <option value="">Máquinas que vendes al mes</option>
          <option>1 a 3</option>
          <option>4 a 10</option>
          <option>11 a 30</option>
          <option>Más de 30</option>
        </select>
      </div>
      <input className={campo} required placeholder="¿Qué máquinas vendes? (router, láser CO₂, plasma, fibra…) *" value={f.maquinas} onChange={set("maquinas")} maxLength={160} />
      <textarea className={`${campo} min-h-[90px]`} placeholder="Algo más que debamos saber (opcional)" value={f.mensaje} onChange={set("mensaje")} maxLength={600} />
      {/* Trampa para robots: oculto para personas */}
      <input type="text" tabIndex={-1} autoComplete="off" value={f.sitio_web} onChange={set("sitio_web")} className="hidden" aria-hidden="true" />
      {error && <p className="text-sm font-semibold text-[#B3261E]">{error}</p>}
      <button disabled={estado === "enviando"} className="rounded-xl bg-[#C2560A] px-7 py-3.5 text-lg font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {estado === "enviando" ? "Enviando…" : "Quiero mi código de distribuidor"}
      </button>
      <p className="text-center text-[12px] text-[#7A776E]">Usamos tus datos sólo para darte de alta como distribuidor HETNA.</p>
    </form>
  )
}
