import OrderDetails from "@/components/organisms/OrderDefails/OrderDetails"
import OrderShipping from "@/components/organisms/OrderDefails/OrderShipping"
import OrderTotals from "@/components/organisms/OrderDefails/OrderTotals"
import OrderItems from "@/components/organisms/OrderItems/OrderItems"
import { TrackEvent } from "@/components/analytics/TrackEvent"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"

export const OrderConfirmedSection = ({
  order,
}: {
  order: HttpTypes.StoreOrder
}) => {
  return (
    <div className="py-6">
      <TrackEvent
        event="purchase"
        orderId={order.id}
        currency={order.currency_code}
        value={order.total ?? 0}
        cliente={{ email: order.email, telefono: order.shipping_address?.phone }}
        items={(order.items ?? []).map((item) => ({
          item_id: item.product_id ?? item.id,
          item_name: item.product_title ?? item.title ?? "",
          price: item.unit_price ?? 0,
          quantity: item.quantity,
        }))}
      />
      <div className="content-container flex flex-col justify-center items-center gap-y-10 max-w-4xl h-full w-full mx-auto">
        <div
          className="flex flex-col gap-4 max-w-4xl h-full bg-white w-full py-10"
          data-testid="order-complete-container"
        >
          <div className="text-center w-full">
            <Heading
              level="h1"
              className="flex flex-col gap-y-3 text-ui-fg-base text-3xl mb-4"
            >
              <span>¡Gracias!</span>
              <span>Tu pedido se realizó con éxito.</span>
            </Heading>

            <Text>
              Te enviamos los detalles de tu pedido a{" "}
              <span
                className="text-ui-fg-medium-plus font-semibold"
                data-testid="order-email"
              >
                {order.email}
              </span>
              .
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
