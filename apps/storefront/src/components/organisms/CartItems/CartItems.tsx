"use client"

import { HttpTypes } from "@medusajs/types"

import {
  CartItemsFooter,
  CartItemsHeader,
  CartItemsProducts,
} from "@/components/cells"
import { BarraEnvioGratis } from "@/components/hetna/promociones/BarraEnvioGratis"
import { usePromosTalleres } from "@/components/hetna/promociones/usePromosTalleres"
import { filterValidCartItems } from "@/lib/helpers/filter-valid-cart-items"
import { Cart } from "@/types/cart"

import { EmptyCart } from "./EmptyCart"
import type { Seleccion } from "@/components/sections/Cart/useSeleccion"

export const CartItems = ({
  cart,
  seleccion,
}: {
  cart: Cart | null
  seleccion?: Seleccion
}) => {
  const grupos = cart ? agruparPorTaller(cart) : []
  const promos = usePromosTalleres(grupos.map((g) => g.seller.id))

  if (!cart) return null
  if (!grupos.length) return <EmptyCart />

  // El umbral de envío gratis de un taller se evalúa contra el carrito
  // COMPLETO, no contra lo que lleva de ese taller: Medusa calcula la promoción
  // con el carrito entero y Mercur nomás limita el descuento al envío del
  // taller dueño. Así que el avance de todas las barras es el mismo número, el
  // de aquí, y sólo cambia el umbral.
  const contadosEnTodo = seleccion
    ? filterValidCartItems(cart.items).filter((item) =>
        seleccion.estaSeleccionado(item.id)
      )
    : filterValidCartItems(cart.items)

  const avancePorAtributo: Record<string, number> = {
    subtotal: contadosEnTodo.reduce((s, i) => s + (i.subtotal ?? 0), 0),
    item_subtotal: contadosEnTodo.reduce((s, i) => s + (i.subtotal ?? 0), 0),
    item_total: contadosEnTodo.reduce((s, i) => s + (i.total ?? i.subtotal ?? 0), 0),
    total: contadosEnTodo.reduce((s, i) => s + (i.total ?? i.subtotal ?? 0), 0),
  }

  return (
    <div className="flex flex-col gap-4">
      {grupos.map((grupo) => {
        const ids = grupo.items.map((item) => item.id)
        // El subtotal del taller cuenta sólo lo marcado, igual que el resumen de
        // la derecha. Dos números del mismo carrito que no concuerdan es peor
        // que no poner el segundo.
        const contados = seleccion
          ? grupo.items.filter((item) => seleccion.estaSeleccionado(item.id))
          : grupo.items
        const subtotal = contados.reduce((suma, item) => suma + (item.subtotal ?? 0), 0)
        const piezas = grupo.items.reduce((suma, item) => suma + item.quantity, 0)
        const envioGratis = promos[grupo.seller.id]?.envio_gratis ?? null

        return (
          <div key={grupo.seller.id} data-testid={`cart-items-seller-${grupo.seller.id}`}>
            <CartItemsHeader
              seller={grupo.seller}
              cantidad={piezas}
              seleccion={
                seleccion
                  ? {
                      seleccionado: seleccion.grupoSeleccionado(ids),
                      alternar: () => seleccion.alternarGrupo(ids),
                    }
                  : undefined
              }
            />
            <CartItemsProducts
              products={grupo.items}
              currency_code={cart.currency_code}
              seleccion={seleccion}
            />
            <CartItemsFooter
              currency_code={cart.currency_code}
              subtotal={subtotal}
              ultimo={!envioGratis}
            />
            {envioGratis && (
              <BarraEnvioGratis
                nombre={grupo.seller.name}
                umbral={envioGratis.umbral}
                avance={
                  avancePorAtributo[envioGratis.atributo] ??
                  avancePorAtributo.item_total
                }
                currency_code={cart.currency_code}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Un renglón por oferta, agrupado por el taller que la vende. Se devuelve un
// arreglo y no un objeto para que el orden sea el de llegada al carrito: con un
// objeto el orden depende de los ids y los grupos brincan de lugar entre
// recargas.
function agruparPorTaller(cart: Cart) {
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

    if (!porTaller.has(clave)) {
      porTaller.set(clave, { seller, items: [] })
    }
    porTaller.get(clave)!.items.push(item)
  })

  return [...porTaller.values()]
}
