// HETNA Panel → Pedidos: los últimos pedidos de la tienda con su estado.
import { Etiqueta, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, fechaCorta, pesos } from "@/lib/panel/sesion"

type Orden = { id: string; display_id: number; status: string; payment_status: string; fulfillment_status: string; total: number; currency_code: string; created_at: string; email?: string; customer?: { first_name?: string; last_name?: string } | null; items?: { title: string; quantity: number }[] }

const PAGO: Record<string, [string, "verde" | "ambar" | "rojo" | "gris"]> = { captured: ["Pagado", "verde"], authorized: ["Autorizado", "azul" as any], awaiting: ["Sin pagar", "ambar"], not_paid: ["Sin pagar", "ambar"], refunded: ["Reembolsado", "gris"], partially_refunded: ["Reembolso parcial", "gris"], canceled: ["Cancelado", "rojo"] }
const ENVIO: Record<string, [string, "verde" | "ambar" | "azul" | "gris"]> = { not_fulfilled: ["Por surtir", "ambar"], partially_fulfilled: ["Parcial", "ambar"], fulfilled: ["Surtido", "azul"], shipped: ["Enviado", "azul"], partially_shipped: ["Envío parcial", "azul"], delivered: ["Entregado", "verde"], canceled: ["Cancelado", "gris"] }

export default async function PanelPedidos({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "pedidos")
  let ordenes: Orden[] = [], error = ""
  try {
    const r = await adminFetch<{ orders: Orden[] }>("/admin/orders?limit=30&order=-created_at&fields=id,display_id,status,payment_status,fulfillment_status,total,currency_code,created_at,email,*customer,*items")
    ordenes = r.orders || []
  } catch (e) { error = (e as Error).message }
  const ADMIN = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "") + "/dashboard"
  return (
    <Tarjeta>
      <Titulo extra={<a className="text-[12px] font-semibold text-[#C2560A]" href={`${ADMIN}/orders`} target="_blank" rel="noreferrer">Todos en el dashboard →</a>}>Últimos pedidos</Titulo>
      {error && <Vacio>No pude leer los pedidos: {error}</Vacio>}
      {!error && ordenes.length === 0 && <Vacio>Todavía no hay pedidos.</Vacio>}
      <ul className="divide-y divide-[#EFEDE6]">
        {ordenes.map((o) => {
          const p = PAGO[o.payment_status] || [o.payment_status, "gris"]
          const f = ENVIO[o.fulfillment_status] || [o.fulfillment_status, "gris"]
          const cliente = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") || o.email || ""
          return (
            <li key={o.id} className="py-3">
              <a href={`${ADMIN}/orders/${o.id}`} target="_blank" rel="noreferrer" className="block">
                <div className="flex items-baseline justify-between">
                  <p className="text-[14px] font-extrabold text-[#142033]">#{o.display_id} <span className="font-semibold text-[#6B675C]">· {cliente}</span></p>
                  <p className="text-[14px] font-black">{pesos(o.total, (o.currency_code || "mxn").toUpperCase())}</p>
                </div>
                <p className="mt-0.5 text-[12px] text-[#6B675C]">{fechaCorta(o.created_at)}{o.items?.length ? ` · ${o.items.slice(0, 2).map((i) => `${i.quantity}× ${i.title}`).join(", ")}${o.items.length > 2 ? "…" : ""}` : ""}</p>
                <div className="mt-1.5 flex gap-1.5"><Etiqueta color={p[1] as any}>{p[0]}</Etiqueta><Etiqueta color={f[1]}>{f[0]}</Etiqueta></div>
              </a>
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}
