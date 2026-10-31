import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

// Lo que el taller tiene que atender HOY y cómo lo ve el cliente:
//
//   - Pedidos por enviar: pagados y sin guía enviada, del más viejo al más
//     nuevo. Pasadas las 48 h se marcan como tarde (es el mismo corte con el
//     que el Centro de control le avisa al dueño de HETNA).
//   - Existencias: productos agotados, con pocas piezas, o que al ritmo de
//     venta de los últimos 30 días se acaban en menos de dos semanas.
//   - Reputación (últimos 60 días): cancelaciones, devoluciones, reclamos y
//     qué tan rápido envía. Es lo que hace que un cliente vuelva o no, y lo que
//     HETNA revisa para cuidar la marca.
//
// Cada pieza falla sola: si una consulta truena, esa sección sale vacía y el
// resto del tablero se sigue viendo.

const DIA = 86_400_000
const HORA = 3_600_000
const HORAS_TARDE = () => Number(process.env.CONTROL_HORAS_SIN_ENVIAR ?? 48)
const STOCK_BAJO = 3
const DIAS_REPUTACION = 60
const DIAS_RITMO = 30

export type PedidoPorEnviar = {
  order_id: string
  display_id: number | null
  creado: string
  horas: number
  tarde: boolean
  total: number
  piezas: string
}

export type AlertaStock = {
  producto_id: string
  titulo: string
  disponibles: number
  dias_restantes: number | null
  nivel: "agotado" | "bajo" | "se_acaba"
}

export type Reputacion = {
  dias: number
  pedidos: number
  enviados: number
  cancelados: number
  devoluciones: number
  reclamos: number
  envio_promedio_horas: number | null
  enviados_tarde: number
  // Porcentaje de pedidos sin problema (ni cancelado, ni devuelto, ni reclamado)
  pedidos_sin_problema: number | null
  semaforo: "verde" | "ambar" | "rojo" | "sin_datos"
  consejos: string[]
}

export type SaludTaller = {
  // Ventas de los 30 días ANTERIORES a la ventana del tablero (de hace 60 a
  // hace 30 días), contadas igual que ventasDelTaller, para comparar.
  previos: { ingresos: number; pedidos: number }
  por_enviar: PedidoPorEnviar[]
  stock: AlertaStock[]
  reputacion: Reputacion
}

type Orden = {
  id: string
  display_id?: number
  status?: string
  total?: number
  created_at: string
  payment_collections?: { status?: string }[]
  fulfillments?: { shipped_at?: string | null; canceled_at?: string | null }[]
  items?: { title?: string | null; quantity?: number; product_id?: string | null }[]
}

const pagada = (o: Orden) =>
  (o.payment_collections || []).some((pc) =>
    ["completed", "partially_captured", "authorized"].includes(String(pc?.status))
  )

const primerEnvio = (o: Orden): number | null => {
  const fechas = (o.fulfillments || [])
    .filter((f) => f?.shipped_at && !f?.canceled_at)
    .map((f) => new Date(String(f.shipped_at)).getTime())
    .filter(Number.isFinite)
  return fechas.length ? Math.min(...fechas) : null
}

async function seguro<T>(etiqueta: string, fn: () => Promise<T>, vacio: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.error(`[tablero] ${etiqueta}:`, e instanceof Error ? e.message : e)
    return vacio
  }
}

export async function saludDelTaller(container: MedusaContainer, sellerId: string): Promise<SaludTaller> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ahora = Date.now()
  const desdeRep = ahora - DIAS_REPUTACION * DIA

  const orderIds = await seguro(
    "pedidos del taller",
    async () => {
      const { data } = await query.graph({
        entity: "order_seller",
        fields: ["order_id"],
        filters: { seller_id: sellerId },
      })
      return (data || []).map((o: { order_id: string }) => o.order_id)
    },
    [] as string[]
  )

  // Una sola consulta de pedidos para las tres secciones. 90 días cubre la
  // reputación (60) y deja ver pedidos viejos que se quedaron sin enviar.
  const ordenes: Orden[] = orderIds.length
    ? await seguro(
        "pedidos",
        async () =>
          ((
            await query.graph({
              entity: "order",
              fields: [
                "id",
                "display_id",
                "status",
                "total",
                "created_at",
                "payment_collections.status",
                "fulfillments.shipped_at",
                "fulfillments.canceled_at",
                "items.title",
                "items.quantity",
                "items.product_id",
              ],
              filters: { id: orderIds, created_at: { $gte: new Date(ahora - 90 * DIA).toISOString() } },
            })
          ).data || []) as unknown as Orden[],
        [] as Orden[]
      )
    : []

  // ---- Pedidos por enviar ----------------------------------------------------
  const limite = HORAS_TARDE()
  const por_enviar: PedidoPorEnviar[] = ordenes
    .filter((o) => o.status !== "canceled" && pagada(o) && primerEnvio(o) === null)
    .map((o) => {
      const horas = Math.floor((ahora - new Date(o.created_at).getTime()) / HORA)
      return {
        order_id: o.id,
        display_id: o.display_id ?? null,
        creado: o.created_at,
        horas,
        tarde: horas >= limite,
        total: Number(o.total) || 0,
        piezas: (o.items || [])
          .map((i) => `${i.quantity || 1} × ${i.title || "pieza"}`)
          .slice(0, 3)
          .join(", "),
      }
    })
    .sort((a, b) => b.horas - a.horas)

  // ---- Existencias -----------------------------------------------------------
  // Ritmo de venta por producto en los últimos 30 días
  const vendidas = new Map<string, number>()
  for (const o of ordenes) {
    if (o.status === "canceled" || new Date(o.created_at).getTime() < ahora - DIAS_RITMO * DIA) continue
    for (const i of o.items || []) {
      if (!i.product_id) continue
      vendidas.set(i.product_id, (vendidas.get(i.product_id) || 0) + (Number(i.quantity) || 0))
    }
  }

  const stock = await seguro(
    "existencias",
    async () => {
      const { data } = await query.graph({
        entity: "offer",
        fields: [
          "id",
          "product.id",
          "product.title",
          "product.status",
          "inventory_item_link.required_quantity",
          "inventory_item_link.inventory_item.location_levels.stocked_quantity",
          "inventory_item_link.inventory_item.location_levels.reserved_quantity",
        ],
        filters: { seller_id: sellerId },
      })

      const alertas: AlertaStock[] = []
      for (const oferta of (data || []) as unknown as {
        product?: { id?: string; title?: string; status?: string }
        inventory_item_link?: {
          required_quantity?: number
          inventory_item?: { location_levels?: { stocked_quantity?: number; reserved_quantity?: number }[] }
        }[]
      }[]) {
        const productoId = oferta.product?.id
        const enlaces = oferta.inventory_item_link || []
        // Sin inventario ligado = el taller no lleva existencias (fabrica bajo
        // pedido). No hay nada que avisar.
        if (!productoId || !enlaces.length || oferta.product?.status === "draft") continue

        // Piezas que se pueden vender = la del artículo más escaso, dividida
        // entre lo que se ocupa de él por pieza.
        let disponibles = Infinity
        for (const e of enlaces) {
          const niveles = e.inventory_item?.location_levels || []
          const libres = niveles.reduce(
            (s, n) => s + (Number(n.stocked_quantity) || 0) - (Number(n.reserved_quantity) || 0),
            0
          )
          disponibles = Math.min(disponibles, Math.floor(libres / Math.max(1, Number(e.required_quantity) || 1)))
        }
        if (!Number.isFinite(disponibles)) continue
        disponibles = Math.max(0, disponibles)

        const ritmo = (vendidas.get(productoId) || 0) / DIAS_RITMO
        const dias_restantes = ritmo > 0 ? Math.floor(disponibles / ritmo) : null

        let nivel: AlertaStock["nivel"] | null = null
        if (disponibles <= 0) nivel = "agotado"
        else if (dias_restantes !== null && dias_restantes < 14) nivel = "se_acaba"
        else if (disponibles <= STOCK_BAJO) nivel = "bajo"
        if (!nivel) continue

        alertas.push({ producto_id: productoId, titulo: oferta.product?.title || "Sin nombre", disponibles, dias_restantes, nivel })
      }

      const orden = { agotado: 0, se_acaba: 1, bajo: 2 }
      return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.disponibles - b.disponibles).slice(0, 15)
    },
    [] as AlertaStock[]
  )

  // ---- Reputación ------------------------------------------------------------
  const recientes = ordenes.filter((o) => new Date(o.created_at).getTime() >= desdeRep)
  const idsRecientes = recientes.map((o) => o.id)

  const [devueltos, reclamados] = await Promise.all([
    idsRecientes.length
      ? seguro(
          "devoluciones",
          async () => {
            const { data } = await query.graph({
              entity: "return",
              fields: ["order_id", "status"],
              filters: { order_id: idsRecientes },
            })
            return new Set(
              (data || [])
                .filter((r) => r.status !== "canceled")
                .map((r) => String(r.order_id))
            )
          },
          new Set<string>()
        )
      : Promise.resolve(new Set<string>()),
    idsRecientes.length
      ? seguro(
          "reclamos",
          async () => {
            const { data } = await query.graph({
              entity: "order_claim",
              fields: ["order_id", "canceled_at"],
              filters: { order_id: idsRecientes },
            })
            return new Set(
              (data || [])
                .filter((c) => !c.canceled_at)
                .map((c) => String(c.order_id))
            )
          },
          new Set<string>()
        )
      : Promise.resolve(new Set<string>()),
  ])

  let cancelados = 0
  let enviados = 0
  let enviadosTarde = 0
  let sumaHoras = 0
  let conProblema = 0
  let contables = 0

  for (const o of recientes) {
    const cancelado = o.status === "canceled"
    // Un pedido cancelado sin pagar es un carrito abandonado, no una falla del taller
    if (cancelado && !pagada(o)) continue
    contables += 1
    if (cancelado) cancelados += 1
    if (cancelado || devueltos.has(o.id) || reclamados.has(o.id)) conProblema += 1

    const envio = primerEnvio(o)
    if (envio !== null) {
      enviados += 1
      const h = (envio - new Date(o.created_at).getTime()) / HORA
      sumaHoras += Math.max(0, h)
      if (h > limite) enviadosTarde += 1
    }
  }

  const envio_promedio_horas = enviados ? Math.round(sumaHoras / enviados) : null
  const pedidos_sin_problema = contables ? (contables - conProblema) / contables : null
  const tardeAhora = por_enviar.filter((p) => p.tarde).length

  let semaforo: Reputacion["semaforo"] = "sin_datos"
  if (contables > 0) {
    const problemas = 1 - (pedidos_sin_problema ?? 1)
    const tardeRatio = enviados ? enviadosTarde / enviados : 0
    if (problemas > 0.1 || tardeRatio > 0.3 || tardeAhora >= 3) semaforo = "rojo"
    else if (problemas > 0.04 || tardeRatio > 0.1 || tardeAhora > 0) semaforo = "ambar"
    else semaforo = "verde"
  }

  const consejos: string[] = []
  if (tardeAhora > 0)
    consejos.push(
      `Tienes ${tardeAhora} pedido${tardeAhora === 1 ? "" : "s"} con más de ${limite} h sin enviar. Es lo primero que baja tu calificación.`
    )
  if (cancelados > 0)
    consejos.push("Cada cancelación de un pedido pagado le cuesta un cliente. Mantén tus existencias al día para no vender lo que no tienes.")
  if (devueltos.size > 0)
    consejos.push("Revisa el motivo de tus devoluciones en cada pedido: casi siempre es una foto o una medida que no coincide con la ficha.")
  if (reclamados.size > 0)
    consejos.push("Tienes reclamos abiertos. Contestarlos rápido evita que se vuelvan una reseña mala.")
  if (envio_promedio_horas !== null && envio_promedio_horas > 24 && tardeAhora === 0)
    consejos.push("Enviar en menos de 24 h es lo que más reseñas de 5 estrellas trae.")

  // Mismo corte que ventasDelTaller (setDate sobre la hora local del servidor)
  const finPrevio = new Date()
  finPrevio.setDate(finPrevio.getDate() - DIAS_RITMO)
  const inicioPrevio = new Date(finPrevio)
  inicioPrevio.setDate(inicioPrevio.getDate() - DIAS_RITMO)
  const previos = { ingresos: 0, pedidos: 0 }
  for (const o of ordenes) {
    const t = new Date(o.created_at)
    if (t < inicioPrevio || t >= finPrevio) continue
    previos.ingresos += Number(o.total) || 0
    previos.pedidos += 1
  }

  return {
    previos,
    por_enviar,
    stock,
    reputacion: {
      dias: DIAS_REPUTACION,
      pedidos: contables,
      enviados,
      cancelados,
      devoluciones: devueltos.size,
      reclamos: reclamados.size,
      envio_promedio_horas,
      enviados_tarde: enviadosTarde,
      pedidos_sin_problema,
      semaforo,
      consejos,
    },
  }
}
