"use client"

// HETNA Panel → App → Referidos y distribuidores: crear códigos, activarlos o
// pausarlos, y marcar como aplicado un "mes a favor" de un taller que paga.
import { useState } from "react"

async function accion(cuerpo: unknown): Promise<string> {
  const r = await fetch("/api/app/panel/accion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ruta: "/admin/hetna-distribuidores", cuerpo, area: "distribuidores" }),
  })
  const j = (await r.json().catch(() => ({}))) as { message?: string }
  return r.ok ? "" : j.message || "No se pudo."
}

const input = "w-full rounded-lg border border-[#E7E4DC] bg-white px-3 py-2 text-[14px]"

export function NuevoCodigo() {
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ nombre: "", codigo: "", dias: "90", max_usos: "", vence: "" })
  const [msg, setMsg] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: k === "codigo" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value })
  if (!abierto) return <button onClick={() => setAbierto(true)} className="rounded-lg bg-[#C2560A] px-3 py-2 text-[13px] font-bold text-white">+ Nuevo código</button>
  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-[#F8F7F2] p-3">
      <input className={input} placeholder="Distribuidor o promoción (ej. CNC del Bajío)" value={f.nombre} onChange={set("nombre")} />
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Código (ej. BAJIO90)" value={f.codigo} onChange={set("codigo")} maxLength={24} />
        <input className={input} type="number" min={1} max={365} placeholder="Días de regalo" value={f.dias} onChange={set("dias")} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} type="number" min={1} placeholder="Tope de usos (vacío = sin tope)" value={f.max_usos} onChange={set("max_usos")} />
        <input className={input} type="date" value={f.vence} onChange={set("vence")} title="Vence (opcional)" />
      </div>
      {msg && <p className="text-[12px] font-semibold text-[#B3261E]">{msg}</p>}
      <div className="flex gap-2">
        <button
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true); setMsg("")
            const e = await accion({ accion: "crear", ...f })
            setOcupado(false)
            if (e) return setMsg(e)
            window.location.reload()
          }}
          className="rounded-lg bg-[#0F7A4A] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50"
        >
          Crear código
        </button>
        <button onClick={() => setAbierto(false)} className="rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-[#40403A]">Cancelar</button>
      </div>
    </div>
  )
}

export function BotonCodigo({ codigo, activo, liga }: { codigo: string; activo: boolean; liga: string }) {
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <button
        onClick={async () => { try { await navigator.clipboard.writeText(liga); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch {} }}
        className="rounded-lg bg-[#E8F0FB] px-3 py-1.5 text-[12px] font-bold text-[#1D4F8C]"
      >
        {copiado ? "¡Copiada!" : "Copiar su página"}
      </button>
      <a href={liga} target="_blank" rel="noreferrer" className="rounded-lg bg-[#F3F1EA] px-3 py-1.5 text-[12px] font-bold text-[#40403A]">Ver página</a>
      <button
        disabled={ocupado}
        onClick={async () => {
          if (activo && !confirm(`¿Pausar ${codigo}? Los talleres ya no podrán usarlo.`)) return
          setOcupado(true)
          const e = await accion({ accion: activo ? "desactivar" : "activar", codigo })
          setOcupado(false)
          if (e) return alert(e)
          window.location.reload()
        }}
        className={`rounded-lg px-3 py-1.5 text-[12px] font-bold disabled:opacity-50 ${activo ? "bg-[#FDECEA] text-[#B3261E]" : "bg-[#E6F4EA] text-[#0F7A4A]"}`}
      >
        {activo ? "Pausar" : "Activar"}
      </button>
    </div>
  )
}

export function MesAplicado({ id, nombre }: { id: string; nombre: string }) {
  const [ocupado, setOcupado] = useState(false)
  return (
    <button
      disabled={ocupado}
      onClick={async () => {
        if (!confirm(`¿Ya le aplicaste 1 mes a ${nombre} en su cobro? Se descuenta de sus meses a favor.`)) return
        setOcupado(true)
        const e = await accion({ accion: "mes_aplicado", negocio_id: id })
        setOcupado(false)
        if (e) return alert(e)
        window.location.reload()
      }}
      className="rounded-lg bg-[#0F7A4A] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
    >
      ✓ Ya apliqué 1 mes
    </button>
  )
}

// Solicitud que llegó del formulario de /distribuidores: crear su código (se le
// manda por correo con su página) o descartarla.
export function AtenderSolicitud({ id, empresa }: { id: number; empresa: string }) {
  const sugerido = empresa.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) + "90"
  const [abierto, setAbierto] = useState(false)
  const [codigo, setCodigo] = useState(sugerido.length >= 4 ? sugerido : "")
  const [dias, setDias] = useState("90")
  const [msg, setMsg] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const enviar = async (cuerpo: Record<string, unknown>) => {
    setOcupado(true); setMsg("")
    const e = await accion({ solicitud_id: id, ...cuerpo })
    setOcupado(false)
    if (e) return setMsg(e)
    window.location.reload()
  }
  if (!abierto) {
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button onClick={() => setAbierto(true)} className="rounded-lg bg-[#0F7A4A] px-3 py-1.5 text-[12px] font-bold text-white">Crear su código</button>
        <button
          disabled={ocupado}
          onClick={() => { if (confirm(`¿Descartar la solicitud de ${empresa}?`)) enviar({ accion: "descartar" }) }}
          className="rounded-lg bg-[#F3F1EA] px-3 py-1.5 text-[12px] font-bold text-[#40403A] disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    )
  }
  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-[#F8F7F2] p-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Código" value={codigo} maxLength={24} onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
        <input className={input} type="number" min={1} max={365} placeholder="Días" value={dias} onChange={(e) => setDias(e.target.value)} />
      </div>
      <p className="text-[11px] text-[#6B675C]">Se crea el código y le llega por correo con su página.</p>
      {msg && <p className="text-[12px] font-semibold text-[#B3261E]">{msg}</p>}
      <div className="flex gap-2">
        <button disabled={ocupado} onClick={() => enviar({ accion: "crear_para_solicitud", codigo, dias, nombre: empresa })} className="rounded-lg bg-[#0F7A4A] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50">
          Crear y mandárselo
        </button>
        <button onClick={() => setAbierto(false)} className="rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-[#40403A]">Cancelar</button>
      </div>
    </div>
  )
}
