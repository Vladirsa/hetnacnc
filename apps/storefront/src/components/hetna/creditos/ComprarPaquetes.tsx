"use client"

import { useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { iniciarCompraCreditos, type Paquete, type Proveedor } from "@/lib/creditos/acciones"
import { convertToLocale } from "@/lib/helpers/money"
import { toast } from "@/lib/helpers/toast"

// Comprar créditos es directo: el botón abre el pago de Mercado Pago o PayPal
// en ese momento, sin pasar por el carrito. Al pagar, el proveedor regresa a
// /user/creditos/pago, que confirma el pago y suma los créditos.
const NOMBRE: Record<Proveedor, string> = {
  mercadopago: "Pagar con Mercado Pago",
  paypal: "Pagar con PayPal",
}

export const ComprarPaquetes = ({
  paquetes,
  proveedores,
  locale,
  porEscaneo,
}: {
  paquetes: Paquete[]
  proveedores: Proveedor[]
  locale: string
  porEscaneo: number
}) => {
  const [trabajando, setTrabajando] = useState<string | null>(null)

  if (!paquetes.length || !proveedores.length) {
    return (
      <div className="mt-4 rounded-[12px] border border-dashed border-[#D9D5CC] bg-white px-4 py-6 text-center text-[14px] leading-relaxed text-[#6B6A63]">
        Ahorita no hay paquetes a la venta.{" "}
        <LocalizedClientLink href="/contacto" className="font-semibold text-[#B34D07] underline">
          Escríbenos
        </LocalizedClientLink>{" "}
        y te los cargamos a mano.
      </div>
    )
  }

  const comprar = async (paquete: Paquete, proveedor: Proveedor) => {
    const clave = `${paquete.handle}:${proveedor}`
    setTrabajando(clave)
    const r = await iniciarCompraCreditos(paquete.handle, proveedor, locale)
    if (r.ok) {
      window.location.href = r.url
      return
    }
    toast.error({ title: "No se pudo abrir el pago", description: r.mensaje })
    setTrabajando(null)
    if (r.noAutenticado) window.location.href = `/${locale}/login`
  }

  // El paquete con mejor precio por crédito: el que conviene señalar.
  const mejor = paquetes.reduce<Paquete | null>(
    (m, p) => (!m || p.precio / p.creditos < m.precio / m.creditos ? p : m),
    null
  )

  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paquetes.map((p) => {
          const escaneos = Math.floor(p.creditos / Math.max(porEscaneo, 1))
          const esMejor = mejor?.handle === p.handle && paquetes.length > 1

          return (
            <article
              key={p.handle}
              className={`flex flex-col rounded-[14px] border bg-white p-5 ${
                esMejor ? "border-[#C2560A] shadow-[0_6px_20px_rgba(194,86,10,0.12)]" : "border-[#E7E4DC]"
              }`}
            >
              {esMejor && (
                <span className="mb-2 self-start rounded-full bg-[#FDEEE1] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#B34D07]">
                  Mejor precio por crédito
                </span>
              )}

              <p className="text-[28px] font-bold leading-none text-[#1B1B18]">
                {p.creditos} <span className="text-[14px] font-semibold text-[#6B6A63]">créditos</span>
              </p>

              {escaneos > 0 && (
                <p className="mt-1 text-[13px] text-[#6B6A63]">
                  {escaneos} {escaneos === 1 ? "escaneo 3D" : "escaneos 3D"}
                </p>
              )}

              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[#4A4943]">{p.descripcion}</p>

              <p className="mt-3 text-[22px] font-bold text-[#1B1B18]">
                {convertToLocale({ amount: p.precio, currency_code: p.moneda })}
              </p>
              <p className="text-[12px] text-[#6B6A63]">
                {convertToLocale({ amount: p.precio / p.creditos, currency_code: p.moneda })} por crédito
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {proveedores.map((prov, i) => {
                  const clave = `${p.handle}:${prov}`
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => comprar(p, prov)}
                      disabled={trabajando !== null}
                      className={`w-full rounded-[10px] px-4 py-3 text-[14px] font-bold transition disabled:opacity-60 ${
                        i === 0
                          ? "bg-[#C2560A] text-white hover:bg-[#A84A08]"
                          : "border border-[#142033] bg-white text-[#142033] hover:bg-[#142033] hover:text-white"
                      }`}
                    >
                      {trabajando === clave ? "Abriendo el pago…" : NOMBRE[prov]}
                    </button>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[#6B6A63]">
        Precios en pesos mexicanos. El pago se hace en la página segura de Mercado Pago o PayPal; HETNA
        no ve ni guarda los datos de tu tarjeta.
      </p>
    </>
  )
}
