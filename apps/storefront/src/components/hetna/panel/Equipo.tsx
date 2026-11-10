"use client"

import { useState } from "react"

import { ROLES, type Rol } from "@/lib/panel/roles"

type U = { id: string; email: string; nombre: string; rol: Rol; esYo: boolean }

export function Equipo({ usuarios, error }: { usuarios: U[]; error: string }) {
  const [lista, setLista] = useState(usuarios)
  const [msg, setMsg] = useState("")
  const [email, setEmail] = useState("")
  const [rolNuevo, setRolNuevo] = useState<Rol>("operaciones")
  const [liga, setLiga] = useState("")
  const [ocupado, setOcupado] = useState(false)

  const cambiar = async (id: string, rol: Rol) => {
    setMsg(""); setOcupado(true)
    const r = await fetch("/api/app/panel/equipo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "rol", user_id: id, rol }) })
    const j = (await r.json().catch(() => ({}))) as { message?: string }
    setOcupado(false)
    if (!r.ok) { setMsg(j.message || "No se pudo."); return }
    setLista((l) => l.map((u) => (u.id === id ? { ...u, rol } : u)))
    setMsg("Rol guardado.")
  }
  const invitar = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(""); setLiga(""); setOcupado(true)
    const r = await fetch("/api/app/panel/equipo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "invitar", email, rol: rolNuevo }) })
    const j = (await r.json().catch(() => ({}))) as { message?: string; liga?: string }
    setOcupado(false)
    if (!r.ok) { setMsg(j.message || "No se pudo invitar."); return }
    setLiga(j.liga || "")
  }
  const sel = "h-9 rounded-lg border border-[#E7E4DC] bg-white px-2 text-[13px]"
  return (
    <>
      <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
        <h2 className="mb-3 text-[15px] font-extrabold">Quién entra</h2>
        {error && <p className="text-sm text-[#B3261E]">{error}</p>}
        <ul className="divide-y divide-[#EFEDE6]">
          {lista.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold">{u.nombre || u.email}{u.esYo ? " (tú)" : ""}</p>
                <p className="truncate text-[11.5px] text-[#6B675C]">{u.email}</p>
              </div>
              <select className={sel} value={u.rol} disabled={ocupado || u.esYo} onChange={(e) => cambiar(u.id, e.target.value as Rol)}>
                {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
              </select>
            </li>
          ))}
        </ul>
        {msg && <p className="mt-2 text-[12.5px] font-semibold text-[#0F7A4A]">{msg}</p>}
      </section>
      <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
        <h2 className="mb-1 text-[15px] font-extrabold">Invitar a alguien</h2>
        <p className="mb-3 text-[12px] text-[#6B675C]">Se crea su cuenta de administrador. Mándale la liga por WhatsApp; cuando acepte y ponga su contraseña, aquí le asignas el rol (mientras, entra como "Sin acceso").</p>
        <form onSubmit={invitar} className="flex flex-wrap gap-2">
          <input className="h-10 min-w-[200px] flex-1 rounded-lg border border-[#E7E4DC] px-3 text-[14px]" type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select className="h-10 rounded-lg border border-[#E7E4DC] bg-white px-2 text-[13px]" value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value as Rol)}>
            {Object.entries(ROLES).filter(([k]) => k !== "sin_acceso").map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
          </select>
          <button disabled={ocupado} className="h-10 rounded-lg bg-[#C2560A] px-4 text-[14px] font-bold text-white disabled:opacity-60">Crear invitación</button>
        </form>
        {liga && (
          <div className="mt-3 rounded-xl bg-[#F8F7F2] p-3">
            <p className="text-[12px] font-semibold text-[#142033]">Liga de invitación (válida unos días):</p>
            <p className="break-all text-[12px] text-[#1D4F8C]">{liga}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => navigator.clipboard?.writeText(liga)} className="rounded-lg border border-[#E7E4DC] px-3 py-1.5 text-[12px] font-semibold">Copiar</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Te invito al HETNA Panel. Abre esta liga, pon tu nombre y contraseña: ${liga}`)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#E6F4EC] px-3 py-1.5 text-[12px] font-bold text-[#0F7A4A]">Mandar por WhatsApp</a>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
