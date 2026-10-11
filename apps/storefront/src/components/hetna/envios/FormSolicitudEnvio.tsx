"use client"

import { useState, useTransition } from "react"

import { solicitarEnvio, type ContactoEnvio, type CotizacionGuardada } from "@/lib/envios/cotizar"

const CAMPO = "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"

const vacio: ContactoEnvio = { nombre: "", telefono: "", email: "", calle: "", referencias: "", empresa: "" }

function Bloque({ titulo, lugar, v, set }: {
  titulo: string
  lugar: CotizacionGuardada["origen"]
  v: ContactoEnvio
  set: (c: ContactoEnvio) => void
}) {
  const campo = (k: keyof ContactoEnvio, label: string, extra: Record<string, unknown> = {}) => (
    <div>
      <label className={ETIQUETA} htmlFor={`${titulo}-${k}`}>{label}</label>
      <input id={`${titulo}-${k}`} value={v[k] || ""} onChange={(e) => set({ ...v, [k]: e.target.value })} className={CAMPO} {...extra} />
    </div>
  )
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:p-5">
      <legend className="px-1 text-base font-extrabold text-[#142033]">{titulo}</legend>
      <p className="rounded-xl bg-[#F3F1EA] px-3 py-2 text-sm text-[#40403A]">
        Col. {lugar.colonia}, {[lugar.municipio, lugar.estado].filter(Boolean).join(", ")} · C.P. {lugar.cp}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("nombre", "Nombre completo", { required: true, autoComplete: "name" })}
        {campo("empresa", "Empresa (opcional)")}
        {campo("telefono", "Teléfono (10 dígitos)", { required: true, inputMode: "tel", autoComplete: "tel" })}
        {campo("email", "Correo", { required: true, type: "email", autoComplete: "email" })}
      </div>
      {campo("calle", "Calle, número exterior e interior", { required: true, autoComplete: "street-address" })}
      {campo("referencias", "Referencias (opcional)", { placeholder: "Entre calles, color de fachada…" })}
    </fieldset>
  )
}

export default function FormSolicitudEnvio({ cot, cliente, volver }: {
  cot: CotizacionGuardada
  cliente: { nombre: string; email: string; telefono: string }
  volver: string
}) {
  const [origen, setOrigen] = useState<ContactoEnvio>({ ...vacio, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono })
  const [destino, setDestino] = useState<ContactoEnvio>(vacio)
  const [contenido, setContenido] = useState("")
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    iniciar(async () => {
      setError("")
      const r = await solicitarEnvio({ cotizacion_id: cot.cotizacion_id, tarifa_id: cot.opcion.tarifa_id, origen, destino, contenido, acepta })
      if (r.ok) {
        window.location.href = r.pago_url
        return
      }
      if (r.login) {
        window.location.href = `${volver.split("/servicios")[0]}/login?volver=${encodeURIComponent(volver)}`
        return
      }
      setError(r.mensaje)
    })
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      <Bloque titulo="Remitente (origen)" lugar={cot.origen} v={origen} set={setOrigen} />
      <Bloque titulo="Destinatario" lugar={cot.destino} v={destino} set={setDestino} />
      <div className="rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:p-5">
        <label className={ETIQUETA} htmlFor="contenido">¿Qué contiene el paquete?</label>
        <input
          id="contenido"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          required
          maxLength={200}
          className={CAMPO}
          placeholder="Ej. Piezas de MDF cortadas, fresas para router…"
        />
        <label className="mt-4 flex items-start gap-2 text-sm text-[#40403A]">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" required />
          <span>
            Confirmo que las medidas y el peso son correctos y que el paquete no contiene artículos prohibidos por la paquetería.
            Si el paquete real es más grande o pesado, la paquetería puede cobrar la diferencia.
          </span>
        </label>
      </div>
      {error && <p className="rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}
      <button
        type="submit"
        disabled={pendiente || cot.vencida}
        className="h-12 rounded-xl bg-[#C2560A] px-6 font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pendiente ? "Preparando tu pago…" : `Pagar $${cot.opcion.precio.toLocaleString("es-MX")} MXN con Mercado Pago`}
      </button>
    </form>
  )
}
