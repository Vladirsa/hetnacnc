"use client"

// Licitaciones 3.0 (Fase 1): en la liga privada del cliente, quién pidió ver
// sus planos (aprobar o rechazar) e invitar talleres a su licitación.
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { decidirAcceso, invitarTalleresSolicitud, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

const MODALIDAD: Record<string, string> = {
  publica: "Pública: la ve cualquier taller compatible",
  restringida: "Restringida: tus planos sólo los ve quien tú autorices",
  privada: "Privada: sólo los talleres que invitaste",
}

export default function AccesosSolicitud({ token, s }: { token: string; s: VistaSolicitud }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [talleres, setTalleres] = useState("")
  const [nota, setNota] = useState("")
  const accesos = s.accesos || []
  const invitados = s.invitados || []
  const abierta = s.estado === "abierta" || s.estado === "revision"

  const decidir = (sellerId: string, d: "aprobar" | "rechazar") =>
    iniciar(async () => {
      setNota("")
      const r = await decidirAcceso(token, sellerId, d)
      if (!r.ok) return setNota(r.mensaje)
      router.refresh()
    })

  const invitar = () =>
    iniciar(async () => {
      setNota("")
      const r = await invitarTalleresSolicitud(token, talleres)
      if (!r.ok) return setNota(r.mensaje)
      setTalleres("")
      setNota(`Listo, invitaste a ${(r.body.invitados || []).join(", ")}.`)
      router.refresh()
    })

  return (
    <section id="accesos" className="scroll-mt-24 rounded-2xl border border-[#E7E4DC] bg-white p-5">
      <h2 className="text-lg font-extrabold text-[#142033]">🔒 Privacidad de tu solicitud</h2>
      <p className="mt-1 text-sm text-[#40403A]">{MODALIDAD[s.modalidad || "publica"]}.{s.difundir_redes ? " Autorizaste difundir un resumen sin datos sensibles en redes." : ""}</p>

      {accesos.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-[#142033]">Talleres que piden ver tus planos</h3>
          <ul className="mt-2 grid gap-2">
            {accesos.map((a) => (
              <li key={a.seller_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E7E4DC] p-3 text-sm">
                <span>
                  <b>{a.taller}</b>
                  {a.mensaje && <span className="block text-[13px] text-[#6B675C]">“{a.mensaje}”</span>}
                </span>
                {a.estado === "pendiente" ? (
                  <span className="flex gap-2">
                    <button type="button" disabled={pendiente} onClick={() => decidir(a.seller_id, "aprobar")} className="rounded-lg bg-[#1E7A52] px-3 py-1.5 font-semibold text-white disabled:opacity-60">
                      Aprobar
                    </button>
                    <button type="button" disabled={pendiente} onClick={() => decidir(a.seller_id, "rechazar")} className="rounded-lg border border-[#E7E4DC] px-3 py-1.5 font-semibold text-[#40403A] disabled:opacity-60">
                      Rechazar
                    </button>
                  </span>
                ) : (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.estado === "aprobado" ? "bg-[#EAF3EE] text-[#1E7A52]" : "bg-[#F3F1EA] text-[#6B675C]"}`}>
                    {a.estado === "aprobado" ? "Aprobado" : "Rechazado"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {invitados.length > 0 && (
        <p className="mt-4 text-sm text-[#40403A]">
          <b>Invitados:</b> {invitados.map((i) => i.taller).join(", ")}
        </p>
      )}

      {abierta && (
        <div className="mt-4">
          <label htmlFor="invitar" className="block text-sm font-bold text-[#142033]">
            Invitar talleres
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="invitar"
              value={talleres}
              onChange={(e) => setTalleres(e.target.value)}
              placeholder="Nombre de su tienda (ej. taller-lopez)"
              className="min-w-0 flex-1 rounded-xl border border-[#E7E4DC] px-3 py-2 text-sm outline-none focus:border-[#C2560A]"
            />
            <button type="button" disabled={pendiente || !talleres.trim()} onClick={invitar} className="rounded-xl bg-[#C2560A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              Invitar
            </button>
          </div>
          <span className="mt-1 block text-xs text-[#6B675C]">Es el final de la liga de su tienda: hetnacnc.com/mx/talleres/<b>nombre</b>.</span>
        </div>
      )}
      {nota && <p className="mt-2 text-sm text-[#40403A]">{nota}</p>}
    </section>
  )
}
