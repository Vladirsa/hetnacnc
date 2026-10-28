import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

// Todo lo que el taller ve en su tablero y que vive dentro de Medusa: ventas,
// vistas de ficha, catálogo, reseñas, cotizador y la meta del mes.
//
// Lo del foro va aparte (lib/foro-actividad.ts) porque sale de otra base, y el
// ranking también (lib/tablero-ranking.ts) porque necesita a todos los talleres
// y no sólo a uno.

export const DIAS_VENTANA = 30

// Mínimo de visitas para que valga la pena opinar del producto. Por debajo de
// esto, "0 ventas de 3 visitas" no dice nada: es ruido, no una señal de que el
// precio esté mal.
const VISTAS_MINIMAS = 10
// Debajo de esta conversión el producto se propone para descuento. 2% es bajo
// incluso para un catálogo industrial de ticket alto.
const CONVERSION_FLOJA = 0.02

export type ProductoVisto = {
  producto_id: string
  titulo: string
  vistas: number
  unidades_vendidas: number
  ingresos: number
}

export type CandidatoDescuento = ProductoVisto & {
  conversion: number
  // Para que el botón del tablero lleve directo a ponerle el precio por
  // cantidad en la pantalla que ya existe.
  offer_id: string | null
  precio_actual: number | null
  razon: "sin_ventas" | "conversion_baja"
}

export type VentasTaller = {
  ventana_dias: number
  total_pedidos: number
  ingresos_totales: number
  por_dia: { fecha: string; pedidos: number; ingresos: number }[]
  por_producto: Map<string, { titulo: string; cantidad: number; ingresos: number }>
  ingresos_mes: number
  pedidos_mes: number
  moneda: string | null
}

const aFechaISO = (fecha: Date) => fecha.toISOString().slice(0, 10)

// El mes en hora de México, no en UTC. Con UTC, a un taller de Guadalajara el
// mes le cambiaría a las 6 de la tarde del día 30 y vería su meta reiniciada
// mientras todavía está vendiendo.
export function mesDeMexico(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(fecha)
  const anio = partes.find((p) => p.type === "year")?.value ?? "0000"
  const mes = partes.find((p) => p.type === "month")?.value ?? "01"
  return `${anio}-${mes}`
}

// Primer instante del mes en curso, en hora de México, como fecha UTC: es el
// corte contra el que se compara la meta.
export function inicioDelMes(fecha = new Date()): Date {
  const [anio, mes] = mesDeMexico(fecha).split("-").map(Number)
  // -06:00 es la hora estándar del centro de México, que ya no cambia: el país
  // dejó el horario de verano en 2022.
  return new Date(Date.UTC(anio, mes - 1, 1, 6, 0, 0))
}

type OrderRow = {
  id: string
  total: number
  currency_code: string
  created_at: string
  items: { product_id: string | null; title: string | null; quantity: number; total: number }[]
}

// Pedidos del taller: los últimos DIAS_VENTANA días para las gráficas, y
// aparte el acumulado del mes en curso, que es contra lo que corre la meta.
export async function ventasDelTaller(
  container: MedusaContainer,
  sellerId: string
): Promise<VentasTaller> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_VENTANA)
  const arranqueMes = inicioDelMes()
  // Se pide desde la más vieja de las dos fechas para traer los pedidos una
  // sola vez: a mitad de mes la ventana de 30 días ya cubre el mes, pero el
  // día 1 no.
  const corte = desde < arranqueMes ? desde : arranqueMes

  const { data: sellerOrders } = await query.graph({
    entity: "order_seller",
    fields: ["order_id"],
    filters: { seller_id: sellerId },
  })
  const orderIds = sellerOrders.map((o) => o.order_id)

  const vacio: VentasTaller = {
    ventana_dias: DIAS_VENTANA,
    total_pedidos: 0,
    ingresos_totales: 0,
    por_dia: [],
    por_producto: new Map(),
    ingresos_mes: 0,
    pedidos_mes: 0,
    moneda: null,
  }

  if (!orderIds.length) {
    return { ...vacio, por_dia: diasVacios(desde) }
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "total",
      "currency_code",
      "created_at",
      "items.product_id",
      "items.title",
      "items.quantity",
      "items.total",
    ],
    filters: { id: orderIds, created_at: { $gte: corte.toISOString() } },
  })

  const porDia = new Map<string, { pedidos: number; ingresos: number }>()
  for (const dia of diasVacios(desde)) {
    porDia.set(dia.fecha, { pedidos: dia.pedidos, ingresos: dia.ingresos })
  }

  const porProducto = new Map<string, { titulo: string; cantidad: number; ingresos: number }>()
  let moneda: string | null = null
  let ingresosVentana = 0
  let pedidosVentana = 0
  let ingresosMes = 0
  let pedidosMes = 0

  for (const orden of orders as unknown as OrderRow[]) {
    const total = Number(orden.total) || 0
    const creada = new Date(orden.created_at)
    moneda ??= orden.currency_code

    if (creada >= arranqueMes) {
      ingresosMes += total
      pedidosMes += 1
    }

    if (creada < desde) continue

    ingresosVentana += total
    pedidosVentana += 1

    const bucket = porDia.get(aFechaISO(creada))
    if (bucket) {
      bucket.pedidos += 1
      bucket.ingresos += total
    }

    for (const item of orden.items || []) {
      if (!item.product_id) continue
      const previo = porProducto.get(item.product_id) ?? {
        titulo: item.title || "Sin nombre",
        cantidad: 0,
        ingresos: 0,
      }
      previo.cantidad += Number(item.quantity) || 0
      previo.ingresos += Number(item.total) || 0
      porProducto.set(item.product_id, previo)
    }
  }

  return {
    ventana_dias: DIAS_VENTANA,
    total_pedidos: pedidosVentana,
    ingresos_totales: ingresosVentana,
    por_dia: [...porDia.entries()].map(([fecha, v]) => ({ fecha, ...v })),
    por_producto: porProducto,
    ingresos_mes: ingresosMes,
    pedidos_mes: pedidosMes,
    moneda,
  }
}

function diasVacios(desde: Date) {
  const dias: { fecha: string; pedidos: number; ingresos: number }[] = []
  for (let i = 0; i < DIAS_VENTANA; i++) {
    const dia = new Date(desde)
    dia.setDate(dia.getDate() + i)
    dias.push({ fecha: aFechaISO(dia), pedidos: 0, ingresos: 0 })
  }
  return dias
}

// Vistas de ficha del taller, por producto, en la misma ventana que las ventas.
export async function vistasDelTaller(
  container: MedusaContainer,
  sellerId: string
): Promise<{ total: number; por_producto: Map<string, number> }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_VENTANA)

  const porProducto = new Map<string, number>()
  let total = 0

  try {
    const { data } = await query.graph({
      entity: "producto_vista",
      fields: ["product_id", "total"],
      filters: { seller_id: sellerId, dia: { $gte: aFechaISO(desde) } },
    })
    for (const fila of (data || []) as unknown as { product_id: string; total: number }[]) {
      const n = Number(fila.total) || 0
      total += n
      porProducto.set(fila.product_id, (porProducto.get(fila.product_id) || 0) + n)
    }
  } catch (e) {
    // El contador de vistas es joven: si su migración todavía no corrió en un
    // entorno, el resto del tablero no tiene por qué caerse.
    console.error("[tablero] vistas:", e instanceof Error ? e.message : e)
  }

  return { total, por_producto: porProducto }
}

// Catálogo del taller con su precio de una pieza, desde las ofertas. Sirve
// para dos cosas: saber qué productos tiene aunque no los haya visitado nadie,
// y mandar al taller directo a ponerle precio por cantidad al que convenga.
export async function catalogoDelTaller(
  container: MedusaContainer,
  sellerId: string
): Promise<Map<string, { titulo: string; offer_id: string; precio: number | null }>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const catalogo = new Map<string, { titulo: string; offer_id: string; precio: number | null }>()

  const { data } = await query.graph({
    entity: "offer",
    fields: [
      "id",
      "product.id",
      "product.title",
      "prices.amount",
      "prices.currency_code",
      "prices.min_quantity",
    ],
    filters: { seller_id: sellerId },
  })

  for (const oferta of (data || []) as unknown as {
    id: string
    product?: { id?: string; title?: string }
    prices?: { amount: number; currency_code: string; min_quantity: number | null }[]
  }[]) {
    const productoId = oferta.product?.id
    if (!productoId) continue
    // El precio de una pieza es el que no tiene escalón de cantidad; los
    // escalones son precios de volumen y dirían un número más bajo del que
    // paga quien compra una.
    const base = (oferta.prices || []).find((p) => !p.min_quantity || p.min_quantity <= 1)
    catalogo.set(productoId, {
      titulo: oferta.product?.title || "Sin nombre",
      offer_id: oferta.id,
      precio: base ? Number(base.amount) || 0 : null,
    })
  }

  return catalogo
}

// Los productos que la gente ve y no compra. Es la lista accionable del
// tablero: "a estos bájales el precio o arréglales la ficha".
export function candidatosADescuento(
  vistas: Map<string, number>,
  ventas: Map<string, { titulo: string; cantidad: number; ingresos: number }>,
  catalogo: Map<string, { titulo: string; offer_id: string; precio: number | null }>
): CandidatoDescuento[] {
  const candidatos: CandidatoDescuento[] = []

  for (const [productoId, numVistas] of vistas) {
    if (numVistas < VISTAS_MINIMAS) continue

    const venta = ventas.get(productoId)
    const unidades = venta?.cantidad || 0
    const conversion = numVistas > 0 ? unidades / numVistas : 0

    if (unidades > 0 && conversion >= CONVERSION_FLOJA) continue

    const delCatalogo = catalogo.get(productoId)
    candidatos.push({
      producto_id: productoId,
      titulo: venta?.titulo || delCatalogo?.titulo || "Sin nombre",
      vistas: numVistas,
      unidades_vendidas: unidades,
      ingresos: venta?.ingresos || 0,
      conversion,
      offer_id: delCatalogo?.offer_id ?? null,
      precio_actual: delCatalogo?.precio ?? null,
      razon: unidades === 0 ? "sin_ventas" : "conversion_baja",
    })
  }

  // Más visitas desperdiciadas primero: ahí está el dinero que se está yendo.
  return candidatos.sort((a, b) => b.vistas - a.vistas).slice(0, 10)
}

// Los más vistos, haya o no venta. Responde literal a "qué productos me visitan".
export function productosMasVistos(
  vistas: Map<string, number>,
  ventas: Map<string, { titulo: string; cantidad: number; ingresos: number }>,
  catalogo: Map<string, { titulo: string; offer_id: string; precio: number | null }>
): ProductoVisto[] {
  return [...vistas.entries()]
    .map(([productoId, numVistas]) => {
      const venta = ventas.get(productoId)
      return {
        producto_id: productoId,
        titulo: venta?.titulo || catalogo.get(productoId)?.titulo || "Sin nombre",
        vistas: numVistas,
        unidades_vendidas: venta?.cantidad || 0,
        ingresos: venta?.ingresos || 0,
      }
    })
    .sort((a, b) => b.vistas - a.vistas)
    .slice(0, 10)
}

export type ResenasTaller = { promedio: number | null; total: number }

// Reseñas de los productos del taller. Sólo cuentan las publicadas: las
// pendientes y las rechazadas no son la nota que ve el cliente, y meterlas
// aquí daría un número distinto al de la ficha.
export async function resenasDelTaller(
  container: MedusaContainer,
  productoIds: string[]
): Promise<ResenasTaller> {
  if (!productoIds.length) return { promedio: null, total: 0 }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data } = await query.graph({
      entity: "product_review",
      fields: ["product_id", "review.rating", "review.status"],
      filters: { product_id: productoIds },
    })

    let suma = 0
    let total = 0
    for (const enlace of (data || []) as unknown as {
      review?: { rating?: number; status?: string }
    }[]) {
      if (enlace.review?.status !== "published") continue
      suma += enlace.review.rating || 0
      total += 1
    }

    return { promedio: total ? Number((suma / total).toFixed(1)) : null, total }
  } catch (e) {
    console.error("[tablero] reseñas:", e instanceof Error ? e.message : e)
    return { promedio: null, total: 0 }
  }
}

export type CotizadorTaller = {
  vinculado: boolean
  plan: string | null
  cotizaciones: number
  enviadas: number
  aceptadas: number
  monto_aceptado: number
  monto_en_juego: number
  tasa_cierre: number | null
}

const COTIZADOR_VACIO: CotizadorTaller = {
  vinculado: false,
  plan: null,
  cotizaciones: 0,
  enviadas: 0,
  aceptadas: 0,
  monto_aceptado: 0,
  monto_en_juego: 0,
  tasa_cierre: null,
}

// El Cotizador se liga al taller por customer_id (es una cuenta de cliente de
// la tienda), mientras que el panel del vendedor sólo conoce seller_id. El
// puente es el correo: el mismo con el que el taller entra a vender es el que
// usa para cotizar.
export async function cotizadorDelTaller(
  container: MedusaContainer,
  sellerId: string
): Promise<CotizadorTaller> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: sellers } = await query.graph({
      entity: "seller",
      fields: ["id", "email"],
      filters: { id: sellerId },
    })
    const correo = (sellers?.[0] as { email?: string })?.email
    if (!correo) return COTIZADOR_VACIO

    const { data: clientes } = await query.graph({
      entity: "customer",
      fields: ["id"],
      filters: { email: correo },
    })
    const customerId = (clientes?.[0] as { id?: string })?.id
    if (!customerId) return COTIZADOR_VACIO

    const { data: perfiles } = await query.graph({
      entity: "cotizador_perfil",
      fields: ["id", "plan"],
      filters: { customer_id: customerId },
    })
    const perfil = perfiles?.[0] as { id?: string; plan?: string } | undefined
    if (!perfil?.id) return COTIZADOR_VACIO

    const { data: cotizaciones } = await query.graph({
      entity: "cotizador_cotizacion",
      fields: ["id", "estatus", "total"],
      filters: { perfil_id: perfil.id },
    })

    let enviadas = 0
    let aceptadas = 0
    let montoAceptado = 0
    let montoEnJuego = 0

    for (const c of (cotizaciones || []) as unknown as { estatus: string; total: number }[]) {
      const total = Number(c.total) || 0
      if (c.estatus === "aceptada") {
        aceptadas += 1
        montoAceptado += total
      }
      // "En juego" es lo que ya salió del taller y todavía puede cerrarse. Un
      // borrador no cuenta: no lo ha visto nadie.
      if (c.estatus === "enviada" || c.estatus === "vista") {
        montoEnJuego += total
      }
      if (c.estatus !== "borrador") enviadas += 1
    }

    return {
      vinculado: true,
      plan: perfil.plan ?? null,
      cotizaciones: cotizaciones?.length || 0,
      enviadas,
      aceptadas,
      monto_aceptado: montoAceptado,
      monto_en_juego: montoEnJuego,
      tasa_cierre: enviadas ? Number((aceptadas / enviadas).toFixed(3)) : null,
    }
  } catch (e) {
    console.error("[tablero] cotizador:", e instanceof Error ? e.message : e)
    return COTIZADOR_VACIO
  }
}
