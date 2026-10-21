"use client"

import ErrorMessage from "@/components/molecules/ErrorMessage/ErrorMessage"
import { isManual, isMercadoPago, isPaypal, isStripe } from "../../../lib/constants"
import { placeOrder } from "@/lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import React, { useEffect, useState } from "react"
import { Button } from "@/components/atoms"
import { orderErrorFormatter } from "@/lib/helpers/order-error-formatter"
import { toast } from "@/lib/helpers/toast"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isMercadoPago(paymentSession?.provider_id):
      return (
        <MercadoPagoPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isPaypal(paymentSession?.provider_id):
      return (
        <PayPalPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isStripe(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    default:
      return (
        <Button disabled className="w-full py-3.5 text-[16px] font-bold shadow-sm">
          Selecciona un método de pago
        </Button>
      )
  }
}

// Manda al cliente a la página segura de Mercado Pago. Al terminar, Mercado Pago
// lo regresa a /checkout/mercadopago, donde se crea el pedido.
const MercadoPagoPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => isMercadoPago(s.provider_id) && s.status === "pending"
  )
  const checkoutUrl = (session?.data as Record<string, unknown> | undefined)
    ?.checkout_url as string | undefined

  const handlePayment = () => {
    if (!checkoutUrl) {
      setErrorMessage(
        "No se pudo preparar el pago. Regresa al paso de Pago y pulsa «Continuar a revisión» otra vez."
      )
      return
    }
    setSubmitting(true)
    window.location.href = checkoutUrl
  }

  return (
    <>
      <Button
        disabled={notReady}
        onClick={handlePayment}
        loading={submitting}
        className="w-full py-3.5 text-[16px] font-bold shadow-sm"
        data-testid={dataTestId}
      >
        Pagar con Mercado Pago
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="mercadopago-payment-error-message"
      />
    </>
  )
}

// Manda al cliente a la página segura de PayPal. Al terminar, PayPal
// lo regresa a /checkout/paypal, donde se cobra y se crea el pedido.
const PayPalPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => isPaypal(s.provider_id) && s.status === "pending"
  )
  const checkoutUrl = (session?.data as Record<string, unknown> | undefined)
    ?.checkout_url as string | undefined

  const handlePayment = () => {
    if (!checkoutUrl) {
      setErrorMessage(
        "No se pudo preparar el pago. Regresa al paso de Pago y pulsa «Continuar a revisión» otra vez."
      )
      return
    }
    setSubmitting(true)
    window.location.href = checkoutUrl
  }

  return (
    <>
      <Button
        disabled={notReady}
        onClick={handlePayment}
        loading={submitting}
        className="w-full py-3.5 text-[16px] font-bold shadow-sm"
        data-testid={dataTestId}
      >
        Pagar con PayPal
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="paypal-payment-error-message"
      />
    </>
  )
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(true)

  const onPaymentCompleted = async () => {
    try {
      const res = await placeOrder()
      if (!res.ok) {
        setErrorMessage(res.error?.message)
      }
    } catch (error: any) {
      if (error?.message !== "NEXT_REDIRECT") {
        setErrorMessage(
          error?.message?.replace("Error setting up the request: ", "")
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  useEffect(() => {
    //@ts-ignore
    setDisabled(!card?._complete)
  }, [card, stripe, elements, cart])

  const handlePayment = async () => {
    setSubmitting(true)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
          }

          setErrorMessage(error.message || null)
          return
        }

        if (
          (paymentIntent && paymentIntent.status === "requires_capture") ||
          paymentIntent.status === "succeeded"
        ) {
          return onPaymentCompleted()
        }

        return
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        loading={submitting}
        className="w-full py-3.5 text-[16px] font-bold shadow-sm"
      >
        Realizar pedido
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    try {
      const res = await placeOrder()
      if (!res.ok) {
        setErrorMessage(res.error?.message)
      }
    } catch (error: any) {
      if (error?.message !== "NEXT_REDIRECT") {
        setErrorMessage(
          error?.message?.replace("Error setting up the request: ", "")
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayment = () => {
    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        onClick={handlePayment}
        className="w-full py-3.5 text-[16px] font-bold shadow-sm"
        loading={submitting}
      >
        Realizar pedido
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
