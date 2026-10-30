"use client"

// Datos fiscales del cliente y la factura (CFDI) de cada pedido: pedirla al
// taller y descargar el PDF y el XML cuando el taller los sube.
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { type DatosFiscales, type Factura, guardarFiscal, ligaFactura, pedirFactura } from "@/lib/cuenta/facturas"

const CAMPO = "h-11 w-full rounded-[10px] border border-[#E0DCD2] bg-white px-3 text-[14.5px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#44433D]"

export function FormFiscal({
  inicial,
  regimenes,
  usos,
}: {
  inicial: DatosFiscales | null
  regimenes: Record<string, string>
  usos: Record<string, string>
}) {
  const [d, setD] = useState<DatosFiscales>(inicial || { rfc: "", razon_social: "", regimen: "", cp: "", uso_cfdi: "G03", correo: "" })
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, iniciar] = useTransition()
  const cambia = (k: keyof DatosFiscales, v: string) => {
    setEstado(null)
    setD((x) => ({ ...x, [k]: v }))
  }
  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    iniciar(async () => {
      const r = await guardarFiscal(d)
      setEstado(r.ok ? { ok: true, texto: "✓ Datos fiscales guardados. Ya puedes pedir factura desde tus pedidos." } : { ok: false, texto: r.mensaje })
    })
  }
  return (
    <form onSubmit={guardar} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ETIQUETA} htmlFor="rfc">RFC</label>
          <input id="rfc" value={d.rfc} onChange={(e) => cambia("rfc", e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={13} required className={CAMPO} placeholder="XAXX010101000" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="cp">Código postal fiscal</label>
          <input id="cp" value={d.cp} onChange={(e) => cambia("cp", e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" required className={CAMPO} placeholder="El de tu constancia" />
        </div>
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="razon">Nombre o razón social</label>
        <input id="razon" value={d.razon_social} onChange={(e) => cambia("razon_social", e.target.value)} maxLength={254} required className={CAMPO} placeholder="Tal como aparece en tu constancia, sin “SA de CV”" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ETIQUETA} htmlFor="regimen">Régimen fiscal</label>
          <select id="regimen" value={d.regimen} onChange={(e) => cambia("regimen", e.target.value)} required className={CAMPO}>
            <option value="">Elige tu régimen…</option>
            {Object.entries(regimenes).map(([k, v]) => (
              <option key={k} value={k}>
                {k} · {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="uso">Uso del CFDI</label>
          <select id="uso" value={d.uso_cfdi} onChange={(e) => cambia("uso_cfdi", e.target.value)} required className={CAMPO}>
            {Object.entries(usos).map(([k, v]) => (
              <option key={k} value={k}>
                {k} · {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="correo">Correo para recibir facturas (opcional)</label>
        <input id="correo" type="email" value={d.correo} onChange={(e) => cambia("correo", e.target.value)} className={CAMPO} placeholder="Si es distinto al de tu cuenta" />
      </div>
      <p className="m-0 text-[12.5px] text-[#6B6A63]">
        Los datos deben coincidir con tu constancia de situación fiscal del SAT; si no, el taller no podrá timbrar la factura.
      </p>
      {estado && <p className={`m-0 rounded-[10px] px-3 py-2 text-[14px] ${estado.ok ? "bg-[#EAF6EF] text-[#14683F]" : "bg-[#FDECEA] text-[#B3261E]"}`}>{estado.texto}</p>}
      <button type="submit" disabled={pendiente} className="h-11 justify-self-start rounded-[10px] bg-[#C2560A] px-6 font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60">
        {pendiente ? "Guardando…" : "Guardar datos fiscales"}
      </button>
    </form>
  )
}

// Bloque de factura de un pedido (uno por taller dentro de la compra)
export function FacturaPedido({
  orderId,
  taller,
  pagado,
  factura,
  tieneFiscal,
}: {
  orderId: string
  taller: string
  pagado: boolean
  factura: Factura | null
  tieneFiscal: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  const pedir = () =>
    iniciar(async () => {
      setError("")
      const r = await pedirFactura(orderId)
      if (r.ok) router.refresh()
      else setError(r.mensaje)
    })
  const abrir = (tipo: "pdf" | "xml") =>
    iniciar(async () => {
      setError("")
      const url = factura ? await ligaFactura(factura.id, tipo) : null
      if (url) window.open(url, "_blank", "noopener")
      else setError("No pudimos abrir el archivo. Intenta de nuevo.")
    })

  const boton = "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-60"
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E7E4DC] bg-[#FAF9F6] px-4 py-3">
      <div className="text-[13.5px] text-[#44433D]">
        <strong className="block text-[14px] text-[#142033]">Factura · {taller}</strong>
        {!factura && (pagado ? "Puedes pedir la factura (CFDI) de esta compra." : "Podrás pedir factura cuando el pago esté confirmado.")}
        {factura?.estado === "solicitada" && "Solicitada. El taller la emite y te avisamos por correo cuando esté lista."}
        {factura?.estado === "emitida" && "Lista para descargar."}
        {factura?.estado === "rechazada" && `El taller no pudo emitirla${factura.nota ? `: ${factura.nota}` : ""}. Revisa tus datos y vuelve a pedirla.`}
        {error && <span className="mt-1 block text-[#B3261E]">{error}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {factura?.estado === "emitida" ? (
          <>
            {factura.tiene_pdf && (
              <button type="button" onClick={() => abrir("pdf")} disabled={pendiente} className={`${boton} border-[#C2560A] bg-[#C2560A] text-white`}>
                Descargar PDF
              </button>
            )}
            {factura.tiene_xml && (
              <button type="button" onClick={() => abrir("xml")} disabled={pendiente} className={`${boton} border-[#C9C4B8] bg-white text-[#44433D]`}>
                XML
              </button>
            )}
          </>
        ) : !tieneFiscal && pagado ? (
          <LocalizedClientLink href="/user/settings#fiscal" className={`${boton} border-[#C2560A] bg-white text-[#B34D07]`}>
            Agregar datos fiscales
          </LocalizedClientLink>
        ) : (!factura || factura.estado === "rechazada") && pagado ? (
          <button type="button" onClick={pedir} disabled={pendiente} className={`${boton} border-[#C2560A] bg-white text-[#B34D07]`}>
            {pendiente ? "Pidiendo…" : "Solicitar factura"}
          </button>
        ) : null}
      </div>
    </div>
  )
}
