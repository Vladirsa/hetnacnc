"use client"

import { useState } from "react"

import { guardarMiEmpresa, type MiEmpresa } from "@/lib/cotizar/solicitud-taller"

const campo = "w-full rounded-xl border border-[#E7E4DC] bg-white px-4 py-3 text-[15px] text-[#142033] outline-none focus:border-[#C2560A]"
const USOS = ["G03 Gastos en general", "G01 Adquisición de mercancías", "I08 Otra maquinaria y equipo", "S01 Sin efectos fiscales"]

export function FormEmpresa({ inicial }: { inicial: MiEmpresa | null }) {
  const [f, setF] = useState<MiEmpresa>(inicial || { razon_social: "", rfc: "", regimen: "", uso_cfdi: USOS[0], cp: "", correo: "" })
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const set = (k: keyof MiEmpresa) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setOcupado(true); setMsg(null)
        const r = await guardarMiEmpresa(f)
        setOcupado(false)
        setMsg(r.ok ? { ok: true, t: "Guardado. Marca “Necesito factura” al pedir y el taller recibirá estos datos." } : { ok: false, t: r.mensaje || "No se pudo guardar." })
      }}
    >
      <input className={campo} required placeholder="Razón social (como en tu constancia) *" value={f.razon_social} onChange={set("razon_social")} maxLength={160} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={campo} required placeholder="RFC *" value={f.rfc} onChange={set("rfc")} maxLength={16} />
        <input className={campo} placeholder="Código postal fiscal" inputMode="numeric" value={f.cp} onChange={set("cp")} maxLength={5} />
        <input className={campo} placeholder="Régimen fiscal (ej. 601 General de Ley)" value={f.regimen} onChange={set("regimen")} maxLength={80} />
        <select className={campo} value={f.uso_cfdi} onChange={set("uso_cfdi")}>
          {USOS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
      <input className={campo} type="email" placeholder="Correo para recibir facturas (opcional)" value={f.correo} onChange={set("correo")} maxLength={120} />
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-[#0F7A4A]" : "text-[#B3261E]"}`}>{msg.t}</p>}
      <button disabled={ocupado} className="rounded-xl bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60">
        {ocupado ? "Guardando…" : "Guardar datos de facturación"}
      </button>
    </form>
  )
}
