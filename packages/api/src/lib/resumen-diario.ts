// @ts-nocheck
// El resumen de ayer: qué se vendió, qué se quedó en el carrito, quién llegó.
//
// Por qué existe: se construyeron varias cosas para vender más -- envío gratis
// por umbral, precios por cantidad, packs, reseñas -- y no había forma de saber
// si alguna sirve. Sin una cifra, la siguiente decisión es una adivinanza.
//
// Lo que NO trae, y hay que decirlo en vez de dejar un hueco: visitas y vistas
// de ficha. GA4 y el Pixel corren en el navegador y sus datos viven en Google y
// en Meta, no aquí. Traerlos pide la API de GA4 con credenciales propias, que es
// otro trabajo. Esto cubre lo que la base de datos sí sabe de cierto.
//
// Los pedidos se atribuyen a cada taller por el enlace `order_seller`, el mismo
// que usa el panel de métricas del vendedor: dos formas distintas de contar lo
// mismo acabarían dando dos números distintos.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const DIA = 24 * 60 * 60 * 1000

const estaPagada = (orden) =>
  (orden.payment_collections || []).some(
    (pc) => pc?.status === "completed" || pc?.status === "partially_captured"
  )

const dentro = (iso, desde: number, hasta: number): boolean => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= desde && t < hasta
}

export type ResumenTaller = {
  seller_id: string
  nombre: string
  pedidos: number
  ingresos: number
}

export type ResumenDiario = {
  // El día que se está reportando, en ISO corto.
  dia: string
  moneda: string
  pedidos: number
  ingresos: number
  // Pedidos sin pago confirmado: son ventas que todavía no son ventas.
  pedidos_sin_pagar: number
  clientes_nuevos: number
  // Carritos que se crearon ayer y no se completaron, con lo que traían dentro.
  carritos_abandonados: number
  valor_abandonado: number
  resenas_nuevas: number
  talleres: ResumenTaller[]
  // Totales históricos. Van porque un reporte de ceros no se puede interpretar
  // sin denominador: "0 pedidos ayer" significa cosas muy distintas si la
  // tienda lleva 400 pedidos o si lleva 0. Sin esto, un día tranquilo y un
  // filtro de fechas roto se ven idénticos.
  total_pedidos: number
  total_clientes: number
  total_carritos_sin_completar: number
  // Comparación con el día anterior, para que una cifra sola no parezca buena
  // o mala sin referencia.
  pedidos_antier: number
  ingresos_antier: number
}

// El resumen de un día. `finDelDia` es el límite superior exclusivo; por omisión
// se reporta AYER completo, no hoy a medias: medio día no se compara con nada.
export async function calcularResumenDiario(
  container,
  { hasta = Date.now() }: { hasta?: number } = {}
): Promise<ResumenDiario> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Se reporta el día natural anterior, en UTC. Es el mismo corte que usa el
  // cron, así que el correo de las 9 habla de un día cerrado.
  const hoyCero = new Date(hasta)
  hoyCero.setUTCHours(0, 0, 0, 0)
  const finAyer = hoyCero.getTime()
  const inicioAyer = finAyer - DIA
  const inicioAntier = inicioAyer - DIA

  const { data: ordenes } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "total",
      "currency_code",
      "created_at",
      "payment_collections.status",
    ],
  })

  // Enlace pedido -> taller, para el desglose.
  const { data: enlacesTaller } = await query.graph({
    entity: "order_seller",
    fields: ["order_id", "seller_id"],
  })
  const tallerDeOrden = new Map<string, string>()
  for (const e of enlacesTaller || []) {
    if (e?.order_id && e?.seller_id) tallerDeOrden.set(e.order_id, e.seller_id)
  }

  let totalPedidos = 0
  let pedidos = 0
  let ingresos = 0
  let pedidosSinPagar = 0
  let pedidosAntier = 0
  let ingresosAntier = 0
  let moneda = "mxn"
  const porTaller = new Map<string, { pedidos: number; ingresos: number }>()

  for (const orden of ordenes || []) {
    const total = Number(orden.total) || 0
    if (orden.currency_code) moneda = orden.currency_code
    totalPedidos += 1

    if (dentro(orden.created_at, inicioAyer, finAyer)) {
      if (estaPagada(orden)) {
        pedidos += 1
        ingresos += total
        const sellerId = tallerDeOrden.get(orden.id)
        if (sellerId) {
          const previo = porTaller.get(sellerId) || { pedidos: 0, ingresos: 0 }
          porTaller.set(sellerId, {
            pedidos: previo.pedidos + 1,
            ingresos: previo.ingresos + total,
          })
        }
      } else {
        pedidosSinPagar += 1
      }
    } else if (dentro(orden.created_at, inicioAntier, inicioAyer)) {
      if (estaPagada(orden)) {
        pedidosAntier += 1
        ingresosAntier += total
      }
    }
  }

  // Nombres de los talleres que vendieron. Sin nombre el desglose diría ids.
  const talleres: ResumenTaller[] = []
  if (porTaller.size) {
    const { data: filas } = await query.graph({
      entity: "seller",
      fields: ["id", "name"],
      filters: { id: [...porTaller.keys()] },
    })
    const nombre = new Map<string, string>()
    for (const s of filas || []) {
      if (s?.id) nombre.set(s.id, s.name || s.id)
    }
    for (const [sellerId, datos] of porTaller) {
      talleres.push({
        seller_id: sellerId,
        nombre: nombre.get(sellerId) || sellerId,
        ...datos,
      })
    }
    talleres.sort((a, b) => b.ingresos - a.ingresos)
  }

  // Carritos de ayer que no se completaron. Es lo que se dejó en la mesa, y la
  // cifra que justifica el correo de carrito abandonado.
  const { data: carritos } = await query.graph({
    entity: "cart",
    fields: ["id", "total", "created_at", "completed_at"],
    filters: { completed_at: null },
  })
  let carritosAbandonados = 0
  let valorAbandonado = 0
  const totalCarritosSinCompletar = (carritos || []).length
  for (const carrito of carritos || []) {
    if (!dentro(carrito.created_at, inicioAyer, finAyer)) continue
    carritosAbandonados += 1
    valorAbandonado += Number(carrito.total) || 0
  }

  // Clientes nuevos.
  const { data: clientes } = await query.graph({
    entity: "customer",
    fields: ["id", "created_at"],
  })
  const totalClientes = (clientes || []).length
  const clientesNuevos = (clientes || []).filter((c) =>
    dentro(c?.created_at, inicioAyer, finAyer)
  ).length

  // Reseñas nuevas, del dominio Review de Mercur. Si el módulo no responde, el
  // resumen sale igual con esta cifra en cero en lugar de no salir.
  let resenasNuevas = 0
  try {
    const { data: resenas } = await query.graph({
      entity: "review",
      fields: ["id", "created_at"],
    })
    resenasNuevas = (resenas || []).filter((r) =>
      dentro(r?.created_at, inicioAyer, finAyer)
    ).length
  } catch {
    resenasNuevas = 0
  }

  return {
    dia: new Date(inicioAyer).toISOString().slice(0, 10),
    moneda,
    pedidos,
    ingresos,
    pedidos_sin_pagar: pedidosSinPagar,
    clientes_nuevos: clientesNuevos,
    carritos_abandonados: carritosAbandonados,
    valor_abandonado: valorAbandonado,
    resenas_nuevas: resenasNuevas,
    talleres,
    pedidos_antier: pedidosAntier,
    ingresos_antier: ingresosAntier,
    total_pedidos: totalPedidos,
    total_clientes: totalClientes,
    total_carritos_sin_completar: totalCarritosSinCompletar,
  }
}
