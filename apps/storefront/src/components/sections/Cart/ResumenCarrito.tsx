"use client"

import Image from "next/image"

import { Button } from "@/components/atoms/Button/Button"
import { ConfianzaCompra } from "@/components/hetna/ConfianzaCompra"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PromoCode } from "@/components/organisms/PromoCode/PromoCode"
import { convertToLocale } from "@/lib/helpers/money"
import { Cart } from "@/types/cart"
import { HttpTypes } from "@medusajs/types"

import { calcularTotales } from "./totales"

// Panel del resumen, pegado a la derecha mientras se baja la lista. Cuenta
// únicamente lo que está marcado: si no marcas nada, todo queda en cero.
export const ResumenCarrito = ({
  cart,
  marcados,
  sinMarcar,
  onContinuar,
  trabajando,
}: {
  cart: Cart
  marcados: HttpTypes.StoreCartLineItem[]
  sinMarcar: number
  onContinuar: () => void
  trabajando: boolean
}) => {
  const moneda = cart.currency_code || "mxn"
  const precio = (amount: number) => convertToLocale({ amount, currency_code: moneda })

  // El envío sólo entra cuando ya hay método elegido (se regresó del checkout)
  // y no se dejó nada fuera: repartir un envío entre renglones elegidos no se
  // puede hacer bien desde aquí.
  const envio = sinMarcar === 0 ? cart.shipping_subtotal || 0 : 0
  const t = calcularTotales(marcados, envio)

  const visibles = marcados.slice(0, 5)
  const sobrantes = marcados.length - visibles.length
  const hayAlgo = marcados.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
        <h2 className="text-[16px] font-bold text-[#1B1B18]">Resumen</h2>

        {hayAlgo ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {visibles.map((item) => (
              <div
                key={item.id}
                title={item.product_title || ""}
                className="h-11 w-11 overflow-hidden rounded-[8px] border border-[#EDEAE2] bg-[#FAF9F6]"
              >
                {item.thumbnail && (
                  <Image
                    src={decodeURIComponent(item.thumbnail)}
                    alt=""
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ))}
            {sobrantes > 0 && (
              <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#EDEAE2] bg-[#FAF9F6] text-[12px] font-semibold text-[#6B6A63]">
                +{sobrantes}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-[8px] bg-[#F4F2EC] px-3 py-2.5 text-[13px] leading-relaxed text-[#4A4943]">
            No marcaste nada. Marca los productos que quieres comprar ahora.
          </p>
        )}

        <dl className="mt-4 flex flex-col gap-2.5 text-[14px]">
          <Fila termino={`Total de artículos (${t.piezas})`}>
            {t.descuentoArticulos > 0 ? (
              <span className="text-[#8A8780] line-through">{precio(t.listaArticulos)}</span>
            ) : (
              <span className="font-medium text-[#1B1B18]">{precio(t.subtotal)}</span>
            )}
          </Fila>

          {t.descuentoArticulos > 0 && (
            <>
              <Fila termino="Descuento de artículos">
                <span className="font-medium text-[#9B3225]">
                  − {precio(t.descuentoArticulos)}
                </span>
              </Fila>
              <Fila termino="Subtotal">
                <span className="font-semibold text-[#1B1B18]">{precio(t.subtotal)}</span>
              </Fila>
            </>
          )}

          {t.cupon > 0 && (
            <Fila termino="Cupón">
              <span className="font-medium text-[#9B3225]">− {precio(t.cupon)}</span>
            </Fila>
          )}

          <Fila termino="Envío">
            {t.envio > 0 ? (
              <span className="font-medium text-[#1B1B18]">{precio(t.envio)}</span>
            ) : (
              <span className="text-[13px] text-[#6B6A63]">Se calcula con tu dirección</span>
            )}
          </Fila>

          {t.impuestos > 0 && (
            <Fila termino="Impuestos">
              <span className="font-medium text-[#1B1B18]">{precio(t.impuestos)}</span>
            </Fila>
          )}
        </dl>

        <div className="mt-3 flex items-baseline justify-between border-t border-[#EDEAE2] pt-3">
          <span className="text-[14px] font-semibold text-[#1B1B18]">Estimación total</span>
          <span className="text-[24px] font-bold text-[#1B1B18]" data-testid="cart-total">
            {precio(t.total)}
          </span>
        </div>

        {t.envio === 0 && hayAlgo && (
          <p className="mt-1 text-[12px] text-[#6B6A63]">
            Falta el envío. Lo ves completo antes de pagar, nunca después.
          </p>
        )}

        {t.ahorro > 0 && (
          <p className="mt-2 rounded-[8px] bg-[#FBEAE6] px-3 py-2 text-[13px] font-semibold text-[#9B3225]">
            Ahorras {precio(t.ahorro)} en esta compra
          </p>
        )}

        <div className="mt-4">
          {sinMarcar > 0 ? (
            <Button
              className="flex w-full items-center justify-center py-3.5 text-[16px] font-bold shadow-sm"
              onClick={onContinuar}
              disabled={!hayAlgo || trabajando}
              loading={trabajando}
              data-testid="cart-checkout-button"
            >
              Continuar ({t.piezas})
            </Button>
          ) : (
            // Se entra a /checkout sin paso: la pasarela decide. Antes se
            // entraba siempre con ?step=address, así que al cliente que ya
            // tenía su dirección guardada le abría el formulario y le pedía
            // guardarla otra vez.
            <LocalizedClientLink href="/checkout" className="block">
              <Button
                className="flex w-full items-center justify-center py-3.5 text-[16px] font-bold shadow-sm"
                disabled={!hayAlgo}
                data-testid="cart-checkout-button"
              >
                Continuar ({t.piezas})
              </Button>
            </LocalizedClientLink>
          )}

          {t.ahorro > 0 && hayAlgo && (
            <p className="mt-2 text-center text-[13px] font-semibold text-[#9B3225]">
              ♥ Ahora a menor precio
            </p>
          )}

          {sinMarcar > 0 && hayAlgo && (
            <p className="mt-2 text-[12px] leading-relaxed text-[#6B5A2E]">
              Al continuar,{" "}
              {sinMarcar === 1
                ? "el producto que no marcaste se guarda"
                : `los ${sinMarcar} productos que no marcaste se guardan`}{" "}
              en tus favoritos y sale{sinMarcar === 1 ? "" : "n"} del carrito, para que no
              se te cobre{sinMarcar === 1 ? "" : "n"}.
            </p>
          )}
        </div>
      </div>

      <PromoCode cart={cart} />

      <ConfianzaCompra />
    </div>
  )
}

const Fila = ({
  termino,
  children,
}: {
  termino: string
  children: React.ReactNode
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-[#6B6A63]">{termino}</dt>
    <dd className="text-right">{children}</dd>
  </div>
)
