import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FacturaPedido } from "@/components/hetna/cuenta/Facturacion"
import { UserNavigation } from "@/components/molecules"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { OrderDetailsSection } from "@/components/sections/OrderDetailsSection/OrderDetailsSection"
import { leerFiscal, misFacturas } from "@/lib/cuenta/facturas"
import { retrieveCustomer } from "@/lib/data/customer"
import { retrieveOrderGroup } from "@/lib/data/orders"

export const metadata: Metadata = {
  title: "Detalle de tu compra | HETNA CNC",
  robots: { index: false, follow: false },
}

const PAGADO = ["authorized", "captured", "partially_captured", "partially_authorized"]

export default async function DetalleCompra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await retrieveCustomer()
  if (!user) return redirect("/login")

  const [orderGroup, facturas, fiscal] = await Promise.all([
    retrieveOrderGroup(id) as Promise<any>,
    misFacturas(),
    leerFiscal(),
  ])
  const pedidos: any[] = orderGroup?.orders || []
  const porPedido = new Map(facturas.map((f) => [f.order_id, f]))

  return (
    <main className="container pb-16">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="flex min-w-0 flex-col gap-5 md:col-span-3">
          <LocalizedClientLink href="/user/orders" className="text-[14px] font-semibold text-[#B34D07] hover:underline">
            ← Todas mis compras
          </LocalizedClientLink>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="m-0 text-[26px] font-extrabold text-[#142033]">Compra #{orderGroup.display_id}</h1>
            <p className="m-0 text-[14px] text-[#6B6A63]">
              {new Date(orderGroup.created_at || Date.now()).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
              {pedidos.length > 1 ? ` · ${pedidos.length} talleres` : ""}
            </p>
          </div>

          {pedidos.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Facturas">
              {pedidos.map((o) => (
                <FacturaPedido
                  key={o.id}
                  orderId={o.id}
                  taller={o.seller?.name || "Taller"}
                  pagado={PAGADO.includes(o.payment_status) && o.status !== "canceled"}
                  factura={porPedido.get(o.id) || null}
                  tieneFiscal={Boolean(fiscal?.fiscal)}
                />
              ))}
            </section>
          )}

          <OrderDetailsSection orderGroup={orderGroup} />
        </div>
      </div>
    </main>
  )
}
