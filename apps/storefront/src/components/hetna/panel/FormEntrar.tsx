"use client"

import { useState } from "react"

export function FormEntrar({ destino }: { destino: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setCargando(true)
    try {
      const r = await fetch("/api/app/panel/entrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })
      const j = (await r.json().catch(() => ({}))) as { message?: string }
      if (!r.ok) { setError(j.message || "No se pudo entrar."); return }
      window.location.href = destino
    } catch { setError("Sin conexión.") } finally { setCargando(false) }
  }
  const campo = "h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-[16px] text-white placeholder-white/40 outline-none focus:border-[#C2560A]"
  return (
    <form onSubmit={entrar} className="grid gap-3">
      <input className={campo} type="email" autoComplete="username" inputMode="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={campo} type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="rounded-lg bg-[#B3261E]/20 px-3 py-2 text-sm text-[#FFB4A8]">{error}</p>}
      <button disabled={cargando} className="h-12 rounded-xl bg-[#C2560A] text-[16px] font-bold text-white disabled:opacity-60">{cargando ? "Entrando…" : "Entrar"}</button>
    </form>
  )
}
