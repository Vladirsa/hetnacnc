"use client"

import Image from "next/image"

import { Button } from "@/components/atoms"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { PromoCode } from "@/components/organisms/PromoCode/PromoCode"
import { EMPRESA } from "@/lib/hetna/empresa"
import { convertToLocale } from "@/lib/helpers/money"
import { Cart } from "@/types/cart"

// Panel del resumen, pegado a la derecha mientras se baja la lista.
//
// Una regla manda en todo este archivo: **el total que se muestra es el que
// manda el backend** (`cart.total`), nunca uno que yo sume aquí. Un resumen que
// calcula por su cuenta se desincroniza del cobro real en la primera promoción
// o el primer impuesto raro, y entonces el cliente ve un número y le cobran
// otro. Lo único que se calcula localmente es el precio de lista para poder
// tachar, y ese nunca entra al total.
//
// Y por lo mismo el resumen cubre TODO el carrito, no sólo lo que esté marcado:
// al pagar se cobra el carrito completo. Las casillas sirven para quitar o
// guardar en bloque; si quedan cosas sin marcar, aquí se avisa y se ofrece
// quitarlas, en vez de mostrar un total que no es el que se va a cobrar.
export const ResumenCarrito = ({
  cart,
  piezas,
  sinMarcar,
  onQuitarSinMarcar,
  quitando,
}: {
  cart: Cart
  piezas: number
  sinMarcar: number
  onQuitarSinMarcar: () => void
  quitando: boolean
}) => {
  const moneda = cart.currency_code || "mxn"
  const items = cart.items ?? []

  const subtotal = cart.item_subtotal || 0

  // Precio de lista: lo que costarían los mismos productos sin su descuento de
  // catálogo. Si una oferta no trae precio comparativo, cuenta con el suyo, así
  // que este número nunca queda por debajo del subtotal.
  const precioLista = items.reduce((suma, item) => {
    const lista = (item.compare_at_unit_price || 0) * item.quantity
    return suma + Math.max(lista, item.subtotal ?? 0)
  }, 0)

  const descuentoCatalogo = Math.max(precioLista - subtotal, 0)
  const descuentoCupones = cart.discount_total || 0
  const impuestos = cart.tax_total || 0
  const envio = cart.shipping_subtotal || 0
  const ahorro = descuentoCatalogo + descuentoCupones

  const precio = (amount: number) => convertToLocale({ amount, currency_code: moneda })

  const visibles = items.slice(0, 5)
  const sobrantes = items.length - visibles.length

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
        <h2 className="text-[16px] font-bold text-[#1B1B18]">Resumen</h2>

        {items.length > 0 && (
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
        )}

        <dl className="mt-4 flex flex-col gap-2.5 text-[14px]">
          <Fila termino={`Productos (${piezas})`}>
            <span className="flex items-baseline gap-2">
              {descuentoCatalogo > 0 && (
                <span className="text-[13px] text-[#8A8780] line-through">
                  {precio(precioLista)}
                </span>
              )}
              <span className="font-medium text-[#1B1B18]">{precio(subtotal)}</span>
            </span>
          </Fila>

          {descuentoCatalogo > 0 && (
            <Fila termino="Descuento de productos">
              <span className="font-medium text-[#9B3225]">
                −{precio(descuentoCatalogo)}
              </span>
            </Fila>
          )}

          {descuentoCupones > 0 && (
            <Fila termino="Cupón">
              <span className="font-medium text-[#9B3225]">
                −{precio(descuentoCupones)}
              </span>
            </Fila>
          )}

          <Fila termino="Envío">
            {envio > 0 ? (
              <span className="font-medium text-[#1B1B18]">{precio(envio)}</span>
            ) : (
              <span className="text-[13px] text-[#6B6A63]">Se calcula con tu dirección</span>
            )}
          </Fila>

          {impuestos > 0 && (
            <Fila termino="Impuestos">
              <span className="font-medium text-[#1B1B18]">{precio(impuestos)}</span>
            </Fila>
          )}
        </dl>

        <div className="mt-3 flex items-baseline justify-between border-t border-[#EDEAE2] pt-3">
          <span className="text-[14px] font-semibold text-[#1B1B18]">
            {envio > 0 ? "Total" : "Estimación total"}
          </span>
          <span className="text-[24px] font-bold text-[#1B1B18]" data-testid="cart-total">
            {precio(cart.total || 0)}
          </span>
        </div>

        {envio === 0 && (
          <p className="mt-1 text-[12px] text-[#6B6A63]">
            Falta el envío. Lo ves completo antes de pagar, nunca después.
          </p>
        )}

        {ahorro > 0 && (
          <p className="mt-2 rounded-[8px] bg-[#FBEAE6] px-3 py-2 text-[13px] font-semibold text-[#9B3225]">
            Ahorras {precio(ahorro)} en esta compra
          </p>
        )}

        <LocalizedClientLink href="/checkout?step=address" className="mt-4 block">
          <Button
            className="flex w-full items-center justify-center py-3"
            data-testid="cart-checkout-button"
          >
            Ir a pagar ({piezas})
          </Button>
        </LocalizedClientLink>

        {sinMarcar > 0 && (
          <div className="mt-3 rounded-[10px] border border-[#E6D9B8] bg-[#FBF5E9] px-3 py-2.5">
            <p className="text-[13px] leading-relaxed text-[#6B5A2E]">
              {sinMarcar === 1
                ? "Dejaste 1 producto sin marcar, pero el pago cubre todo el carrito."
                : `Dejaste ${sinMarcar} productos sin marcar, pero el pago cubre todo el carrito.`}
            </p>
            <button
              type="button"
              onClick={onQuitarSinMarcar}
              disabled={quitando}
              className="mt-1.5 text-[13px] font-semibold text-[#9B3225] underline disabled:opacity-60"
            >
              {quitando ? "Quitando…" : "Quitar los que no marqué"}
            </button>
          </div>
        )}
      </div>

      <PromoCode cart={cart} />

      <Confianza />
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

// Las tres razones para pagar con tranquilidad. Cada una dice algo que HETNA de
// verdad hace hoy y que está publicado en una página del sitio: si no se puede
// enlazar, no va aquí. Prometer en el carrito lo que no se cumple en la entrega
// es la forma más cara de ganar una venta.
const BLOQUES: { titulo: string; puntos: string[]; href: string; liga: string }[] = [
  {
    titulo: "Entrega y devoluciones",
    puntos: [
      `${EMPRESA.diasDevolucion} días hábiles para devolver un producto físico sin uso.`,
      "Si llegó dañado, incompleto o distinto, el envío de regreso no te cuesta.",
      "Ves el costo y los días de entrega antes de pagar.",
    ],
    href: "/devoluciones",
    liga: "Leer la política",
  },
  {
    titulo: "Pago seguro",
    puntos: [
      "Pagas dentro de HETNA con Mercado Pago.",
      "Los datos de tu tarjeta no pasan por el taller ni se guardan aquí.",
    ],
    href: "/formas-de-pago",
    liga: "Formas de pago",
  },
  {
    titulo: "Tus datos",
    puntos: [
      "Tu dirección se comparte sólo con el taller que te envía.",
      "Puedes pedir que se borren tus datos cuando quieras.",
    ],
    href: "/aviso-de-privacidad",
    liga: "Aviso de privacidad",
  },
]

const Confianza = () => (
  <div className="flex flex-col gap-3">
    {BLOQUES.map((b) => (
      <div key={b.titulo} className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
        <h3 className="text-[14px] font-bold text-[#1B1B18]">{b.titulo}</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {b.puntos.map((p) => (
            <li key={p} className="flex gap-2 text-[13px] leading-relaxed text-[#4A4943]">
              <span className="font-bold text-[#C2560A]">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <LocalizedClientLink
          href={b.href}
          className="mt-2 inline-block text-[13px] font-semibold text-[#B34D07] underline"
        >
          {b.liga}
        </LocalizedClientLink>
      </div>
    ))}
  </div>
)
