"use client"

// Botones de acción del HETNA Panel (licitaciones y talleres). Cada uno llama
// a /api/app/panel/accion y recarga la página.
import { useState } from "react"

async function accion(ruta: string, cuerpo: unknown, area: string): Promise<string> {
  const r = await fetch("/api/app/panel/accion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ruta, cuerpo, area }) })
  const j = (await r.json().catch(() => ({}))) as { message?: string }
  return r.ok ? "" : j.message || "No se pudo."
}

const B = "rounded-lg px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"

export function AccionesLicitacion({ id, etapa, etapas }: { id: string; etapa: string; etapas: { clave: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState<"" | "info" | "cancelar" | "etapa" | "nota">("")
  const [nota, setNota] = useState("")
  const [nuevaEtapa, setNuevaEtapa] = useState(etapa)
  const [msg, setMsg] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const ruta = `/admin/hetna-solicitudes/${id}/accion`
  const correr = async (cuerpo: unknown) => {
    setOcupado(true); setMsg("")
    const e = await accion(ruta, cuerpo, "licitaciones")
    setOcupado(false)
    if (e) { setMsg(e); return }
    window.location.reload()
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {(etapa === "en_revision" || etapa === "nueva") && (
          <button disabled={ocupado} onClick={() => { if (confirm("¿Aprobar y mandarla a los talleres?")) correr({ accion: "aprobar" }) }} className={`${B} bg-[#0F7A4A] text-white`}>✓ Aprobar y enviar a talleres</button>
        )}
        {(etapa === "en_revision" || etapa === "nueva") && <button disabled={ocupado} onClick={() => setAbierto(abierto === "info" ? "" : "info")} className={`${B} bg-[#FFF1E6] text-[#B54708]`}>Pedir información</button>}
        {etapa !== "cancelada" && etapa !== "cerrada" && <button disabled={ocupado} onClick={() => setAbierto(abierto === "cancelar" ? "" : "cancelar")} className={`${B} bg-[#FDECEA] text-[#B3261E]`}>Cancelar</button>}
        <button disabled={ocupado} onClick={() => setAbierto(abierto === "etapa" ? "" : "etapa")} className={`${B} bg-[#E8F0FB] text-[#1D4F8C]`}>Mover etapa</button>
        <button disabled={ocupado} onClick={() => setAbierto(abierto === "nota" ? "" : "nota")} className={`${B} bg-[#F3F1EA] text-[#40403A]`}>Nota</button>
      </div>
      {abierto && (
        <div className="mt-2 grid gap-2 rounded-xl bg-[#F8F7F2] p-3">
          {abierto === "etapa" && (
            <select className="h-10 rounded-lg border border-[#E7E4DC] bg-white px-2 text-[13px]" value={nuevaEtapa} onChange={(e) => setNuevaEtapa(e.target.value)}>
              {etapas.map((e) => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
            </select>
          )}
          <textarea className="min-h-[70px] rounded-lg border border-[#E7E4DC] bg-white p-2 text-[13px]" placeholder={abierto === "info" ? "¿Qué le falta al cliente? (le llega por correo)" : abierto === "cancelar" ? "Motivo (le llega al cliente)" : abierto === "etapa" ? "Nota (opcional)" : "Nota interna"} value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={ocupado || (abierto !== "etapa" && !nota.trim())} onClick={() => correr(
              abierto === "info" ? { accion: "pedir_info", nota } : abierto === "cancelar" ? { accion: "cancelar", nota } : abierto === "etapa" ? { accion: "etapa", etapa: nuevaEtapa, nota } : { accion: "nota", nota, interna: true }
            )} className={`${B} bg-[#142033] text-white`}>{ocupado ? "Guardando…" : "Confirmar"}</button>
            <button onClick={() => setAbierto("")} className={`${B} bg-white text-[#40403A]`}>Cerrar</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-1 text-[12px] font-semibold text-[#B3261E]">{msg}</p>}
    </div>
  )
}

export function AccionesVerificacion({ sellerId, estado }: { sellerId: string; estado: string }) {
  const [abierto, setAbierto] = useState<"" | "rechazar" | "revocar">("")
  const [motivo, setMotivo] = useState("")
  const [msg, setMsg] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const ruta = `/admin/hetna-verificacion/${sellerId}`
  const correr = async (cuerpo: unknown) => {
    setOcupado(true); setMsg("")
    const e = await accion(ruta, cuerpo, "talleres")
    setOcupado(false)
    if (e) { setMsg(e); return }
    window.location.reload()
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {estado !== "verificado" && <button disabled={ocupado} onClick={() => { if (confirm("¿Aprobar este taller? Le sale la insignia de verificado.")) correr({ accion: "aprobar" }) }} className={`${B} bg-[#0F7A4A] text-white`}>✓ Aprobar</button>}
        {estado !== "verificado" && <button disabled={ocupado} onClick={() => setAbierto(abierto === "rechazar" ? "" : "rechazar")} className={`${B} bg-[#FDECEA] text-[#B3261E]`}>Rechazar</button>}
        {estado === "verificado" && <button disabled={ocupado} onClick={() => setAbierto(abierto === "revocar" ? "" : "revocar")} className={`${B} bg-[#FFF1E6] text-[#B54708]`}>Quitar verificación</button>}
      </div>
      {abierto && (
        <div className="mt-2 grid gap-2 rounded-xl bg-[#F8F7F2] p-3">
          <textarea className="min-h-[70px] rounded-lg border border-[#E7E4DC] bg-white p-2 text-[13px]" placeholder="Motivo (el taller lo ve y puede corregir)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={ocupado || !motivo.trim()} onClick={() => correr({ accion: abierto, motivo })} className={`${B} bg-[#142033] text-white`}>{ocupado ? "Guardando…" : "Confirmar"}</button>
            <button onClick={() => setAbierto("")} className={`${B} bg-white text-[#40403A]`}>Cerrar</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-1 text-[12px] font-semibold text-[#B3261E]">{msg}</p>}
    </div>
  )
}
