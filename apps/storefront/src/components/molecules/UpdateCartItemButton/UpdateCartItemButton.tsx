"use client"

import { useEffect, useRef, useState } from "react"

import { useCartContext } from "@/components/providers"
import { toast } from "@/lib/helpers/toast"

// Cuánto se espera antes de mandar el cambio, para que apretar "+" cuatro
// veces seguidas sea una sola llamada y no cuatro.
const ESPERA_MS = 450

export const UpdateCartItemButton = ({
  quantity,
  lineItemId,
}: {
  quantity: number
  lineItemId: string
}) => {
  const { updateCartItem } = useCartContext()
  const [cantidad, setCantidad] = useState(quantity)
  const [guardando, setGuardando] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Lo último que el cliente pidió y todavía no se confirma. Mientras haya
  // algo aquí, la cantidad que manda es la local.
  const pedido = useRef<number | null>(null)

  // El carrito se refresca solo (otra pestaña, un borrado, el servidor). Cuando
  // eso pasa hay que hacerle caso -- pero NO mientras el cliente tiene un
  // cambio en vuelo, o el número le brinca de vuelta al viejo mientras sigue
  // apretando. Ése era el "no se actualizan las cantidades": el efecto pisaba
  // el valor local en cada render.
  useEffect(() => {
    if (pedido.current === null) {
      setCantidad(quantity)
    }
  }, [quantity])

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  const cambiar = (nueva: number) => {
    if (nueva < 1 || !lineItemId) return

    setCantidad(nueva)
    pedido.current = nueva

    if (temporizador.current) clearTimeout(temporizador.current)

    temporizador.current = setTimeout(async () => {
      const aGuardar = pedido.current
      if (aGuardar === null) return

      setGuardando(true)
      try {
        await updateCartItem(lineItemId, aGuardar)
        // Si mientras se guardaba el cliente volvió a apretar, lo suyo manda:
        // no se suelta el valor local todavía.
        if (pedido.current === aGuardar) pedido.current = null
      } catch (error: unknown) {
        pedido.current = null
        setCantidad(quantity)
        toast.error({
          title: "No se pudo cambiar la cantidad",
          description:
            error instanceof Error
              ? error.message.replace("Error setting up the request: ", "")
              : "Vuelve a intentarlo.",
        })
      } finally {
        setGuardando(false)
      }
    }, ESPERA_MS)
  }

  // Los botones NO se apagan mientras se guarda. Antes usaban `isUpdatingItem`,
  // que es del carrito entero: bastaba con que cualquier renglón estuviera
  // guardando para que todos los botones de la página quedaran muertos medio
  // segundo o más, y los clics de ese rato se perdían. El rebote ya se encarga
  // de que no se manden llamadas de más.
  return (
    <div className="flex items-center overflow-hidden rounded-[8px] border border-[#E7E4DC]">
      <button
        type="button"
        aria-label="Quitar uno"
        className="flex h-8 w-8 items-center justify-center text-[18px] leading-none text-[#4A4943] hover:bg-[#F4F2EC] disabled:text-[#C7C4BC] disabled:hover:bg-transparent"
        disabled={cantidad <= 1}
        onClick={() => cambiar(cantidad - 1)}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={`w-9 text-center text-[14px] font-semibold ${
          guardando ? "text-[#8A8780]" : "text-[#1B1B18]"
        }`}
        data-testid="cart-item-quantity"
      >
        {cantidad}
      </span>
      <button
        type="button"
        aria-label="Agregar uno"
        className="flex h-8 w-8 items-center justify-center text-[18px] leading-none text-[#4A4943] hover:bg-[#F4F2EC] disabled:text-[#C7C4BC] disabled:hover:bg-transparent"
        onClick={() => cambiar(cantidad + 1)}
      >
        +
      </button>
    </div>
  )
}
