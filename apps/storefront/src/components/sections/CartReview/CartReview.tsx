"use client"

import { ConfianzaCompra } from "@/components/hetna/ConfianzaCompra"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PromoCode } from "@/components/organisms/PromoCode/PromoCode"
import { convertToLocale } from "@/lib/helpers/money"

import PaymentButton from "./PaymentButton"

// Panel derecho de la pasarela: el resumen, el botón de pagar y las razones
// para hacerlo.
//
// Aquí los números SÍ salen de `cart` tal como lo manda el backend. En el
// carrito se suman los renglones marcados, porque ahí el cliente elige qué
// compra; en la pasarela ya no hay nada que elegir: lo que está en el carrito
// es lo que se cobra, y el total bueno es el del backend, con su envío y sus
// impuestos de la dirección real.
const Review = ({ cart }: { cart: any }) => {
  const moneda = cart?.currency_code || "mxn"
  const precio = (amount: number) => convertToLocale({ amount, currency_code: moneda })

  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  // Cada taller del carrito necesita su método de envío. El backend exige uno
  // por taller, así que cubrirlos todos es tener tantos métodos como talleres.
  const cartSellerCount = new Set(
    (cart?.items ?? []).map((item: any) => item.offer?.seller_id).filter(Boolean)
  ).size
  const allSellersHaveShipping =
    cart.shipping_methods.length > 0 && cart.shipping_methods.length >= cartSellerCount

  const previousStepsCompleted =
    cart.shipping_address &&
    allSellersHaveShipping &&
    (cart.payment_collection || paidByGiftcard)

  const falta: { paso: string; texto: string }[] = []
  if (!cart.shipping_address) {
    falta.push({ paso: "address", texto: "Captura tu dirección de entrega" })
  }
  if (!allSellersHaveShipping) {
    falta.push({
      paso: "delivery",
      texto:
        cartSellerCount > 1
          ? "Elige cómo te envía cada taller"
          : "Elige cómo te lo enviamos",
    })
  }
  if (!cart.payment_collection && !paidByGiftcard) {
    falta.push({ paso: "payment", texto: "Elige tu forma de pago" })
  }

  const envio = cart?.shipping_subtotal || 0
  const descuento = cart?.discount_total || 0
  const impuestos = cart?.tax_total || 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4" data-testid="cart-summary">
        <h2 className="text-[16px] font-bold text-[#1B1B18]">Resumen</h2>

        <dl className="mt-3 flex flex-col gap-2.5 text-[14px]">
          <Fila termino="Subtotal">
            <span className="font-medium text-[#1B1B18]">
              {precio(cart?.item_subtotal || 0)}
            </span>
          </Fila>

          {descuento > 0 && (
            <Fila termino="Descuento">
              <span className="font-medium text-[#9B3225]">− {precio(descuento)}</span>
            </Fila>
          )}

          <Fila termino="Gastos de envío">
            {allSellersHaveShipping ? (
              <span className="font-medium text-[#1B1B18]">
                {envio === 0 ? "Gratis" : precio(envio)}
              </span>
            ) : (
              <span className="text-[13px] text-[#6B6A63]">Elige el envío</span>
            )}
          </Fila>

          <Fila termino="Impuestos">
            <span className="font-medium text-[#1B1B18]">{precio(impuestos)}</span>
          </Fila>
        </dl>

        <div className="mt-3 flex items-baseline justify-between border-t border-[#EDEAE2] pt-3">
          <span className="text-[14px] font-semibold text-[#1B1B18]">Total</span>
          <span className="text-[26px] font-bold text-[#1B1B18]" data-testid="checkout-total">
            {precio(cart?.total || 0)}
          </span>
        </div>

        <div className="mt-4">
          {previousStepsCompleted ? (
            <PaymentButton
              cart={cart}
              data-testid="submit-order-button"
            />
          ) : (
            // Se nombra lo que falta, no "completa los pasos". Quien llega aquí
            // ya cree haber llenado todo; decirle en genérico que falta algo lo
            // deja buscando.
            <div
              role="alert"
              className="rounded-[10px] border border-[#E6C4BE] bg-[#FBF0EE] px-3 py-2.5"
            >
              <p className="text-[13px] font-semibold text-[#9B3225]">
                {falta.length === 1 ? "Falta un paso:" : "Faltan estos pasos:"}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {falta.map((f) => (
                  <li key={f.paso}>
                    <LocalizedClientLink
                      href={`/checkout?step=${f.paso}`}
                      className="text-[13px] font-medium text-[#9B3225] underline"
                    >
                      {f.texto}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-[#6B6A63]">
            Al pagar confirmas que leíste y aceptas los{" "}
            <LocalizedClientLink href="/terminos-y-condiciones" className="underline">
              términos y condiciones
            </LocalizedClientLink>
            .
          </p>
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

export default Review
