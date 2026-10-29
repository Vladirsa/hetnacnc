import { Card } from "@/components/atoms"
import { getAuthHeaders } from "@/lib/data/cookies"

// Seguimiento del pedido en Mis pedidos: número de guía, paquetería y liga de
// rastreo. Se pide aparte (/store/hetna-rastreo) porque la lista de pedidos no
// trae los envíos, y así una falla aquí no tumba la página del pedido.
type Envio = { guia: string; url: string | null; paqueteria: string | null; estado: string | null; entregado: boolean }

const ESTADO: Record<string, string> = {
  created: "Guía creada",
  picked_up: "Recolectado por la paquetería",
  in_transit: "En camino",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  failed_attempt: "Intento de entrega fallido",
  exception: "Incidencia con la paquetería",
  returned_to_sender: "Devuelto al taller",
}

async function enviosDelPedido(orderId: string): Promise<Envio[]> {
  try {
    const r = await fetch(`${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/hetna-rastreo/${orderId}`, {
      headers: {
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        ...((await getAuthHeaders()) as Record<string, string>),
      },
      cache: "no-store",
    })
    if (!r.ok) return []
    return ((await r.json()) as { envios?: Envio[] }).envios ?? []
  } catch {
    return []
  }
}

export const OrderTrack = async ({ order }: { order: any }) => {
  const envios = await enviosDelPedido(order.id)
  if (!envios.length) return null

  return (
    <div>
      <h2 className="text-primary label-lg uppercase">Seguimiento del pedido</h2>
      <ul className="mt-4 flex flex-col gap-2">
        {envios.map((e) => {
          const contenido = (
            <Card className="px-4 hover:bg-secondary/30">
              {e.paqueteria && <span className="font-semibold">{e.paqueteria} · </span>}
              <span className="text-secondary">Guía </span>
              <span className="font-semibold">{e.guia}</span>
              {(e.estado || e.entregado) && (
                <span className="ml-2 text-secondary">
                  — {e.entregado ? "Entregado" : ESTADO[e.estado as string] || e.estado}
                </span>
              )}
              {e.url && <span className="ml-2 text-[#B34D07] underline">Rastrear →</span>}
            </Card>
          )
          return (
            <li key={e.guia}>
              {e.url ? (
                <a href={e.url} target="_blank" rel="noopener noreferrer">
                  {contenido}
                </a>
              ) : (
                contenido
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
