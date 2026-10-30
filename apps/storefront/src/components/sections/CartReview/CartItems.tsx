"use client"

import { HttpTypes } from "@medusajs/types"

import { CartItemsHeader } from "@/components/cells/CartItemsHeader/CartItemsHeader"
import { CartItemsProducts } from "@/components/cells/CartItemsProducts/CartItemsProducts"
import { filterValidCartItems } from "@/lib/helpers/filter-valid-cart-items"

// Lo que se está comprando, agrupado por taller, dentro de la pasarela.
//
// Sin casillas, sin borrar y sin cambiar cantidades: a esta altura ya hay una
// sesión de pago abierta contra un monto, y mover el carrito aquí la invalida.
// Para cambiar algo se regresa al carrito, que es el botón de arriba.
export const CartItems = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  if (!cart) return null

  const grupos = agruparPorTaller(cart)
  if (!grupos.length) return null

  return (
    <div className="flex flex-col gap-4">
      {grupos.map((grupo) => (
        <div key={grupo.seller.id}>
          <CartItemsHeader
            seller={grupo.seller}
            cantidad={grupo.items.reduce((s, i) => s + i.quantity, 0)}
          />
          <CartItemsProducts
            delete_item={false}
            change_quantity={false}
            products={grupo.items}
            currency_code={cart.currency_code}
          />
        </div>
      ))}
    </div>
  )
}

function agruparPorTaller(cart: HttpTypes.StoreCart) {
  const porTaller = new Map<string, { seller: any; items: HttpTypes.StoreCartLineItem[] }>()

  filterValidCartItems(cart.items).forEach((item) => {
    const vendedor = (item as any).offer?.seller
    // "fleek" es el id centinela que el encabezado reconoce como "lo vende HETNA".
    const clave = vendedor?.id ?? "fleek"
    const seller = vendedor
      ? { ...vendedor, photo: vendedor.photo ?? vendedor.logo }
      : {
          name: "HETNA CNC",
          id: "fleek",
          handle: "",
          photo: "/logo-hetna.webp",
          created_at: new Date(),
        }

    if (!porTaller.has(clave)) porTaller.set(clave, { seller, items: [] })
    porTaller.get(clave)!.items.push(item)
  })

  return [...porTaller.values()]
}
