"use client"

// Mercado Pago regresa aquí después del pago (?status=approved|rejected|null).
// Si se aprobó, completamos el carrito: placeOrder valida el pago con Mercado Pago,
// crea los pedidos por vendedor y redirige al detalle del pedido.
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { placeOrder } from "@/lib/data/cart"

type Estado = "procesando" | "error" | "no-pagado"

const esRedireccion = (e: unknown) => {
  const err = e as { message?: string; digest?: string } | undefined
  return err?.message === "NEXT_REDIRECT" || String(err?.digest || "").startsWith("NEXT_REDIRECT")
}

export function RetornoMercadoPago() {
  const params = useSearchParams()
  const estadoMP = params.get("status") || params.get("collection_status") || ""
  const aprobado = estadoMP === "approved"

  const [estado, setEstado] = useState<Estado>(aprobado ? "procesando" : "no-pagado")
  const [detalle, setDetalle] = useState("")
  const iniciado = useRef(false)

  useEffect(() => {
    if (!aprobado || iniciado.current) return
    iniciado.current = true

    placeOrder()
      .then((res) => {
        if (res && !res.ok) {
          setEstado("error")
          setDetalle((res.error as { message?: string } | null)?.message || "")
        }
      })
      .catch((e) => {
        if (esRedireccion(e)) return
        setEstado("error")
        setDetalle((e as Error)?.message || "")
      })
  }, [aprobado])

  return (
    <main className="container max-w-xl mx-auto py-16 px-4 text-center flex flex-col items-center gap-4">
      {estado === "procesando" && (
        <>
          <h1 className="heading-md text-primary">¡Pago aprobado!</h1>
          <p className="text-secondary">Estamos creando tu pedido. No cierres esta página.</p>
        </>
      )}

      {estado === "no-pagado" && (
        <>
          <h1 className="heading-md text-primary">El pago no se completó</h1>
          <p className="text-secondary">
            {estadoMP === "rejected"
              ? "Mercado Pago rechazó el pago. Puedes intentar con otra tarjeta o método."
              : "No recibimos la confirmación del pago. Tu carrito sigue guardado."}
          </p>
          <LocalizedClientLink
            href="/checkout?step=payment"
            className="inline-flex items-center justify-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 h-11 rounded-full"
          >
            Volver al pago
          </LocalizedClientLink>
        </>
      )}

      {estado === "error" && (
        <>
          <h1 className="heading-md text-primary">Tu pago se recibió, pero no pudimos crear el pedido</h1>
          <p className="text-secondary">
            No vuelvas a pagar. Revisa «Mis pedidos»; si no aparece, escríbenos por WhatsApp con tu correo y
            lo resolvemos.
          </p>
          {detalle && <p className="text-xs text-secondary">Detalle: {detalle}</p>}
          <LocalizedClientLink
            href="/user/orders"
            className="inline-flex items-center justify-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 h-11 rounded-full"
          >
            Ver mis pedidos
          </LocalizedClientLink>
        </>
      )}
    </main>
  )
}
