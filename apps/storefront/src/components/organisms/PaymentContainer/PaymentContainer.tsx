import { Radio, Radio as RadioGroupOption } from "@headlessui/react"
import { Text, clx } from "@medusajs/ui"
import React, { useContext, useMemo, type JSX } from "react"

import { LogoAmex, LogoMastercard, LogoVisa } from "@/components/hetna/LogosPago"

import { isManual } from "../../../lib/constants"
import SkeletonCardDetails from "./SkeletonCardDetails"
import { CardElement } from "@stripe/react-stripe-js"
import { StripeCardElementOptions } from "@stripe/stripe-js"
import PaymentTest from "./PaymentTest"
import { StripeContext } from "./StripeWrapper"

type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  paymentInfoMap: Record<
    string,
    { title: string; descripcion?: string; icon: JSX.Element }
  >
  children?: React.ReactNode
}

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  children,
}) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const info = paymentInfoMap[paymentProviderId]
  const elegido = selectedPaymentOptionId === paymentProviderId
  // Medios por los que pasa una tarjeta: ahí sí se enseñan las marcas.
  const aceptaTarjetas =
    paymentProviderId.includes("mercadopago") || paymentProviderId.includes("stripe")

  return (
    <RadioGroupOption
      key={paymentProviderId}
      value={paymentProviderId}
      disabled={disabled}
      className={clx(
        "mb-2 flex cursor-pointer flex-col gap-y-2 rounded-[12px] border px-4 py-3.5 transition-colors",
        elegido
          ? "border-[#C2560A] bg-[#FFF8F3]"
          : "border-[#E7E4DC] bg-white hover:border-[#C2560A]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-x-3">
          <Radio value={elegido} />
          <div className="min-w-0">
            <Text className="text-[14px] font-semibold text-[#1B1B18]">
              {info?.title || paymentProviderId}
            </Text>
            {info?.descripcion && (
              <Text className="text-[12px] leading-snug text-[#6B6A63]">
                {info.descripcion}
              </Text>
            )}
          </div>
          {isManual(paymentProviderId) && isDevelopment && (
            <PaymentTest className="small:block hidden" />
          )}
        </div>
        <span className="shrink-0 justify-self-end">{info?.icon}</span>
      </div>

      {/* Las marcas que de verdad se pueden pasar por ese medio. Es la
          diferencia entre "Mercado Pago" a secas y saber que ahí entra tu
          tarjeta. */}
      {aceptaTarjetas && (
        <div className="flex items-center gap-1.5 pl-8">
          <LogoVisa />
          <LogoMastercard />
          <LogoAmex />
        </div>
      )}

      {isManual(paymentProviderId) && isDevelopment && (
        <PaymentTest className="small:hidden text-[10px]" />
      )}
      {children}
    </RadioGroupOption>
  )
}

export default PaymentContainer

export const StripeCardContainer = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  setCardBrand,
  setError,
  setCardComplete,
}: Omit<PaymentContainerProps, "children"> & {
  setCardBrand: (brand: string) => void
  setError: (error: string | null) => void
  setCardComplete: (complete: boolean) => void
}) => {
  const stripeReady = useContext(StripeContext)

  const useOptions: StripeCardElementOptions = useMemo(() => {
    return {
      style: {
        base: {
          fontFamily: "Inter, sans-serif",
          color: "#424270",
          "::placeholder": {
            color: "rgb(107 114 128)",
          },
        },
      },
      classes: {
        base: "pt-3 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-ui-border-base hover:bg-ui-bg-field-hover transition-all duration-300 ease-in-out",
      },
    }
  }, [])

  return (
    <PaymentContainer
      paymentProviderId={paymentProviderId}
      selectedPaymentOptionId={selectedPaymentOptionId}
      paymentInfoMap={paymentInfoMap}
      disabled={disabled}
    >
      {selectedPaymentOptionId === paymentProviderId &&
        (stripeReady ? (
          <div className="my-4 transition-all duration-150 ease-in-out">
            <Text className="txt-medium-plus text-ui-fg-base mb-1">
              Enter your card details:
            </Text>
            <CardElement
              options={useOptions as StripeCardElementOptions}
              onChange={(e) => {
                setCardBrand(
                  e.brand && e.brand.charAt(0).toUpperCase() + e.brand.slice(1)
                )
                setError(e.error?.message || null)
                setCardComplete(e.complete)
              }}
            />
          </div>
        ) : (
          <SkeletonCardDetails />
        ))}
    </PaymentContainer>
  )
}
