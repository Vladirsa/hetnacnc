import { TS } from "@/i18n/TS"
import { Avatar } from "@/components/atoms/Avatar/Avatar"
import { Chat } from "../Chat/Chat"
import { retrieveCustomer } from "@/lib/data/customer"
import { OrderParcelItems } from "@/components/molecules/OrderParcelItems/OrderParcelItems"
import { OrderParcelStatus } from "@/components/molecules/OrderParcelStatus/OrderParcelStatus"
import { OrderParcelActions } from "@/components/molecules/OrderParcelActions/OrderParcelActions"

export const OrderParcels = async ({ orders }: { orders: any[] }) => {
  const user = await retrieveCustomer()

  return (
    <>
      {orders.map((order) => (
        <div key={order.id} className="w-full mb-8">
          <div className="border rounded-sm p-4 bg-component-secondary font-semibold text-secondary uppercase">
            <TS>Order #</TS><TS>{order.display_id}</TS>
          </div>
          <div className="border rounded-sm">
            <div className="p-4 border-b">
              <OrderParcelStatus order={order} />
            </div>
            <div className="p-4 border-b md:flex items-center justify-between">
              <div className="flex items-center gap-4 mb-4 md:mb-0">
                <Avatar src={order.seller?.logo || undefined} />
                <p className="text-primary"><TS>{order.seller?.name}</TS></p>
              </div>
              <Chat
                user={user}
                seller={order.seller}
                order_id={order.id}
                buttonClassNames="label-md text-action-on-secondary uppercase flex items-center gap-2"
              />
            </div>
            <div className="p-4 border-b">
              <OrderParcelItems
                items={order.items}
                currency_code={order.currency_code}
              />
            </div>
            <div className="p-4">
              <OrderParcelActions order={order} />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
