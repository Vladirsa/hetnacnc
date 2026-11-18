"use client"

import Image from "next/image"

import { ConfianzaCompra } from "@/components/hetna/ConfianzaCompra"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PromoCode } from "@/components/organisms/PromoCode/PromoCode"
import { filterValidCartItems } from "@/lib/helpers/filter-valid-cart-items"
import { convertToLocale } from "@/lib/helpers/money"

import PaymentButton from "./PaymentButton"

// Columna derecha de la pasarela, de arriba abajo:
//   Resumen  miniaturas de lo que compras y el desglose (precio normal,
//            descuento de artículos, subtotal, envío, descuentos extra, IVA)
//   Cupón
//   (la página mete aquí Tus datos, Envío y Forma de pago)
//   Pagar    el total otra vez y el botón
//
// Los números salen de `cart` tal como lo manda el backend: lo que está en el
// carrito es lo que se cobra. El "precio normal" tachado sólo aparece si el
// producto trae de verdad un precio de comparación más alto; nunca se inventa
// un descuento.

const datosDe = (cart: any, soloDigital: boolean) => {
  const moneda = cart?.currency_code || "mxn"
  const precio = (amount: number) => convertToLocale({ amount, currency_code: moneda })
  const items: any[] = filterValidCartItems(cart?.items || [])

  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0
  // Cada taller del carrito necesita su método de envío
  const cartSellerCount = new Set(items.map((item: any) => item.offer?.seller_id).filter(Boolean)).size
  const allSellersHaveShipping = cart.shipping_methods.length > 0 && cart.shipping_methods.length >= cartSellerCount
  const previousStepsCompleted = cart.shipping_address && allSellersHaveShipping && (cart.payment_collection || paidByGiftcard)

  const falta: { paso: string; texto: string }[] = []
  if (soloDigital && (!cart.email || !allSellersHaveShipping)) falta.push({ paso: "address", texto: "Escribe tu correo y tu nombre" })
  else if (!cart.shipping_address) falta.push({ paso: "address", texto: "Captura tu dirección de entrega" })
  if (!soloDigital && !allSellersHaveShipping)
    falta.push({ paso: "delivery", texto: cartSellerCount > 1 ? "Elige cómo te envía cada taller" : "Elige cómo te lo enviamos" })
  if (!cart.payment_collection && !paidByGiftcard) falta.push({ paso: "payment", texto: "Elige tu forma de pago" })

  const subtotalArticulos = cart?.item_subtotal || 0
  // Precio normal: el de comparación si es más alto que lo que se cobra
  const precioNormal = items.reduce((s, i) => {
    const cobrado = i.subtotal ?? 0
    const comparar = (i.compare_at_unit_price || 0) * i.quantity
    return s + (comparar > cobrado ? comparar : cobrado)
  }, 0)
  const descuentoArticulos = Math.max(0, precioNormal - subtotalArticulos)

  return {
    precio,
    items,
    allSellersHaveShipping,
    previousStepsCompleted,
    falta,
    subtotalArticulos,
    precioNormal,
    descuentoArticulos,
    envio: cart?.shipping_subtotal || 0,
    descuentoExtra: cart?.discount_total || 0,
    impuestos: cart?.tax_total || 0,
    ivaIncluido: items.length > 0 && items.every((i) => i?.is_tax_inclusive === true),
    piezas: items.reduce((s, i) => s + (i.quantity || 0), 0),
  }
}

/** Resumen: miniaturas y desglose. */
export const ResumenCompra = ({ cart, soloDigital = false }: { cart: any; soloDigital?: boolean }) => {
  const d = datosDe(cart, soloDigital)
  const visibles = d.items.slice(0, 5)
  const resto = d.items.length - visibles.length

  return (
    <section className="rounded-[16px] border border-[#E7E4DC] bg-white p-4 sm:p-5" data-testid="cart-summary" aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen" className="text-[24px] font-extrabold text-[#111]">
        Resumen
      </h2>

      {/* Miniaturas de lo que compras */}
      {visibles.length > 0 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Productos">
          {visibles.map((i) => (
            <li key={i.id} className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[8px] border border-[#EDEAE2] bg-[#FAF9F6]">
              {i.thumbnail ? (
                <Image src={decodeURIComponent(i.thumbnail)} alt={i.product_title || "Producto"} fill sizes="60px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] text-[#8A8780]">Sin foto</span>
              )}
              {i.quantity > 1 && (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-bold text-white">×{i.quantity}</span>
              )}
            </li>
          ))}
          {resto > 0 && (
            <li className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[8px] border border-[#EDEAE2] bg-[#F4F3EF] text-[13px] font-bold text-[#44433D]">
              +{resto}
            </li>
          )}
        </ul>
      )}

      <dl className="mt-4 flex flex-col gap-2.5 text-[14.5px]">
        <Fila termino={`Total de artículos (${d.piezas})`}>
          {d.descuentoArticulos > 0 ? (
            <span className="text-[#8A8780] line-through">{d.precio(d.precioNormal)}</span>
          ) : (
            <span className="font-medium text-[#111]">{d.precio(d.subtotalArticulos)}</span>
          )}
        </Fila>

        {d.descuentoArticulos > 0 && (
          <Fila termino="Descuento de artículos">
            <span className="font-semibold text-[#E5322D]">− {d.precio(d.descuentoArticulos)}</span>
          </Fila>
        )}

        <Fila termino={<span className="font-bold text-[#111]">Subtotal</span>}>
          <span className="font-bold text-[#111]">{d.precio(d.subtotalArticulos)}</span>
        </Fila>

        <Fila termino={<span className="font-bold text-[#111]">Envío</span>}>
          {soloDigital && d.envio === 0 ? (
            <span className="text-[13px] text-[#4A4943]">No aplica: es descarga</span>
          ) : d.allSellersHaveShipping ? (
            <span className="font-bold text-[#111]">{d.envio === 0 ? <span className="text-[#17803F]">Gratis</span> : d.precio(d.envio)}</span>
          ) : (
            <span className="text-[13px] text-[#6B6A63]">Se calcula al elegir el envío</span>
          )}
        </Fila>

        {d.descuentoExtra > 0 && (
          <Fila termino={<span className="font-bold text-[#111]">Descuentos extra</span>}>
            <span className="font-bold text-[#E5322D]">− {d.precio(d.descuentoExtra)}</span>
          </Fila>
        )}

        <Fila termino="IVA">
          {d.ivaIncluido ? (
            <span className="text-[13px] text-[#4A4943]">Incluido{d.impuestos > 0 ? ` (${d.precio(d.impuestos)})` : ""}</span>
          ) : d.impuestos > 0 ? (
            <span className="font-medium text-[#111]">{d.precio(d.impuestos)}</span>
          ) : (
            <span className="text-[13px] text-[#4A4943]">No se agrega nada</span>
          )}
        </Fila>
      </dl>

      {d.descuentoArticulos + d.descuentoExtra > 0 && (
        <p className="mt-3 rounded-[8px] bg-[#FDECEA] px-3 py-2 text-[13px] font-semibold text-[#C9221D]">
          ¡Te ahorras {d.precio(d.descuentoArticulos + d.descuentoExtra)} en esta compra!
        </p>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t border-[#EDEAE2] pt-3">
        <span className="text-[18px] font-extrabold text-[#111]">{d.allSellersHaveShipping || soloDigital ? "Total" : "Estimación total"}</span>
        <span className="text-[26px] font-extrabold text-[#111]" data-testid="checkout-total">
          {d.precio(cart?.total || 0)}
        </span>
      </div>
    </section>
  )
}

/** Pagar: total y botón (o lo que falta para poder pagar). */
export const PagarCompra = ({ cart, conPaypal = false, soloDigital = false }: { cart: any; conPaypal?: boolean; soloDigital?: boolean }) => {
  const d = datosDe(cart, soloDigital)
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[16px] border border-[#E7E4DC] bg-white p-4 sm:p-5" aria-label="Pagar">
        <div className="flex items-baseline justify-between">
          <span className="text-[16px] font-bold text-[#111]">Total a pagar</span>
          <span className="text-[24px] font-extrabold text-[#111]">{d.precio(cart?.total || 0)}</span>
        </div>
        <div className="mt-3">
          {d.previousStepsCompleted ? (
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          ) : (
            // Se nombra lo que falta, no "completa los pasos"
            <div role="alert" className="rounded-[10px] border border-[#E6C4BE] bg-[#FBF0EE] px-3 py-2.5">
              <p className="text-[13px] font-semibold text-[#9B3225]">{d.falta.length === 1 ? "Falta un paso:" : "Faltan estos pasos:"}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {d.falta.map((f) => (
                  <li key={f.paso}>
                    <LocalizedClientLink href={`/checkout?step=${f.paso}`} className="text-[13px] font-medium text-[#9B3225] underline">
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
      </section>
      <ConfianzaCompra conPaypal={conPaypal} soloDigital={soloDigital} />
    </div>
  )
}

export const CuponCompra = ({ cart }: { cart: any }) => <PromoCode cart={cart} />

const Fila = ({ termino, children }: { termino: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-[#44433D]">{termino}</dt>
    <dd className="text-right">{children}</dd>
  </div>
)

// Todo junto (por si otra página lo usa así)
const Review = ({ cart, conPaypal = false, soloDigital = false }: { cart: any; conPaypal?: boolean; soloDigital?: boolean }) => (
  <div className="flex flex-col gap-4">
    <ResumenCompra cart={cart} soloDigital={soloDigital} />
    <CuponCompra cart={cart} />
    <PagarCompra cart={cart} conPaypal={conPaypal} soloDigital={soloDigital} />
  </div>
)

export default Review
