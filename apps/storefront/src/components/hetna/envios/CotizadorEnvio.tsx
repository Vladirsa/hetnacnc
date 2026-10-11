"use client"

import { useState, useTransition } from "react"

import { cotizarEnvio, type OpcionEnvio } from "@/lib/envios/cotizar"

const CAMPO =
  "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"
const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`

export default function CotizadorEnvio() {
  const [opciones, setOpciones] = useState<OpcionEnvio[] | null>(null)
  const [info, setInfo] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const v = (k: string) => String(fd.get(k) || "").trim()
    iniciar(async () => {
      setError("")
      setOpciones(null)
      const r = await cotizarEnvio({
        cp_origen: v("cp_origen"),
        cp_destino: v("cp_destino"),
        peso: v("peso"),
        largo: v("largo"),
        ancho: v("ancho"),
        alto: v("alto"),
      })
      if (!r.ok) return setError(r.mensaje)
      setOpciones(r.opciones)
      setInfo(
        r.aviso ||
          (r.peso_cobrado && r.peso_cobrado > Number(v("peso"))
            ? `Las paqueterías cobran por peso volumétrico: ${r.peso_cobrado} kg.`
            : "")
      )
    })
  }

  return (
    <section id="cotizar-envio" className="mt-8 scroll-mt-28 rounded-3xl border border-[#E7E4DC] bg-white p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Cotiza al momento</p>
      <h2 className="mt-1 text-2xl font-extrabold text-[#142033]">¿Cuánto cuesta tu envío?</h2>
      <p className="mt-1 text-sm text-[#6B675C]">Compara paqueterías con precio final y días de entrega.</p>

      <form onSubmit={enviar} className="mt-5 grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label className={ETIQUETA} htmlFor="cp_origen">C.P. de origen</label>
          <input id="cp_origen" name="cp_origen" inputMode="numeric" pattern="\d{5}" maxLength={5} required className={CAMPO} placeholder="90300" />
        </div>
        <div className="sm:col-span-3">
          <label className={ETIQUETA} htmlFor="cp_destino">C.P. de destino</label>
          <input id="cp_destino" name="cp_destino" inputMode="numeric" pattern="\d{5}" maxLength={5} required className={CAMPO} placeholder="64000" />
        </div>
        <div className="sm:col-span-2">
          <label className={ETIQUETA} htmlFor="peso">Peso (kg)</label>
          <input id="peso" name="peso" inputMode="decimal" required className={CAMPO} placeholder="2" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="largo">Largo (cm)</label>
          <input id="largo" name="largo" inputMode="numeric" required className={CAMPO} placeholder="30" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="ancho">Ancho (cm)</label>
          <input id="ancho" name="ancho" inputMode="numeric" required className={CAMPO} placeholder="30" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="alto">Alto (cm)</label>
          <input id="alto" name="alto" inputMode="numeric" required className={CAMPO} placeholder="20" />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pendiente}
            className="h-11 w-full rounded-xl bg-[#C2560A] px-4 font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {pendiente ? "Cotizando…" : "Cotizar"}
          </button>
        </div>
      </form>

      {pendiente && <p className="mt-4 text-sm text-[#6B675C]">Consultando paqueterías, tarda unos segundos…</p>}
      {error && <p className="mt-4 rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}

      {opciones && (
        <div className="mt-5">
          {info && <p className="mb-3 text-sm text-[#6B675C]">{info}</p>}
          {opciones.length === 0 ? (
            <p className="rounded-xl bg-[#F3F1EA] p-4 text-sm text-[#40403A]">No encontramos paqueterías para esa ruta. Escríbenos y lo resolvemos.</p>
          ) : (
            <ul className="grid gap-2">
              {opciones.map((o, i) => (
                <li
                  key={`${o.paqueteria}-${o.servicio}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4 ${i === 0 ? "border-[#1E7B3A] bg-[#F3FAF5]" : "border-[#E7E4DC]"}`}
                >
                  <div>
                    <p className="font-bold text-[#142033]">
                      {o.paqueteria} <span className="font-normal text-[#6B675C]">· {o.servicio}</span>
                    </p>
                    <p className="text-sm text-[#6B675C]">
                      {o.dias ? `Entrega estimada: ${o.dias} ${o.dias === 1 ? "día hábil" : "días hábiles"}` : "Entrega estimada según la paquetería"}
                      {i === 0 && <span className="ml-2 font-semibold text-[#1E7B3A]">Más barato</span>}
                    </p>
                  </div>
                  <p className="text-xl font-extrabold text-[#142033]">{pesos(o.precio)} <span className="text-xs font-semibold text-[#6B675C]">MXN</span></p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[#6B675C]">Precio con IVA incluido. Puede variar si el paquete real pesa o mide distinto.</p>
        </div>
      )}
    </section>
  )
}
