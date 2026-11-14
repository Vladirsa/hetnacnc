"use client"

import { useActionState, useEffect } from "react"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/atoms/Button/Button"
import ErrorMessage from "@/components/molecules/ErrorMessage/ErrorMessage"
import ShippingAddress from "@/components/organisms/ShippingAddress/ShippingAddress"
import { datosCompraDigital, setAddresses } from "@/lib/data/cart"
import compareAddresses from "@/lib/helpers/compare-addresses"
import { HttpTypes } from "@medusajs/types"
import { useToggleState } from "@medusajs/ui"

import { PasoCheckout } from "./PasoCheckout"

export const CartAddressSection = ({
  cart,
  customer,
  soloDigital = false,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  // Sólo archivos o servicios: correo y nombre, sin dirección (tarea 4)
  soloDigital?: boolean
}) => {
  if (soloDigital) return <DatosDigital cart={cart} customer={customer} />
  return <DireccionFisica cart={cart} customer={customer} />
}

// Compra digital en un paso: correo + nombre, y de aquí directo al pago. La
// "Entrega digital" de $0 se elige sola en el servidor (datosCompraDigital).
const DatosDigital = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const listo = Boolean(cart?.email && (cart?.shipping_methods?.length ?? 0) > 0)
  const paso = searchParams.get("step")
  const manual = searchParams.get("manual") === "1"
  const abierto = paso === "address" || (paso === "delivery" && !manual) || (!paso && !listo)
  const [mensaje, accion, guardando] = useActionState(datosCompraDigital, "")

  useEffect(() => {
    if (!paso) router.replace(`${pathname}?step=${listo ? "payment" : "address"}`)
  }, [paso, listo, pathname, router])

  useEffect(() => {
    // Si algún vendedor pide elegir envío a mano, se sigue con el paso de siempre
    if (mensaje === "success") {
      router.replace(`${pathname}?step=payment`)
      router.refresh()
    } else if (mensaje === "manual") {
      router.replace(`${pathname}?step=delivery&manual=1`)
      router.refresh()
    }
  }, [mensaje, pathname, router])

  const nombreActual = [cart?.shipping_address?.first_name, cart?.shipping_address?.last_name].filter(Boolean).join(" ")
    || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")

  return (
    <PasoCheckout
      numero={1}
      titulo="Tus datos"
      listo={(listo || manual) && !abierto}
      onEditar={(listo || manual) && !abierto ? () => router.replace(`${pathname}?step=address`) : undefined}
      testId="checkout-step-address"
    >
      {abierto ? (
        <form action={accion} data-testid="checkout-datos-digital">
          <p className="mb-4 rounded-[8px] bg-[#EEF7F0] px-3 py-2 text-[14px] text-[#17633A]">
            Tu compra es digital: <strong>no pedimos dirección ni hay envío</strong>. Descargas al confirmar el pago y
            también te mandamos los archivos por correo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[14px] font-semibold text-[#1B1B18]">
              Correo
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={cart?.email || customer?.email || ""}
                className="h-11 rounded-[8px] border border-[#D9D5C9] px-3 font-normal"
                data-testid="digital-email-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-[14px] font-semibold text-[#1B1B18]">
              Nombre
              <input
                name="nombre"
                required
                autoComplete="name"
                defaultValue={nombreActual}
                className="h-11 rounded-[8px] border border-[#D9D5C9] px-3 font-normal"
                data-testid="digital-nombre-input"
              />
            </label>
          </div>
          <Button className="mt-5 px-6 py-2.5" disabled={guardando} data-testid="submit-digital-button">
            {guardando ? "Guardando…" : "Continuar al pago"}
          </Button>
          <ErrorMessage
            error={mensaje && mensaje !== "success" && mensaje !== "manual" ? mensaje : null}
            data-testid="address-error-message"
          />
        </form>
      ) : (listo || manual) && cart?.email ? (
        <div className="text-[14px] leading-relaxed text-[#4A4943]">
          <p className="font-semibold text-[#1B1B18]">{nombreActual}</p>
          <p className="text-[#6B6A63]">{cart?.email}</p>
          <p className="mt-1 text-[#17633A]">Entrega digital: descarga inmediata tras el pago y copia por correo.</p>
        </div>
      ) : (
        <p className="text-[14px] text-[#6B6A63]">Cargando…</p>
      )}
    </PasoCheckout>
  )
}

const DireccionFisica = ({
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
