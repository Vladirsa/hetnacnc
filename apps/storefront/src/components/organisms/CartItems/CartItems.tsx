"use client"

import { HttpTypes } from "@medusajs/types"

import {
  CartItemsFooter,
  CartItemsHeader,
  CartItemsProducts,
} from "@/components/cells"
import { BarraEnvioGratis } from "@/components/hetna/envios/BarraEnvioGratis"
import { useUmbralesEnvio } from "@/components/hetna/envios/useUmbralesEnvio"
import { AvancePack, piezasQueCuentan } from "@/components/hetna/packs/AvancePack"
import { usePacks } from "@/components/hetna/packs/usePacks"
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
  const idsTalleres = grupos.map((g) => g.seller.id)
  const umbrales = useUmbralesEnvio(idsTalleres)
  const packs = usePacks(idsTalleres)

  if (!cart) return null
  if (!grupos.length) return <EmptyCart />

  // El umbral de envío gratis de un taller se evalúa contra el carrito
  // COMPLETO (`item_total`), no contra lo que lleva de ese taller. Así que el
  // avance de todas las barras es el mismo número, el de aquí, y lo único que
  // cambia de taller a taller es el umbral.
  const contadosEnTodo = seleccion
    ? filterValidCartItems(cart.items).filter((item) =>
        seleccion.estaSeleccionado(item.id)
      )
    : filterValidCartItems(cart.items)

  const avanceDelCarrito = contadosEnTodo.reduce(
    (suma, item) => suma + (item.total ?? item.subtotal ?? 0),
    0
  )

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
        const umbral = umbrales[grupo.seller.id] ?? null
        // Los packs de ESTE taller, y sólo los que tienen algo que contar en su
        // parte del carrito: anunciar un pack de Bujes a quien no lleva ningún
        // buje es ruido.
        const packsDelGrupo = packs
          .filter((pack) => pack.seller_id === grupo.seller.id)
          .map((pack) => ({ pack, cuentan: piezasQueCuentan(pack, grupo.items) }))
          .filter(({ cuentan }) => cuentan > 0)

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
              ultimo={!umbral && !packsDelGrupo.length}
            />
            {packsDelGrupo.map(({ pack, cuentan }, i) => (
              <AvancePack
                key={pack.promocion_id}
                pack={pack}
                piezas={cuentan}
                ultimo={!umbral && i === packsDelGrupo.length - 1}
              />
            ))}
            {umbral && (
              <BarraEnvioGratis
                nombre={grupo.seller.name}
                umbral={umbral.gratis_desde}
                avance={avanceDelCarrito}
                precioEnvio={umbral.precio}
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
