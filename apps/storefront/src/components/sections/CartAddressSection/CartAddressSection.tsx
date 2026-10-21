"use client"

import { useActionState, useEffect } from "react"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/atoms"
import ErrorMessage from "@/components/molecules/ErrorMessage/ErrorMessage"
import ShippingAddress from "@/components/organisms/ShippingAddress/ShippingAddress"
import { setAddresses } from "@/lib/data/cart"
import compareAddresses from "@/lib/helpers/compare-addresses"
import { HttpTypes } from "@medusajs/types"
import { useToggleState } from "@medusajs/ui"

import { PasoCheckout } from "./PasoCheckout"

export const CartAddressSection = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const direccion = cart?.shipping_address
  const hayDireccion = Boolean(
    direccion?.first_name &&
      direccion?.last_name &&
      direccion?.address_1 &&
      direccion?.city &&
      direccion?.postal_code &&
      direccion?.country_code
  )

  const paso = searchParams.get("step")
  const abierto = paso === "address" || (!paso && !hayDireccion)

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart.shipping_address, cart.billing_address)
      : true
  )

  const [message, formAction] = useActionState(setAddresses, sameAsBilling)

  // Al entrar sin paso, la pasarela decide dónde pararse: si la dirección ya
  // está guardada no hay nada que capturar otra vez, así que arranca en el
  // envío, que es lo que de verdad falta. Antes se entraba siempre al
  // formulario de dirección y había que volver a guardar lo mismo.
  useEffect(() => {
    if (!paso) {
      router.replace(`${pathname}?step=${hayDireccion ? "delivery" : "address"}`)
    }
  }, [paso, hayDireccion, pathname, router])

  return (
    <PasoCheckout
      numero={1}
      titulo="Dirección de entrega"
      listo={hayDireccion && !abierto}
      onEditar={
        hayDireccion && !abierto
          ? () => router.replace(`${pathname}?step=address`)
          : undefined
      }
      testId="checkout-step-address"
    >
      {abierto ? (
        <form
          action={async (data) => {
            await formAction(data)
            router.replace(`${pathname}?step=delivery`)
            router.refresh()
          }}
        >
          <ShippingAddress
            customer={customer}
            checked={sameAsBilling}
            onChange={toggleSameAsBilling}
            cart={cart}
          />
          <Button
            className="mt-5 px-6 py-2.5"
            data-testid="submit-address-button"
          >
            {hayDireccion ? "Guardar y continuar" : "Continuar al envío"}
          </Button>
          <ErrorMessage
            error={message !== "success" && message}
            data-testid="address-error-message"
          />
        </form>
      ) : hayDireccion ? (
        <div className="text-[14px] leading-relaxed text-[#4A4943]">
          <p className="font-semibold text-[#1B1B18]">
            {direccion!.first_name} {direccion!.last_name}
            {direccion!.phone ? ` · ${direccion!.phone}` : ""}
          </p>
          <p>
            {direccion!.address_1}
            {direccion!.address_2 ? `, ${direccion!.address_2}` : ""}, {direccion!.postal_code}{" "}
            {direccion!.city}, {direccion!.province || ""}{" "}
            {direccion!.country_code?.toUpperCase()}
          </p>
          {cart?.email && <p className="text-[#6B6A63]">{cart.email}</p>}
        </div>
      ) : (
        <p className="text-[14px] text-[#6B6A63]">Cargando tu dirección…</p>
      )}
    </PasoCheckout>
  )
}
