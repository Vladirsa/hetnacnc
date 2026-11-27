import { TS } from "@/i18n/TS"
import { isStripe } from "@/lib/constants"
import { paymentInfoMap } from "@/lib/pagos"
import { convertToLocale } from "@/lib/helpers/money"
import { HttpTypes } from "@medusajs/types"
import { Container, Text } from "@medusajs/ui"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const OrderShipping = ({ order }: ShippingDetailsProps) => {
  const payment = order.payment_collections?.[0].payments?.[0]

  return (
    <div className="border rounded-sm p-4">
      <div>
        <Text className="txt-medium-plus text-ui-fg-base mb-1 font-bold">
          <TS>Dirección de envío</TS>
        </Text>
        <Text className="txt-medium text-ui-fg-subtle">
          <TS>{order.shipping_address?.first_name}</TS><TS>{" "}</TS>
          <TS>{order.shipping_address?.last_name}</TS>
        </Text>
        <Text className="txt-medium text-ui-fg-subtle">
          <TS>{order.shipping_address?.address_1}</TS><TS>{" "}</TS>
          <TS>{order.shipping_address?.address_2}</TS>
        </Text>
        <Text className="txt-medium text-ui-fg-subtle">
          <TS>{order.shipping_address?.postal_code}</TS>, <TS>{order.shipping_address?.city}</TS>
        </Text>
        <Text className="txt-medium text-ui-fg-subtle">
          {order.shipping_address?.country_code?.toUpperCase()}
        </Text>
      </div>

      <div className="mt-4" data-testid="shipping-contact-summary">
        <Text className="txt-medium-plus text-ui-fg-base mb-1 font-bold">
          <TS>Contacto</TS>
        </Text>
        <Text className="txt-medium text-ui-fg-subtle">
          <TS>{order.shipping_address?.phone}</TS>
        </Text>
        <Text className="txt-medium text-ui-fg-subtle"><TS>{order.email}</TS></Text>
      </div>

      <div className="mt-4" data-testid="shipping-method-summary">
        <Text className="txt-medium-plus text-ui-fg-base mb-1 font-bold">
          <TS>Método de envío</TS>
        </Text>
        <Text className="txt-medium text-ui-fg-subtle">
          <TS>{(order as any).shipping_methods[0]?.name}</TS> (
          {convertToLocale({
            amount: order.shipping_methods?.[0].total ?? 0,
            currency_code: order.currency_code,
          })
            .replace(/,/g, "")
            .replace(/\./g, ",")}
          )
        </Text>
      </div>
      <div className="mt-4">
        <Text className="txt-medium-plus text-ui-fg-base mb-1 font-bold">
          <TS>Método de pago</TS>
        </Text>
        <div>
          {payment && (
            <div className="flex items-start gap-x-1 w-full">
              <div>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method"
                >
                  <TS>{paymentInfoMap[payment.provider_id].title}</TS>
                </Text>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrderShipping
