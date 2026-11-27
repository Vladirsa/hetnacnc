"use client"

// Formulario del programa de creadores: la solicitud queda en HETNA (Panel →
// App → Creadores) y el código se manda por correo.
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

import { enviarSolicitudCreador } from "@/lib/hetna/creador-acciones"

const campo = "w-full rounded-xl border border-[#E7E4DC] bg-white px-4 py-3 text-[15px] text-[#142033] outline-none focus:border-[#C2560A]"

export function FormCreador() {
  const [f, setF] = useState({ nombre: "", correo: "", red: "youtube", canal_url: "", seguidores: "", mensaje: "", sitio_web: "" })
  const [estado, setEstado] = useState<"" | "enviando" | "ok">("")
  const [error, setError] = useState("")
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  if (estado === "ok") {
    return (
      <div className="rounded-2xl border border-[#BFE3CC] bg-[#E6F4EA] p-6 text-center">
        <p className="text-3xl">✅</p>
        <p className="mt-2 text-lg font-bold text-[#0F7A4A]"><T>¡Recibimos tu solicitud!</T></p>
        <p className="mt-1 text-sm text-[#40403A]"><T>Te mandamos tu código y tu página propia a</T> <b><T>{f.correo}</T></b> <T>en cuanto la revisemos.</T></p>
      </div>
    )
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setEstado("enviando"); setError("")
        const r = await enviarSolicitudCreador(f)
        if (!r.ok) { setEstado(""); setError(r.mensaje || "No se pudo enviar."); return }
        setEstado("ok")
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={campo} required placeholder="Tu nombre o el de tu canal *" value={f.nombre} onChange={set("nombre")} maxLength={80} />
        <input className={campo} required type="email" placeholder="Correo (ahí te llega tu código) *" value={f.correo} onChange={set("correo")} maxLength={120} />
        <select className={campo} value={f.red} onChange={set("red")}>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="otra">Otra (blog, curso, comunidad)</option>
        </select>
        <select className={campo} value={f.seguidores} onChange={set("seguidores")}>
          <option value="">Seguidores aprox.</option>
          <option>Menos de 1,000</option>
          <option>1,000 a 10,000</option>
          <option>10,000 a 100,000</option>
          <option>Más de 100,000</option>
        </select>
      </div>
      <input className={campo} required type="url" placeholder="Liga de tu canal o perfil (https://…) *" value={f.canal_url} onChange={set("canal_url")} maxLength={300} />
      <textarea className={`${campo} min-h-[90px]`} placeholder="¿De qué hablas en tu canal? ¿Usas router, láser, plasma? (opcional)" value={f.mensaje} onChange={set("mensaje")} maxLength={600} />
      <input type="text" tabIndex={-1} autoComplete="off" value={f.sitio_web} onChange={set("sitio_web")} className="hidden" aria-hidden="true" />
      {error && <p className="text-sm font-semibold text-[#B3261E]"><T>{error}</T></p>}
      <button disabled={estado === "enviando"} className="rounded-xl bg-[#C2560A] px-7 py-3.5 text-lg font-semibold text-white hover:brightness-110 disabled:opacity-60">
        <T>{estado === "enviando" ? "Enviando…" : "Quiero mi código de creador"}</T>
      </button>
      <p className="text-center text-[12px] text-[#7A776E]"><T>Usamos tus datos sólo para darte de alta como creador HETNA.</T></p>
    </form>
  )
}
