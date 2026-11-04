"use client"

import { useState, useTransition } from "react"

import { pagarSolicitud, type VistaSolicitud } from "@/lib/cotizar/solicitud-taller"

// Licitaciones 2.0: qué falta pagar (anticipo, resto o total) y con qué.
// Si el taller conectó su cuenta, el cliente le paga directo (Mercado Pago o
// PayPal); si no, paga a HETNA, que guarda el dinero hasta la entrega.
const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function PagoSolicitud({ token, s }: { token: string; s: VistaSolicitud }) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState("")
  const c = s.cobro
  if (!c) return null

  const pagar = (proveedor: "mercadopago" | "paypal") =>
    iniciar(async () => {
      setError("")
      const r = await pagarSolicitud(token, proveedor)
      if (!r.ok) return setError(r.mensaje)
      window.location.href = r.url
    })

  if (!c.siguiente) {
    if (c.pagado <= 0) return null
    return (
      <div className="mt-4 rounded-2xl border border-[#1E7B3A]/30 bg-[#E6F4EA] p-5 text-[#1E7B3A]">
        <p className="font-extrabold">✓ Pagado por completo · {pesos(c.pagado)} MXN</p>
        <p className="mt-1 text-sm">
          {c.modo === "hetna"
            ? "HETNA guarda tu pago y se lo entrega al taller cuando confirmes que recibiste tu pedido."
            : "Tu pago llegó directo a la cuenta del taller."}
        </p>
      </div>
    )
  }

  const { tipo, monto } = c.siguiente
  const titulo = tipo === "anticipo" ? `Paga el anticipo (${c.anticipo_pct}%)` : tipo === "resto" ? "Falta pagar el resto" : "Falta tu pago"
  const explica =
    tipo === "anticipo"
      ? `El taller empieza con el anticipo. Los otros ${pesos(c.total - monto)} los pagas aquí mismo cuando te lo pida, antes de la entrega.`
      : tipo === "resto"
        ? `Ya pagaste ${pesos(c.pagado)}. Liquida el resto para que el taller te entregue.`
        : c.modo === "hetna"
          ? "Pagas a HETNA y guardamos el dinero: el taller lo recibe cuando confirmes que te llegó tu pedido."
          : "Tu pago va directo a la cuenta del taller y el taller empieza a fabricar."

  return (
    <div className="mt-4 rounded-2xl border border-[#C2560A]/30 bg-[#FFF1E6] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-[#142033]">{titulo}</p>
          <p className="text-2xl font-extrabold text-[#142033]">
            {pesos(monto)} <span className="text-sm font-semibold text-[#6B675C]">MXN</span>
          </p>
          <p className="mt-1 max-w-xl text-sm text-[#40403A]">{explica}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.metodos.includes("mercadopago") && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => pagar("mercadopago")}
              className="rounded-xl bg-[#C2560A] px-5 py-2.5 font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {pendiente ? "Abriendo…" : "Pagar con Mercado Pago"}
            </button>
          )}
          {c.metodos.includes("paypal") && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => pagar("paypal")}
              className="rounded-xl border-2 border-[#142033] bg-white px-5 py-2.5 font-semibold text-[#142033] hover:bg-[#F3F1EA] disabled:opacity-60"
            >
              Pagar con PayPal
            </button>
          )}
          {!c.metodos.length && <p className="text-sm text-[#6B675C]">En breve te mandamos la liga de pago por correo.</p>}
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-[#FDECEA] p-3 text-sm text-[#B3261E]">{error}</p>}
    </div>
  )
}
