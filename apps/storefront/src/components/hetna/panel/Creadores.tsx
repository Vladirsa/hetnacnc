"use client"

// HETNA Panel → App → Creadores: crear códigos de creador, pausarlos, cambiar
// su premio y atender las solicitudes del formulario de /creadores.
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

async function accion(cuerpo: unknown): Promise<string> {
  const r = await fetch("/api/app/panel/accion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ruta: "/admin/hetna-creadores", cuerpo, area: "distribuidores" }),
  })
  const j = (await r.json().catch(() => ({}))) as { message?: string }
  return r.ok ? "" : j.message || "No se pudo."
}

const input = "w-full rounded-lg border border-[#E7E4DC] bg-white px-3 py-2 text-[14px]"
const sugerir = (nombre: string) => nombre.toUpperCase().normalize("NFD").replace(/[^A-Z0-9]/g, "").slice(0, 16)

type Inicial = { solicitud_id?: number; nombre?: string; correo?: string; canal_url?: string; red?: string }

export function NuevoCreador({ inicial, etiqueta = "+ Nuevo creador" }: { inicial?: Inicial; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({
    nombre: inicial?.nombre || "",
    codigo: sugerir(inicial?.nombre || ""),
    correo: inicial?.correo || "",
    canal_url: inicial?.canal_url || "",
    red: inicial?.red || "youtube",
    mensaje: "",
    dias: "30",
    meses_por_taller: "1",
    comision_pct: "0",
  })
  const [msg, setMsg] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: k === "codigo" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value })
  if (!abierto)
    return (
      <button onClick={() => setAbierto(true)} className="rounded-lg bg-[#C2560A] px-3 py-2 text-[13px] font-bold text-white">
        <T>{etiqueta}</T>
      </button>
    )
  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-[#F8F7F2] p-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Nombre o canal" value={f.nombre} onChange={set("nombre")} />
        <input className={input} placeholder="Código (ej. CNCJUAN)" value={f.codigo} onChange={set("codigo")} maxLength={24} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} type="email" placeholder="Correo (le llega su código)" value={f.correo} onChange={set("correo")} />
        <select className={input} value={f.red} onChange={set("red")}>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="otra">Otra</option>
        </select>
      </div>
      <input className={input} placeholder="Liga del canal (https://…)" value={f.canal_url} onChange={set("canal_url")} />
      <input className={input} placeholder="Frase en su página (opcional, ej. «Yo cotizo así mis trabajos»)" value={f.mensaje} onChange={set("mensaje")} maxLength={280} />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-[11px] text-[#6B675C]">
          <T>Días para su audiencia</T>
          <input className={input} type="number" min={1} max={365} value={f.dias} onChange={set("dias")} />
        </label>
        <label className="text-[11px] text-[#6B675C]">
          <T>Meses para él por taller que paga</T>
          <input className={input} type="number" min={0} max={12} value={f.meses_por_taller} onChange={set("meses_por_taller")} />
        </label>
        <label className="text-[11px] text-[#6B675C]">
          <T>Comisión % (0 = sin dinero)</T>
          <input className={input} type="number" min={0} max={50} step="0.5" value={f.comision_pct} onChange={set("comision_pct")} />
        </label>
      </div>
      {msg && <p className="text-[12px] font-semibold text-[#B3261E]">{msg}</p>}
      <div className="flex gap-2">
        <button
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true); setMsg("")
            const e = await accion({ accion: inicial?.solicitud_id ? "crear_para_solicitud" : "crear", solicitud_id: inicial?.solicitud_id, ...f })
            setOcupado(false)
            if (e) return setMsg(e)
            window.location.reload()
          }}
          className="rounded-lg bg-[#0F7A4A] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50"
        >
          <T>Crear y mandarle su código</T>
        </button>
        <button onClick={() => setAbierto(false)} className="rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-[#40403A]"><T>Cancelar</T></button>
      </div>
    </div>
  )
}

export function AccionesCreador({ codigo, activo, liga, meses, comision }: { codigo: string; activo: boolean; liga: string; meses: number; comision: number }) {
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const correr = async (cuerpo: Record<string, unknown>) => {
    setOcupado(true)
    const e = await accion({ codigo, ...cuerpo })
    setOcupado(false)
    if (e) return alert(e)
    window.location.reload()
  }
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <button
        onClick={async () => { try { await navigator.clipboard.writeText(liga); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch {} }}
        className="rounded-lg bg-[#E8F0FB] px-3 py-1.5 text-[12px] font-bold text-[#1D4F8C]"
      >
        {copiado ? "¡Copiada!" : "Copiar su página"}
      </button>
      <a href={liga} target="_blank" rel="noreferrer" className="rounded-lg bg-[#F3F1EA] px-3 py-1.5 text-[12px] font-bold text-[#40403A]"><T>Ver página</T></a>
      <button
        disabled={ocupado}
        onClick={() => {
          const m = prompt("Meses de HETNA Taller para el creador por cada taller que paga (0 a 12):", String(meses))
          if (m == null) return
          const c = prompt("Comisión en % sobre el primer pago (0 = sin dinero):", String(comision))
          if (c == null) return
          correr({ accion: "premio", meses_por_taller: m, comision_pct: c })
        }}
        className="rounded-lg bg-[#FFF6E0] px-3 py-1.5 text-[12px] font-bold text-[#8A5A00] disabled:opacity-50"
      >
        <T>Cambiar premio</T>
      </button>
      <button
        disabled={ocupado}
        onClick={() => { if (!activo || confirm(`¿Pausar ${codigo}? Su página deja de funcionar.`)) correr({ accion: activo ? "pausar" : "activar" }) }}
        className={`rounded-lg px-3 py-1.5 text-[12px] font-bold disabled:opacity-50 ${activo ? "bg-[#FDECEA] text-[#B3261E]" : "bg-[#E6F4EA] text-[#0F7A4A]"}`}
      >
        {activo ? "Pausar" : "Activar"}
      </button>
    </div>
  )
}

export function DescartarSolicitud({ id, nombre }: { id: number; nombre: string }) {
  const [ocupado, setOcupado] = useState(false)
  return (
    <button
      disabled={ocupado}
      onClick={async () => {
        if (!confirm(`¿Descartar la solicitud de ${nombre}?`)) return
        setOcupado(true)
        const e = await accion({ accion: "descartar", solicitud_id: id })
        setOcupado(false)
        if (e) return alert(e)
        window.location.reload()
      }}
      className="rounded-lg bg-[#F3F1EA] px-3 py-1.5 text-[12px] font-bold text-[#40403A] disabled:opacity-50"
    >
      <T>Descartar</T>
    </button>
  )
}
