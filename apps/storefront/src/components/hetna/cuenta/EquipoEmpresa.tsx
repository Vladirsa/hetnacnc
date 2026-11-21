"use client"

// Mi empresa → equipo (estrategia 2.4, parte 2): crear la empresa, invitar a
// compras, ingeniería o almacén, activar la aprobación de pedidos y aprobar o
// rechazar lo que piden los compradores.
import { useState } from "react"
import { useRouter } from "next/navigation"

import { accionEquipo, type MiEquipo } from "@/lib/cotizar/solicitud-taller"

const campo = "w-full rounded-xl border border-[#E7E4DC] bg-white px-4 py-2.5 text-[14px] text-[#142033] outline-none focus:border-[#C2560A]"

export function EquipoEmpresa({ equipo }: { equipo: MiEquipo }) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [nombre, setNombre] = useState("")
  const [correo, setCorreo] = useState("")
  const [rol, setRol] = useState("comprador")

  const correr = async (cuerpo: Record<string, unknown>, exito: string) => {
    setOcupado(true)
    setMsg(null)
    const r = await accionEquipo(cuerpo)
    setOcupado(false)
    if (!r.ok) return setMsg({ ok: false, t: r.mensaje || "No se pudo." })
    setMsg({ ok: true, t: exito })
    router.refresh()
  }

  if (!equipo.empresa) {
    return (
      <div className="grid gap-3">
        <p className="text-[14px] text-[#4A4943]">
          Crea tu empresa para invitar a tu equipo (compras, ingeniería, almacén): verán las mismas piezas, podrán repetir pedidos y, si quieres, los pedidos de los compradores necesitarán tu aprobación.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={campo} placeholder="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
          <button disabled={ocupado} onClick={() => correr({ accion: "crear", nombre }, "Empresa creada. Ya puedes invitar a tu equipo.")} className="rounded-xl bg-[#C2560A] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60">
            Crear empresa
          </button>
        </div>
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-[#0F7A4A]" : "text-[#B3261E]"}`}>{msg.t}</p>}
      </div>
    )
  }

  const admin = equipo.rol === "admin"
  const pendientes = equipo.por_aprobar || []
  return (
    <div className="grid gap-4">
      <p className="text-[14px] text-[#4A4943]">
        <b className="text-[#142033]">{equipo.empresa.nombre}</b> · eres {admin ? "administrador" : "comprador"}
        {equipo.empresa.aprobacion ? " · los pedidos de compradores necesitan aprobación" : ""}
      </p>

      {admin && pendientes.length > 0 && (
        <div className="rounded-xl border border-[#F2C9A5] bg-[#FFF8F1] p-4">
          <p className="text-[14px] font-bold text-[#8A3D06]">Pedidos por aprobar ({pendientes.length})</p>
          <ul className="mt-2 grid gap-3">
            {pendientes.map((p) => (
              <li key={p.folio} className="rounded-lg bg-white p-3 text-[13px]">
                <p className="font-semibold text-[#142033]">
                  {p.folio} · {p.quien}
                </p>
                <p className="text-[#40403A]">{p.resumen}</p>
                <p className="line-clamp-2 text-[#6B675C]">{p.descripcion}</p>
                <div className="mt-2 flex gap-2">
                  <button disabled={ocupado} onClick={() => correr({ accion: "aprobar", folio: p.folio }, `${p.folio} aprobado: ya va a los talleres.`)} className="rounded-lg bg-[#0F7A4A] px-3 py-1.5 font-semibold text-white disabled:opacity-60">
                    Aprobar
                  </button>
                  <button disabled={ocupado} onClick={() => { if (confirm(`¿Rechazar ${p.folio}? Se cancela.`)) correr({ accion: "rechazar", folio: p.folio }, `${p.folio} rechazado.`) }} className="rounded-lg bg-[#F3F1EA] px-3 py-1.5 font-semibold text-[#40403A] disabled:opacity-60">
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-[13px] font-bold text-[#142033]">Equipo</p>
        <ul className="mt-1 divide-y divide-[#EFEDE6] rounded-xl border border-[#E7E4DC] bg-white">
          {(equipo.miembros || []).map((m) => (
            <li key={m.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
              <span>
                {m.email} · <span className="text-[#6B675C]">{m.rol === "admin" ? "administrador" : "comprador"}{m.estado === "invitado" ? " (invitación enviada)" : ""}</span>
              </span>
              {admin && (
                <button disabled={ocupado} onClick={() => { if (confirm(`¿Quitar a ${m.email} del equipo?`)) correr({ accion: "quitar", email: m.email }, "Listo.") }} className="text-[12px] font-semibold text-[#B3261E]">
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {admin && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={campo} type="email" placeholder="Correo de la persona" value={correo} onChange={(e) => setCorreo(e.target.value)} />
            <select className={`${campo} sm:max-w-[170px]`} value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="comprador">Comprador</option>
              <option value="admin">Administrador</option>
            </select>
            <button disabled={ocupado} onClick={() => correr({ accion: "invitar", email: correo, rol }, `Invitación enviada a ${correo}.`).then(() => setCorreo(""))} className="rounded-xl bg-[#142033] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60">
              Invitar
            </button>
          </div>
          <label className="flex items-start gap-2 text-[14px] text-[#40403A]">
            <input
              type="checkbox"
              checked={equipo.empresa.aprobacion}
              disabled={ocupado}
              onChange={(e) => correr({ accion: "aprobacion", activa: e.target.checked }, e.target.checked ? "Aprobación activada." : "Aprobación desactivada.")}
              className="mt-1 accent-[#C2560A]"
            />
            <span>
              <b>Aprobación de pedidos:</b> lo que pida un comprador no llega a ningún taller hasta que un administrador lo apruebe.
            </span>
          </label>
        </>
      )}
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-[#0F7A4A]" : "text-[#B3261E]"}`}>{msg.t}</p>}
    </div>
  )
}
