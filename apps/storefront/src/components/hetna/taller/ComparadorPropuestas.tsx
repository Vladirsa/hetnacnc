"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { elegirPropuesta, type Propuesta, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Orden = "recomendado" | "precio" | "tiempo"

export default function ComparadorPropuestas({ token, solicitud }: { token: string; solicitud: VistaSolicitud }) {
  const router = useRouter()
  const [orden, setOrden] = useState<Orden>("recomendado")
  const [soloEnvio, setSoloEnvio] = useState(false)
  const [confirmar, setConfirmar] = useState<Propuesta | null>(null)
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const abierta = solicitud.estado === "abierta"
  const lista = useMemo(() => {
    let l = [...solicitud.propuestas]
    if (soloEnvio) l = l.filter((p) => p.incluye_envio)
    if (orden === "precio") l.sort((a, b) => a.precio - b.precio)
    if (orden === "tiempo") l.sort((a, b) => a.dias - b.dias)
    return l
  }, [solicitud.propuestas, orden, soloEnvio])

  const minPrecio = Math.min(...solicitud.propuestas.map((p) => p.precio))
  const minDias = Math.min(...solicitud.propuestas.map((p) => p.dias))

  const elegir = (p: Propuesta) =>
    iniciar(async () => {
      setError("")
      const r = await elegirPropuesta(token, p.id)
      if (!r.ok) setError(r.mensaje)
      setConfirmar(null)
      router.refresh()
    })

  if (!solicitud.propuestas.length) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-[#D9D5C9] bg-[#FAF9F5] p-8 text-center">
        <p className="text-3xl">⏳</p>
        <h2 className="mt-2 text-lg font-extrabold text-[#142033]">Aún no llegan propuestas</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-[#6B675C]">
          Los talleres ya recibieron tu solicitud. Te avisaremos por correo cada vez que llegue una propuesta; vuelve a esta misma liga para compararlas.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-[#142033]">
          {solicitud.propuestas.length} {solicitud.propuestas.length === 1 ? "propuesta" : "propuestas"}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["recomendado", "precio", "tiempo"] as Orden[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrden(o)}
              className={`rounded-full px-3 py-1.5 font-semibold ${orden === o ? "bg-[#142033] text-white" : "bg-[#F3F1EA] text-[#40403A]"}`}
            >
              {o === "recomendado" ? "Recomendadas" : o === "precio" ? "Menor precio" : "Entrega más rápida"}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1.5 text-[#40403A]">
            <input type="checkbox" checked={soloEnvio} onChange={(e) => setSoloEnvio(e.target.checked)} className="accent-[#C2560A]" />
            Con envío incluido
          </label>
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}

      <div className="mt-4 grid gap-4">
        {lista.map((p) => {
          const elegida = solicitud.propuesta_elegida === p.id
          return (
            <article
              key={p.id}
              className={`rounded-2xl border bg-white p-5 sm:p-6 ${elegida ? "border-[#1E7B3A] ring-2 ring-[#1E7B3A]/20" : "border-[#E7E4DC]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold text-[#142033]">{p.taller.nombre}</h3>
                    {p.destacado && <span className="rounded-full bg-[#FFF1E6] px-2 py-0.5 text-xs font-bold text-[#C2560A]">Destacado</span>}
                    {elegida && <span className="rounded-full bg-[#E6F4EA] px-2 py-0.5 text-xs font-bold text-[#1E7B3A]">Elegida</span>}
                  </div>
                  <p className="text-sm text-[#6B675C]">
                    {p.taller.estado || "México"}
                    {p.taller.calificacion ? ` · ★ ${Number(p.taller.calificacion).toFixed(1)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-[#142033]">{pesos(p.precio)} <span className="text-sm font-semibold text-[#6B675C]">MXN</span></p>
                  <p className="text-sm text-[#6B675C]">{p.incluye_envio ? "Envío incluido" : "Envío aparte"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-[#F3F1EA] px-3 py-1 text-[#40403A]">Entrega en {p.dias} {p.dias === 1 ? "día" : "días"}</span>
                <span className="rounded-full bg-[#F3F1EA] px-3 py-1 text-[#40403A]">Vigencia {p.vigencia_dias} días</span>
                {p.precio === minPrecio && solicitud.propuestas.length > 1 && (
                  <span className="rounded-full bg-[#E6F4EA] px-3 py-1 font-semibold text-[#1E7B3A]">Mejor precio</span>
                )}
                {p.dias === minDias && solicitud.propuestas.length > 1 && (
                  <span className="rounded-full bg-[#E8EEF7] px-3 py-1 font-semibold text-[#142033]">Más rápida</span>
                )}
              </div>

              {p.condiciones && <p className="mt-3 whitespace-pre-line text-sm text-[#40403A]">{p.condiciones}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {abierta && (
                  <button
                    type="button"
                    onClick={() => setConfirmar(p)}
                    className="rounded-xl bg-[#C2560A] px-5 py-2.5 font-semibold text-white hover:brightness-110"
                  >
                    Elegir esta propuesta
                  </button>
                )}
                <a href={`/mx/talleres/${p.taller.handle}`} target="_blank" rel="noopener" className="text-sm font-semibold text-[#142033] underline">
                  Ver perfil del taller
                </a>
              </div>
            </article>
          )
        })}
      </div>

      {confirmar && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-extrabold text-[#142033]">¿Elegir a {confirmar.taller.nombre}?</h3>
            <p className="mt-2 text-sm text-[#40403A]">
              {pesos(confirmar.precio)} MXN · entrega en {confirmar.dias} días. Al confirmar, HETNA te enviará la liga de pago y las demás propuestas se cierran.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(null)} className="rounded-xl px-4 py-2 font-semibold text-[#40403A]">
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => elegir(confirmar)}
                className="rounded-xl bg-[#C2560A] px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {pendiente ? "Guardando…" : "Sí, elegir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
