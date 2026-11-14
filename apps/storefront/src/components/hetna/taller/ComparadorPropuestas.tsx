"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { analizarPropuestas, elegirPropuesta, type Propuesta, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

import PagoSolicitud from "./PagoSolicitud"
import TablaPropuestas from "./TablaPropuestas"
import NegociacionPropuesta from "./NegociacionPropuesta"

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Orden = "recomendado" | "precio" | "tiempo"

export default function ComparadorPropuestas({ token, solicitud }: { token: string; solicitud: VistaSolicitud }) {
  const router = useRouter()
  const [orden, setOrden] = useState<Orden>("recomendado")
  // Licitaciones 3.0: contacto "por autorización" → casilla al elegir
  const [compartir, setCompartir] = useState(false)
  const contactoPorAutorizacion = solicitud.privacidad?.contacto === "autorizacion"
  // Fase 2: notas de la comparación y resumen con IA
  const notasDe = new Map((solicitud.comparacion?.notas || []).map((n) => [n.id, n]))
  const [ia, setIa] = useState<{ cargando: boolean; resumen: string | null; motivo?: string } | null>(null)
  const pedirIa = async () => {
    setIa({ cargando: true, resumen: null })
    const r = await analizarPropuestas(token)
    setIa({ cargando: false, resumen: r.resumen, motivo: r.disponible ? r.motivo || (r.resumen ? undefined : "No se pudo preparar el resumen ahora.") : "El resumen con IA todavía no está disponible." })
  }
  const [soloEnvio, setSoloEnvio] = useState(false)
  // Con 2 o más propuestas se abre en tabla (lado a lado); se puede cambiar a tarjetas
  const [vista, setVista] = useState<"tabla" | "tarjetas">(solicitud.propuestas.length >= 2 ? "tabla" : "tarjetas")
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
      const r = await elegirPropuesta(token, p.id, compartir)
      if (!r.ok) {
        setError(r.mensaje)
        setConfirmar(null)
        return
      }
      setConfirmar(null)
      if (r.pago_url) {
        window.location.href = r.pago_url
        return
      }
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
          {solicitud.propuestas.length >= 2 && (
            <span className="ml-1 inline-flex overflow-hidden rounded-full border border-[#D9D5C9]">
              {(["tabla", "tarjetas"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setVista(v)}
                  className={`px-3 py-1.5 font-semibold ${vista === v ? "bg-[#C2560A] text-white" : "bg-white text-[#40403A]"}`}>
                  {v === "tabla" ? "Tabla" : "Tarjetas"}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}

      {solicitud.cobro ? (
        <PagoSolicitud token={token} s={solicitud} />
      ) : solicitud.pago_estado === "pagado" ? (
        <div className="mt-4 rounded-2xl border border-[#1E7B3A]/30 bg-[#E6F4EA] p-5 text-[#1E7B3A]">
          <p className="font-extrabold">✓ Pago recibido</p>
          <p className="mt-1 text-sm">El taller ya está trabajando en tu pedido. Te avisaremos cuando salga el envío.</p>
        </div>
      ) : (
        solicitud.pago_url && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C2560A]/30 bg-[#FFF1E6] p-5">
            <div>
              <p className="font-extrabold text-[#142033]">Falta tu pago</p>
              <p className="text-sm text-[#40403A]">Paga con Mercado Pago para que el taller empiece a fabricar.</p>
            </div>
            <a href={solicitud.pago_url} className="rounded-xl bg-[#C2560A] px-5 py-2.5 font-semibold text-white hover:brightness-110">
              Pagar ahora
            </a>
          </div>
        )
      )}

      {solicitud.propuestas.length >= 2 && (
        <div className="mt-4 rounded-2xl border border-[#E7E4DC] bg-[#FAF9F6] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#142033]">🤖 Resumen de las propuestas con IA</p>
            {!ia?.resumen && (
              <button type="button" onClick={pedirIa} disabled={ia?.cargando} className="rounded-xl bg-[#142033] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {ia?.cargando ? "Analizando…" : "Explícame las diferencias"}
              </button>
            )}
          </div>
          {ia?.resumen && <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#40403A]">{ia.resumen}</div>}
          {ia && !ia.cargando && !ia.resumen && ia.motivo && <p className="mt-2 text-sm text-[#6B675C]">{ia.motivo}</p>}
          <p className="mt-2 text-xs text-[#8A867B]">La IA sólo explica lo que escribieron los talleres; no elige por ti. La decisión es tuya.</p>
        </div>
      )}

      {vista === "tabla" && lista.length >= 1 && solicitud.propuestas.length >= 2 ? (
        <TablaPropuestas propuestas={lista} faltan={new Map([...notasDe].map(([id, n]) => [id, n.faltan]))}
          elegida={solicitud.propuesta_elegida} abierta={abierta} onElegir={setConfirmar}
          negociacion={(p) => <NegociacionPropuesta token={token} p={p} abierta={abierta} compacta />} />
      ) : (
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
                    {p.taller.verificado && <span className="rounded-full bg-[#E6F4EA] px-2 py-0.5 text-xs font-bold text-[#1E7B3A]">✓ Verificado</span>}
                    {p.destacado && <span className="rounded-full bg-[#FFF1E6] px-2 py-0.5 text-xs font-bold text-[#C2560A]">Destacado</span>}
                    {elegida && <span className="rounded-full bg-[#E6F4EA] px-2 py-0.5 text-xs font-bold text-[#1E7B3A]">Elegida</span>}
                  </div>
                  <p className="text-sm text-[#6B675C]">
                    {p.taller.estado || "México"}
                    {p.taller.calificacion
                      ? ` · ★ ${Number(p.taller.calificacion).toFixed(1)}${p.taller.resenas ? ` (${p.taller.resenas} ${p.taller.resenas === 1 ? "reseña" : "reseñas"})` : ""}`
                      : " · Sin reseñas todavía"}
                  </p>
                  <HistorialMedido m={p.taller.medido} />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-[#142033]">{pesos(p.precio)} <span className="text-sm font-semibold text-[#6B675C]">{p.moneda || "MXN"}</span></p>
                  <p className="text-sm text-[#6B675C]">{p.incluye_envio ? "Envío incluido" : "Envío aparte"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-[#F3F1EA] px-3 py-1 text-[#40403A]">Entrega en {p.dias} {p.dias === 1 ? "día" : "días"}</span>
                <span className="rounded-full bg-[#F3F1EA] px-3 py-1 text-[#40403A]">Vigencia {p.vigencia_dias} días</span>
                {p.anticipo_pct ? (
                  <span className="rounded-full bg-[#F3F1EA] px-3 py-1 text-[#40403A]">Anticipo {p.anticipo_pct}%</span>
                ) : null}
                {p.precio === minPrecio && solicitud.propuestas.length > 1 && (
                  <span className="rounded-full bg-[#E6F4EA] px-3 py-1 font-semibold text-[#1E7B3A]">Mejor precio</span>
                )}
                {p.dias === minDias && solicitud.propuestas.length > 1 && (
                  <span className="rounded-full bg-[#E8EEF7] px-3 py-1 font-semibold text-[#142033]">Más rápida</span>
                )}
              </div>

              {p.condiciones && <p className="mt-3 whitespace-pre-line text-sm text-[#40403A]">{p.condiciones}</p>}

              {/* Propuesta formal (Fase 2) */}
              {(p.materiales || p.operaciones || p.fecha_entrega || p.condiciones_pago || p.garantia || p.observaciones) && (
                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {(
                    [
                      ["Materiales", p.materiales],
                      ["Procesos", p.operaciones],
                      ["Entrega estimada", p.fecha_entrega ? new Date(`${p.fecha_entrega}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : ""],
                      ["Forma de pago", p.condiciones_pago],
                      ["Garantía", p.garantia],
                      ["Observaciones técnicas", p.observaciones],
                    ] as [string, string | null | undefined][]
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-semibold text-[#142033]">{k}</dt>
                        <dd className="whitespace-pre-line text-[#40403A]">{v}</dd>
                      </div>
                    ))}
                </dl>
              )}
              {p.adjuntos && p.adjuntos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  {p.adjuntos.map((a) =>
                    a.url ? (
                      <a key={a.nombre} href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#E7E4DC] px-2.5 py-1 font-semibold text-[#C2560A] hover:border-[#C2560A]">
                        📎 {a.nombre}
                      </a>
                    ) : (
                      <span key={a.nombre} className="rounded-lg border border-[#E7E4DC] px-2.5 py-1 text-[#6B675C]">📎 {a.nombre}</span>
                    )
                  )}
                </div>
              )}
              {(notasDe.get(p.id)?.notas.length || notasDe.get(p.id)?.faltan.length) ? (
                <div className="mt-3 rounded-xl bg-[#FAF9F6] px-3 py-2 text-[13px] text-[#40403A]">
                  {notasDe.get(p.id)!.notas.map((n) => (
                    <p key={n}>• {n}</p>
                  ))}
                  {notasDe.get(p.id)!.faltan.length > 0 && (
                    <p className="mt-1 text-[#8A5A00]">Antes de elegir, pregúntale: {notasDe.get(p.id)!.faltan.join(" · ")}.</p>
                  )}
                </div>
              ) : null}

              <NegociacionPropuesta token={token} p={p} abierta={abierta} />

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
      )}

      {confirmar && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-extrabold text-[#142033]">¿Elegir a {confirmar.taller.nombre}?</h3>
            <p className="mt-2 text-sm text-[#40403A]">
              {pesos(confirmar.precio)} MXN · entrega en {confirmar.dias} días.
              {confirmar.anticipo_pct ? ` El taller pide ${confirmar.anticipo_pct}% de anticipo para empezar.` : ""} Al confirmar te llevamos a pagar y
              las demás propuestas se cierran (a los otros talleres les avisamos sin dar tus datos).
            </p>
            {contactoPorAutorizacion && (
              <label className="mt-3 flex items-start gap-2 rounded-xl bg-[#F3F1EA] p-3 text-sm text-[#40403A]">
                <input type="checkbox" checked={compartir} onChange={(e) => setCompartir(e.target.checked)} className="mt-1 accent-[#C2560A]" />
                <span>Compartir mi nombre, correo, teléfono y WhatsApp con <b>{confirmar.taller.nombre}</b> para coordinar directamente.</span>
              </label>
            )}
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

/** Historial medido del taller: lo que hizo en HETNA, no sólo lo que opinaron de él. */
function HistorialMedido({ m }: { m?: Propuesta["taller"]["medido"] }) {
  if (!m || !m.terminados) return <p className="mt-1 text-xs text-[#6B675C]">Sin trabajos terminados en HETNA todavía</p>
  const datos = [
    m.puntualidad_pct != null && `${m.puntualidad_pct}% a tiempo`,
    `${m.terminados} ${m.terminados === 1 ? "trabajo terminado" : "trabajos terminados"}`,
    m.reclamos > 0 && `${m.reclamos_resueltos} de ${m.reclamos} reclamos resueltos`,
  ].filter(Boolean)
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#40403A]">
      {m.suficiente && m.puntaje != null && (
        <span
          className={`rounded-full px-2 py-0.5 font-bold ${m.puntaje >= 80 ? "bg-[#E6F4EA] text-[#1E7B3A]" : m.puntaje >= 60 ? "bg-[#FFF6E0] text-[#8A5A00]" : "bg-[#FDECEC] text-[#B42318]"}`}
          title="Puntaje HETNA: puntualidad real 40%, calidad calificada 25%, trabajos terminados 20%, reclamos resueltos 15%"
        >
          Cumplimiento {m.puntaje}/100
        </span>
      )}
      <span>{datos.join(" · ")}</span>
      {!m.suficiente && <span className="text-[#6B675C]">(historial corto)</span>}
    </p>
  )
}
