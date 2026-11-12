import { OrderConfirmedSection } from "@/components/sections/OrderConfirmedSection/OrderConfirmedSection"
import { ActivarAvisos } from "@/components/hetna/push/ActivarAvisos"
import { WhatsappCuenta } from "@/components/hetna/cuenta/WhatsappCuenta"
import { retrieveCustomer } from "@/lib/data/customer"
import { retrieveOrder } from "@/lib/data/orders"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: "Tu compra se realizó con éxito",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const [order, cliente] = await Promise.all([
    retrieveOrder(params.id).catch(() => null),
    retrieveCustomer().catch(() => null),
  ])

  if (!order) {
    return notFound()
  }

  return (
    <main className="container">
      {/* Justo después de comprar es cuando más sentido tiene: "avísame cuando vaya en camino" */}
      {cliente && (
        <div className="mx-auto mt-6 max-w-[760px]">
          <ActivarAvisos compacto />
          {/* Y por WhatsApp: "tu pedido va en camino" llega donde sí lo ven */}
          <div className="mt-3">
            <WhatsappCuenta telefono={(order as any).shipping_address?.phone || cliente.phone} />
          </div>
        </div>
      )}
      <OrderConfirmedSection order={order} />
    </main>
  )
}
