"use client"

// Registro en inglés para proveedores de otros países (/sell-in-mexico). Usa el
// mismo registro de talleres (POST /store/talleres-registro): llega a HETNA como
// prospecto con «Proveedor extranjero» y el país en los comentarios.
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

import { registrarTaller } from "@/lib/talleres/registro"

const CAMPO = "w-full rounded-lg border border-[#E7E4DC] bg-white px-3 py-2 text-[15px] text-[#1B1B18]"
const ETIQUETA = "mb-1 block text-sm font-semibold text-white"

export function FormProveedorExtranjero() {
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  const [mensaje, setMensaje] = useState("")
  const [panel, setPanel] = useState("/seller")

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const v = (k: string) => String(fd.get(k) || "").trim()
    setEstado("enviando")
    const r = await registrarTaller({
      nombre_taller: v("empresa"),
      contacto: v("contacto"),
      email: v("email"),
      whatsapp: v("telefono"),
      ciudad: [v("ciudad"), v("pais")].filter(Boolean).join(", "),
      servicios: ["proveedor_extranjero"],
      materiales: [],
      maquinas: v("productos"),
      portafolio: v("tienda"),
      comentarios: `Proveedor extranjero · País: ${v("pais")} · Envío DDP puerta a puerta · Pago por PayPal: ${v("paypal") || "(pendiente)"}`,
      fotos: [],
      sitio_web: v("sitio_web"),
    })
    if (r.ok) {
      setPanel(r.panel)
      setEstado("ok")
    } else {
      setEstado("error")
      setMensaje(r.mensaje)
    }
  }

  if (estado === "ok") {
    return (
      <div className="rounded-2xl bg-white p-6 text-[#1B1B18]">
        <p className="text-lg font-extrabold"><T>Thank you! We got your application.</T></p>
        <p className="mt-2">
          <T>Next step: create your seller account with the same email and, in</T> <b><T>Perfil público → Vendo desde otro país</T></b><T>, set your
          ship-from country, delivery time and PayPal email. Then upload your products.</T>
        </p>
        <a href={panel} className="mt-4 inline-block rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white">
          <T>Create my seller account</T>
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={ETIQUETA} htmlFor="empresa"><T>Company name *</T></label>
        <input id="empresa" name="empresa" required maxLength={120} className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="contacto"><T>Contact person</T></label>
        <input id="contacto" name="contacto" maxLength={120} className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="email"><T>Email *</T></label>
        <input id="email" name="email" type="email" required className={CAMPO} autoComplete="email" />
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="telefono"><T>WhatsApp / WeChat phone (with country code) *</T></label>
        <input id="telefono" name="telefono" type="tel" required className={CAMPO} placeholder="+86 138 0000 0000" />
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="pais"><T>Ship-from country *</T></label>
        <input id="pais" name="pais" required maxLength={40} className={CAMPO} placeholder="China" />
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="ciudad"><T>City</T></label>
        <input id="ciudad" name="ciudad" maxLength={60} className={CAMPO} placeholder="Jinan" />
      </div>
      <div className="sm:col-span-2">
        <label className={ETIQUETA} htmlFor="productos"><T>What do you sell? *</T></label>
        <textarea id="productos" name="productos" required rows={3} maxLength={1500} className={CAMPO} placeholder="CNC routers, fiber laser cutters, spindles, end mills, spare parts…" />
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="tienda"><T>Website or Alibaba / Made-in-China store</T></label>
        <input id="tienda" name="tienda" maxLength={300} className={CAMPO} placeholder="https://yourcompany.en.alibaba.com" />
      </div>
      <div>
        <label className={ETIQUETA} htmlFor="paypal"><T>PayPal email (for payouts)</T></label>
        <input id="paypal" name="paypal" type="email" maxLength={120} className={CAMPO} />
      </div>
      {/* Trampa para bots: los humanos no la ven */}
      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="sm:col-span-2">
        <button type="submit" disabled={estado === "enviando"} className="w-full rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white disabled:opacity-60">
          {estado === "enviando" ? "Sending…" : "Apply to sell in Mexico"}
        </button>
        {estado === "error" && <p className="mt-2 text-sm text-[#FFB4A8]"><T>{mensaje}</T></p>}
        <p className="mt-2 text-xs text-white/60"><T>Free to apply. We reply within 1 business day.</T></p>
      </div>
    </form>
  )
}
