import { useQuery } from "@tanstack/react-query"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { ChartBar } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import type { InferClientOutput } from "@mercurjs/client"

import { client } from "../../lib/client"

export const config: RouteConfig = {
  label: "Métricas",
  icon: ChartBar,
  rank: 5,
}

type Analytics = InferClientOutput<typeof client.vendor.analytics.query>

const formatoMoneda = (monto: number, moneda: string | null) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: (moneda || "mxn").toUpperCase(),
  }).format(monto)

const ESTADO_PAYOUT: Record<string, { texto: string; color: "green" | "orange" | "grey" }> = {
  pending: { texto: "Pendiente", color: "orange" },
  paid: { texto: "Pagado", color: "green" },
  completed: { texto: "Pagado", color: "green" },
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["vendor-analytics"],
    queryFn: () => client.vendor.analytics.query(),
  })

  if (isLoading) {
    return (
      <Container className="p-6">
        <Text size="small">Cargando métricas...</Text>
      </Container>
    )
  }

  if (!data) {
    return (
      <Container className="p-6">
        <Text size="small" className="text-ui-fg-subtle">
          No se pudieron cargar tus métricas. Intenta de nuevo más tarde.
        </Text>
      </Container>
    )
  }

  const { moneda, pedidos, productos_top, payouts } = data

  return (
    <div className="flex flex-col gap-4">
      <Container className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Pedidos (últimos {pedidos.ventana_dias} días)
          </Text>
          <Heading level="h1">{pedidos.total_pedidos}</Heading>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Ingresos (últimos {pedidos.ventana_dias} días)
          </Text>
          <Heading level="h1">{formatoMoneda(pedidos.ingresos_totales, moneda)}</Heading>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Payouts pendientes
          </Text>
          <Heading level="h1">{formatoMoneda(payouts.pendientes.monto, moneda)}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {payouts.pendientes.cantidad} payout{payouts.pendientes.cantidad === 1 ? "" : "s"}
          </Text>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Productos más vendidos</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Por unidades vendidas en los últimos {pedidos.ventana_dias} días.
          </Text>
        </div>
        <div className="px-6 py-4">
          {productos_top.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Todavía no tienes ventas en este periodo.
            </Text>
          )}
          <div className="flex flex-col gap-2">
            {productos_top.map((p) => (
              <div key={p.producto_id} className="flex items-center justify-between rounded-md border px-4 py-3">
                <Text weight="plus">{p.titulo}</Text>
                <div className="flex items-center gap-4">
                  <Text size="small" className="text-ui-fg-subtle">
                    {p.cantidad} unidad{p.cantidad === 1 ? "" : "es"}
                  </Text>
                  <Text size="small">{formatoMoneda(p.ingresos, moneda)}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Payouts</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Pendientes: {formatoMoneda(payouts.pendientes.monto, moneda)} · Pagados:{" "}
            {formatoMoneda(payouts.pagados.monto, moneda)}
          </Text>
        </div>
        <div className="px-6 py-4">
          {payouts.recientes.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Todavía no tienes payouts.
            </Text>
          )}
          <div className="flex flex-col gap-2">
            {payouts.recientes.map((p) => {
              const estado = ESTADO_PAYOUT[p.estado] || { texto: p.estado, color: "grey" as const }
              return (
                <div key={p.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                  <Text weight="plus">#{p.display_id}</Text>
                  <div className="flex items-center gap-4">
                    <Text size="small" className="text-ui-fg-subtle">
                      {new Date(p.creado).toLocaleDateString("es-MX")}
                    </Text>
                    <Text size="small">{formatoMoneda(p.monto, p.moneda)}</Text>
                    <Badge color={estado.color}>{estado.texto}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Container>
    </div>
  )
}
