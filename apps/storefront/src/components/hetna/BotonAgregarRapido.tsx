"use client"

import { useState } from "react"

import { useCartContext } from "@/components/providers"
import { trackAddToCart } from "@/lib/analytics/events"
import { toast } from "@/lib/helpers/toast"

// El "+" de la tarjeta: agregar al carrito sin entrar al producto.
//
// Vive dentro del enlace de la tarjeta, así que lo primero que hace es cortar
// el clic -- si no, se agrega Y se navega a la ficha, que es lo contrario de
// lo que alguien quiere cuando aprieta un botón de atajo.
//
// No pide nada al servidor para dibujarse: la oferta y su inventario llegan ya
// resueltos desde la lista, de la misma consulta que ya se hacía para saber
// qué taller vende cada producto. Cero peticiones de más por tarjeta.
export const BotonAgregarRapido = ({
  ofertaId,
  productoId,
  titulo,
  precio,
  moneda,
  locale,
}: {
  ofertaId: string
  productoId: string
  titulo: string
  precio: number
  moneda: string
  locale: string
}) => {
  const { addToCart } = useCartContext()
  const [trabajando, setTrabajando] = useState(false)
  const [listo, setListo] = useState(false)

  const agregar = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (trabajando) return

    setTrabajando(true)
    try {
      await addToCart({ offerId: ofertaId, quantity: 1, countryCode: locale })
      trackAddToCart(
        { item_id: productoId, item_name: titulo, price: precio, quantity: 1 },
        moneda
      )
      setListo(true)
      setTimeout(() => setListo(false), 1800)
    } catch (error) {
      toast.error({
        title: "No se pudo agregar",
        description: error instanceof Error ? error.message : "Vuelve a intentarlo.",
      })
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <button
      type="button"
      onClick={agregar}
      disabled={trabajando}
      aria-label={`Agregar ${titulo} al carrito`}
      title="Agregar al carrito"
      className={`flex h-9 w-9 items-center justify-center rounded-full text-[20px] leading-none shadow-md transition ${
        listo
          ? "bg-[#1E7A52] text-white"
          : "bg-white text-[#1B1B18] hover:bg-[#C2560A] hover:text-white"
      } disabled:opacity-70`}
      data-testid="quick-add-to-cart"
    >
      {listo ? "✓" : trabajando ? "…" : "+"}
    </button>
  )
}
