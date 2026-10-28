"use client"

// Regreso del pago de un paquete de créditos.
//   ?compra=cc_...&proveedor=mercadopago|paypal  (+ status=... de Mercado Pago,
//   cancelado=1 si se canceló en PayPal)
// Se pregunta al backend, que consulta al proveedor y acredita. Si el pago
// todavía no aparece (a veces tarda unos segundos), se vuelve a preguntar.
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { confirmarCompraCreditos } from "@/lib/creditos/acciones"

type Estado =
  | { tipo: "revisando" }
  | { tipo: "pagado"; creditos: number }
  | { tipo: "pendiente" }
  | { tipo: "no-pagado"; rechazado: boolean }
  | { tipo: "error"; mensaje: string }

const INTENTOS = 5
const ESPERA_MS = 3000

const BOTON =
  "inline-flex items-center justify-center rounded-full bg-[#C2560A] px-5 h-11 font-semibold text-white hover:bg-[#A84A08]"

export function RetornoPagoCreditos() {
  const params = useSearchParams()
  const compra = params.get("compra") || ""
  const estadoMP = params.get("status") || params.get("collection_status") || ""
  const cancelado = params.get("cancelado") === "1" || ["rejected", "null"].includes(estadoMP)

  const [estado, setEstado] = useState<Estado>(
    !compra ? { tipo: "error", mensaje: "Falta el número de compra." } : cancelado ? { tipo: "no-pagado", rechazado: estadoMP === "rejected" } : { tipo: "revisando" }
  )
  const iniciado = useRef(false)

  useEffect(() => {
    if (!compra || cancelado || iniciado.current) return
    iniciado.current = true
    let vivo = true

    const revisar = async (intento: number) => {
      const r = await confirmarCompraCreditos(compra)
      if (!vivo) return
      if (!r.ok) {
        if (r.noAutenticado) {
          setEstado({ tipo: "error", mensaje: "Tu sesión expiró. Entra a tu cuenta: si ya pagaste, tus créditos llegan solos en unos minutos." })
        } else if (intento < INTENTOS) {
          setTimeout(() => revisar(intento + 1), ESPERA_MS)
        } else {
          setEstado({ tipo: "pendiente" })
        }
        return
      }
      if (r.estado === "pagado") return setEstado({ tipo: "pagado", creditos: r.creditos })
      if (r.estado === "vencido") return setEstado({ tipo: "no-pagado", rechazado: false })
      if (intento < INTENTOS) setTimeout(() => revisar(intento + 1), ESPERA_MS)
      else setEstado({ tipo: "pendiente" })
    }
    revisar(1)
    return () => {
      vivo = false
    }
  }, [compra, cancelado])

  return (
    <main className="container mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
      {estado.tipo === "revisando" && (
        <>
          <h1 className="text-[24px] font-bold text-[#1B1B18]">Confirmando tu pago…</h1>
          <p className="text-[15px] text-[#4A4943]">No cierres esta página, tarda unos segundos.</p>
        </>
      )}

      {estado.tipo === "pagado" && (
        <>
          <h1 className="text-[24px] font-bold text-[#1B1B18]">¡Listo! Se agregaron {estado.creditos} créditos</h1>
          <p className="text-[15px] text-[#4A4943]">Ya están en tu cuenta y puedes usarlos en las herramientas de HETNA.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <LocalizedClientLink href="/user/creditos" className={BOTON}>
              Ver mis créditos
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/taller/escaneos/nuevo"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#142033] px-5 font-semibold text-[#142033] hover:bg-[#142033] hover:text-white"
            >
              Hacer un escaneo 3D
            </LocalizedClientLink>
          </div>
        </>
      )}

      {estado.tipo === "pendiente" && (
        <>
          <h1 className="text-[24px] font-bold text-[#1B1B18]">Tu pago se está confirmando</h1>
          <p className="text-[15px] text-[#4A4943]">
            Todavía no recibimos la confirmación. Si ya pagaste, no vuelvas a pagar: tus créditos se agregan solos en
            unos minutos. Si en una hora no aparecen, escríbenos con tu correo.
          </p>
          <LocalizedClientLink href="/user/creditos" className={BOTON}>
            Ver mis créditos
          </LocalizedClientLink>
        </>
      )}

      {estado.tipo === "no-pagado" && (
        <>
          <h1 className="text-[24px] font-bold text-[#1B1B18]">El pago no se completó</h1>
          <p className="text-[15px] text-[#4A4943]">
            {estado.rechazado
              ? "El pago fue rechazado. Puedes intentar con otra tarjeta o forma de pago."
              : "No se hizo ningún cargo. Puedes volver a intentarlo cuando quieras."}
          </p>
          <LocalizedClientLink href="/user/creditos" className={BOTON}>
            Volver a mis créditos
          </LocalizedClientLink>
        </>
      )}

      {estado.tipo === "error" && (
        <>
          <h1 className="text-[24px] font-bold text-[#1B1B18]">No pudimos revisar tu pago</h1>
          <p className="text-[15px] text-[#4A4943]">{estado.mensaje}</p>
          <LocalizedClientLink href="/user/creditos" className={BOTON}>
            Ir a mis créditos
          </LocalizedClientLink>
        </>
      )}
    </main>
  )
}
