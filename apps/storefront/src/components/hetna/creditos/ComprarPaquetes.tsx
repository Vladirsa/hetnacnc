"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { Button } from "@/components/atoms"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useCartContext } from "@/components/providers"
import type { Paquete } from "@/lib/creditos/acciones"
import { convertToLocale } from "@/lib/helpers/money"
import { toast } from "@/lib/helpers/toast"

// Comprar créditos NO abre una pasarela aparte: el paquete se mete al carrito
// como cualquier producto y se paga en el checkout de siempre, con Mercado
// Pago. Cuando el pago se confirma, los subscribers del backend acreditan el
// monedero.
//
// Es a propósito. Una segunda pasarela sería un segundo lugar donde se cobra
// mal, otra integración que mantener, y la compra se quedaría fuera del
// historial de pedidos. Así el taller ve su compra de créditos junto a todo lo
// demás y puede pedir su factura igual.
export const ComprarPaquetes = ({
  paquetes,
  locale,
  porEscaneo,
}: {
  paquetes: Paquete[]
  locale: string
  porEscaneo: number
}) => {
  const { addToCart } = useCartContext()
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const router = useRouter()

  if (!paquetes.length) {
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

  const comprar = async (paquete: Paquete) => {
    if (!paquete.ofertaId) return
    setTrabajando(paquete.id)
    try {
      await addToCart({ offerId: paquete.ofertaId, quantity: 1, countryCode: locale })
      router.push(`/${locale}/cart`)
    } catch (error) {
      console.error("No se pudo agregar el paquete al carrito", error)
      toast.error({
        title: "No se pudo agregar al carrito",
        description: error instanceof Error ? error.message : "Vuelve a intentarlo.",
      })
      setTrabajando(null)
    }
  }

  // El paquete con mejor precio por crédito: el que conviene señalar.
  const mejor = paquetes.reduce<Paquete | null>((mejorHastaAhora, p) => {
    if (!p.precio) return mejorHastaAhora
    if (!mejorHastaAhora?.precio) return p
    return p.precio / p.creditos < mejorHastaAhora.precio / mejorHastaAhora.creditos
      ? p
      : mejorHastaAhora
  }, null)

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {paquetes.map((p) => {
        const escaneos = Math.floor(p.creditos / Math.max(porEscaneo, 1))
        const esMejor = mejor?.id === p.id && paquetes.length > 1

        return (
          <article
            key={p.id}
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
              {p.creditos}{" "}
              <span className="text-[14px] font-semibold text-[#6B6A63]">créditos</span>
            </p>

            {escaneos > 0 && (
              <p className="mt-1 text-[13px] text-[#6B6A63]">
                {escaneos} {escaneos === 1 ? "escaneo 3D" : "escaneos 3D"}
              </p>
            )}

            <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[#4A4943]">
              {p.descripcion}
            </p>

            <p className="mt-3 text-[22px] font-bold text-[#1B1B18]">
              {p.precio === null
                ? "—"
                : convertToLocale({ amount: p.precio, currency_code: p.moneda })}
            </p>
            {p.precio !== null && (
              <p className="text-[12px] text-[#6B6A63]">
                {convertToLocale({
                  amount: p.precio / p.creditos,
                  currency_code: p.moneda,
                })}{" "}
                por crédito
              </p>
            )}

            <Button
              className="mt-4 flex w-full items-center justify-center py-3 font-bold"
              onClick={() => comprar(p)}
              disabled={trabajando !== null}
              loading={trabajando === p.id}
            >
              Comprar
            </Button>
          </article>
        )
      })}
    </div>
  )
}
