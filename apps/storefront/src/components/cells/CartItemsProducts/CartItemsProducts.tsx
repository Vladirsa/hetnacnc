"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"

import { Checkbox } from "@/components/atoms"
import { BotonFavoritoIcono } from "@/components/hetna/Favoritos"
import { DeleteCartItemButton } from "@/components/molecules"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { UpdateCartItemButton } from "@/components/molecules/UpdateCartItemButton/UpdateCartItemButton"
import { filterValidCartItems } from "@/lib/helpers/filter-valid-cart-items"
import { convertToLocale } from "@/lib/helpers/money"

// Cuántas piezas quedan para que valga la pena avisarlo. Arriba de esto el
// número no cambia la decisión de nadie; abajo, sí.
const EXISTENCIAS_BAJAS = 5

type Seleccion = {
  estaSeleccionado: (id: string) => boolean
  alternar: (id: string) => void
}

export const CartItemsProducts = ({
  products,
  currency_code,
  delete_item = true,
  change_quantity = true,
  seleccion,
}: {
  products: HttpTypes.StoreCartLineItem[]
  currency_code: string
  delete_item?: boolean
  change_quantity?: boolean
  // Sin este prop no hay casillas: así se ve en el resumen del checkout, donde
  // ya no se elige nada.
  seleccion?: Seleccion
}) => {
  const validProducts = filterValidCartItems(products)

  return (
    <div className="divide-y divide-[#EDEAE2] rounded-b-[12px] border border-t-0 border-[#E7E4DC] bg-white">
      {validProducts.map((product) => {
        const options = Object.entries(product.variant_option_values ?? {})

        const subtotal = product.subtotal ?? 0
        const comparar = (product.compare_at_unit_price || 0) * product.quantity
        const hayDescuento = comparar > subtotal
        const porcentaje = hayDescuento
          ? Math.round(((comparar - subtotal) / comparar) * 100)
          : 0

        const existencias = product.variant?.inventory_quantity
        const controlaExistencias =
          product.variant?.manage_inventory && typeof existencias === "number"
        const pocas =
          controlaExistencias && existencias! > 0 && existencias! <= EXISTENCIAS_BAJAS
        const noAlcanza = controlaExistencias && product.quantity > existencias!

        const seleccionado = seleccion ? seleccion.estaSeleccionado(product.id) : true

        return (
          <div
            key={product.id}
            data-testid={`cart-item-${product.id}`}
            className={`flex gap-3 p-3 sm:gap-4 sm:p-4 ${
              seleccionado ? "" : "bg-[#FBFAF7]"
            }`}
          >
            {seleccion && (
              <div className="flex items-start pt-1">
                <Checkbox
                  checked={seleccionado}
                  onChange={() => seleccion.alternar(product.id)}
                  aria-label={`Incluir ${product.product_title || "este producto"} en la compra`}
                  data-testid="cart-item-select"
                />
              </div>
            )}

            <LocalizedClientLink
              href={`/products/${product.product_handle}`}
              className="shrink-0"
            >
              <div
                className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[10px] border border-[#EDEAE2] bg-[#FAF9F6] sm:h-[104px] sm:w-[104px]"
                data-testid="cart-item-image"
              >
                {product.thumbnail ? (
                  <Image
                    src={decodeURIComponent(product.thumbnail)}
                    alt={product.product_title || "Producto"}
                    width={104}
                    height={104}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={"/images/placeholder.svg"}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 object-contain opacity-30"
                  />
                )}
              </div>
            </LocalizedClientLink>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <LocalizedClientLink
                  href={`/products/${product.product_handle}`}
                  className="min-w-0"
                >
                  <h3
                    className="line-clamp-2 text-[14px] font-medium leading-snug text-[#1B1B18] hover:text-[#B34D07] sm:text-[15px]"
                    data-testid="cart-item-title"
                  >
                    {product.product_title}
                    {product.subtitle && ` — ${product.subtitle}`}
                  </h3>
                </LocalizedClientLink>

                <div className="flex shrink-0 items-center">
                  {product.product_id && product.product_handle && (
                    <BotonFavoritoIcono
                      producto={{
                        id: product.product_id,
                        handle: product.product_handle,
                        title: product.product_title || "",
                        thumbnail: product.thumbnail || undefined,
                      }}
                    />
                  )}
                  {delete_item && <DeleteCartItemButton id={product.id} />}
                </div>
              </div>

              {options.length > 0 && (
                <div
                  className="mt-1.5 flex flex-wrap gap-1.5"
                  data-testid="cart-item-details"
                >
                  {options.map(([title, value]) => (
                    <span
                      key={title}
                      className="rounded-full bg-[#F4F2EC] px-2 py-0.5 text-[12px] text-[#4A4943]"
                    >
                      {title}: {String(value)}
                    </span>
                  ))}
                </div>
              )}

              {noAlcanza ? (
                <p className="mt-1.5 text-[12px] font-semibold text-[#9B3225]">
                  {existencias === 0
                    ? "Se agotó mientras estaba en tu carrito"
                    : `Sólo quedan ${existencias} y pediste ${product.quantity}`}
                </p>
              ) : pocas ? (
                <p className="mt-1.5 text-[12px] font-semibold text-[#9B3225]">
                  {existencias === 1 ? "Queda 1" : `Quedan ${existencias}`}
                </p>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div>
                  <div className="flex items-baseline gap-2">
                    <p
                      className="text-[17px] font-bold text-[#1B1B18]"
                      data-testid="cart-item-price"
                    >
                      {convertToLocale({ amount: subtotal, currency_code })}
                    </p>
                    {hayDescuento && porcentaje > 0 && (
                      <span className="rounded bg-[#FBEAE6] px-1.5 py-0.5 text-[12px] font-bold text-[#9B3225]">
                        -{porcentaje}%
                      </span>
                    )}
                  </div>
                  {hayDescuento && (
                    <p className="text-[13px] text-[#8A8780] line-through">
                      {convertToLocale({ amount: comparar, currency_code })}
                    </p>
                  )}
                  {product.quantity > 1 && (
                    <p className="text-[12px] text-[#6B6A63]">
                      {convertToLocale({
                        amount: subtotal / product.quantity,
                        currency_code,
                      })}{" "}
                      c/u
                    </p>
                  )}
                </div>

                {change_quantity ? (
                  <UpdateCartItemButton
                    quantity={product.quantity}
                    lineItemId={product.id}
                  />
                ) : (
                  <p className="text-[13px] text-[#6B6A63]">
                    Cantidad: <span className="text-[#1B1B18]">{product.quantity}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
