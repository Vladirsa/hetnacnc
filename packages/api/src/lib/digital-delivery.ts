import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"

import { llaveDeProductoValida } from "./archivo-seguro"
import { getSignedDownloadUrl } from "./backblaze"
import { digitalDownloadEmailHtml } from "./email-templates"
import { STORE_URL } from "./licitacion"
import { generarPdfEntrega, type ArchivoEntrega } from "./pdf-entrega"
import { sendEmail } from "./resend"
import { CAMPOS_PAGO, pedidoPagado } from "./pago-pedido"

export const CONTACTO_HETNA = "contacto@hetnacnc.com"
export const ligaMisDescargas = () => `${STORE_URL}/mx/user/descargas`

// Lo que hace falta para el comprobante PDF de una orden (correo y Mis descargas)
export function archivoDeProducto(product: any, item: any): ArchivoEntrega {
  const m = (product?.metadata || {}) as Record<string, unknown>
  // "formatos" lo llena la captura del diseño (p. ej. "DXF, SVG"); si falta,
  // se usa la extensión del archivo.
  const formato = typeof m.formatos === "string" && m.formatos.trim() ? m.formatos.trim() : String(m.archivo_storage_key || "").split(".").pop()?.toUpperCase()
  return {
    titulo: (product?.title || item?.title || "Archivo digital") as string,
    sku: typeof m.digital_factory_sku === "string" ? m.digital_factory_sku : null,
    formato: formato && formato.length <= 40 ? formato : null,
  }
}

// Logica compartida por los dos disparadores posibles de entrega digital:
// order.placed (cuando el proveedor de pago autoriza y captura en el mismo
// paso) y payment.captured (cuando la captura ocurre despues, de forma
// asincrona). metadata.digital_delivery_sent_at en la orden evita que se
// mande el correo dos veces si ambos eventos terminan apuntando a la misma
// orden ya entregada.
export async function deliverDigitalProductsForOrder(
  container: MedusaContainer,
  orderId: string
): Promise<void> {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "email",
      "customer_id",
      "customer.email",
      "customer.has_account",
      "metadata",
      "items.id",
      "items.title",
      "items.product_id",
      ...CAMPOS_PAGO,
    ],
    filters: { id: orderId },
  })

  if (!order) {
    return
  }

  // Regla única de pagado (lib/pago-pedido.ts): con Mercado Pago o PayPal el
  // cobro ya está hecho al autorizar, así que la entrega sale en order.placed.
  // Con otros proveedores espera a la captura (payment.captured).
  const isPaid = pedidoPagado(order as any)
  if (!isPaid) {
    return
  }

  const orderMetadata = (order.metadata || {}) as Record<string, unknown>
  if (orderMetadata.digital_delivery_sent_at) {
    return
  }

  const recipient = order.email || order.customer?.email
  if (!recipient) {
    return
  }

  const productIds = [
    ...new Set((order.items || []).map((item: any) => item.product_id).filter(Boolean)),
  ]
  if (productIds.length === 0) {
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "metadata"],
    filters: { id: productIds },
  })

  // Un solo correo por orden, con un botón por archivo y el comprobante PDF
  // adjunto. Un producto repetido en la orden se entrega una vez.
  // 28 nov 2026: los productos ya entregados se anotan (digital_entregados) y la orden sólo
  // se marca como entregada cuando TODOS sus archivos salieron; si algo falla (correo, liga
  // de Backblaze o archivo faltante) la reintenta jobs/reintentar-entregas-digitales.ts y se
  // avisa al dueño una vez.
  const entregados = new Set<string>(Array.isArray(orderMetadata.digital_entregados) ? (orderMetadata.digital_entregados as string[]) : [])
  const vistos = new Set<string>()
  const archivos: { pid: string; titulo: string; url: string; entrega: ArchivoEntrega }[] = []
  const faltantes: string[] = []
  let digitales = 0
  let vence = ""

  for (const item of order.items || []) {
    const pid = item?.product_id as string
    if (!item || !pid || vistos.has(pid)) {
      continue
    }
    const product = products.find((p: any) => p.id === item.product_id)
    const metadata = (product?.metadata || {}) as Record<string, unknown>
    if (metadata.producto_digital !== true && metadata.producto_digital !== "true") {
      continue
    }
    vistos.add(pid)
    digitales++
    if (entregados.has(pid)) {
      continue
    }
    const titulo = (product?.title || item.title || pid) as string
    if (!llaveDeProductoValida(metadata.archivo_storage_key)) {
      faltantes.push(`${titulo}: el producto no tiene archivo válido (archivo_storage_key)`)
      continue
    }

    // La liga se genera al momento de la compra, nunca se reutiliza una vieja:
    // así la ventana de 7 días empieza cuando el cliente de verdad la puede usar.
    let liga: Awaited<ReturnType<typeof getSignedDownloadUrl>>
    try {
      liga = await getSignedDownloadUrl(metadata.archivo_storage_key as string)
    } catch (e) {
      liga = { ok: false, reason: (e as Error).message } as any
    }
    if (!liga.ok) {
      logger.error(`[digital-delivery] sin liga para ${metadata.archivo_storage_key} (orden ${order.id}): ${liga.reason}`)
      faltantes.push(`${titulo}: Backblaze no dio la liga (${liga.reason})`)
      continue
    }
    const entrega = archivoDeProducto(product, item)
    archivos.push({ pid, titulo: entrega.titulo, url: liga.url, entrega })
    vence = liga.expiresAt
  }

  const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER)
  const guardar = (extra: Record<string, unknown>) =>
    orderModuleService.updateOrders(order.id, { metadata: { ...orderMetadata, ...extra } })

  if (!digitales) {
    // Sin productos digitales: el reintento ya no la vuelve a revisar
    await guardar({ digital_no_aplica: true })
    return
  }

  const avisarFalla = async (motivo: string) => {
    const intentos = Number(orderMetadata.digital_delivery_intentos || 0) + 1
    logger.error(`[digital-delivery] orden ${order.id} (intento ${intentos}): ${motivo}`)
    const extra: Record<string, unknown> = { digital_delivery_intentos: intentos, digital_delivery_error: motivo.slice(0, 500) }
    // Al dueño, una sola vez por orden: el cliente ya pagó y no tiene todo su archivo
    if (!orderMetadata.digital_delivery_alerta_at) {
      const r = await sendEmail({
        to: CONTACTO_HETNA,
        subject: `⚠️ Entrega digital pendiente: pedido #${order.display_id}`,
        html: `<p>El pedido <b>#${order.display_id}</b> (${recipient}) está pagado pero no se le pudo entregar todo su archivo.</p><p>${motivo.replace(/</g, "&lt;")}</p><p>Se reintenta solo cada 20 minutos durante 7 días. Si es un archivo faltante, súbelo con scripts/reemplazar-archivo-diseno.ts.</p>`,
      }).catch(() => ({ sent: false }))
      if ((r as any).sent) extra.digital_delivery_alerta_at = new Date().toISOString()
    }
    await guardar(extra)
  }

  if (!archivos.length) {
    if (faltantes.length) await avisarFalla(faltantes.join(" · "))
    // Todo se había entregado ya en intentos anteriores: se cierra la orden
    else await guardar({ digital_delivery_sent_at: new Date().toISOString(), digital_delivery_error: null })
    return
  }

  // Sólo quien tiene cuenta puede abrir «Mis descargas» (un invitado también tiene customer_id)
  const conCuenta = Boolean(order.customer_id) && (order as any).customer?.has_account !== false
  let pdf: Uint8Array | null = null
  try {
    pdf = await generarPdfEntrega({
      display_id: String(order.display_id),
      fecha: new Date(order.created_at as any),
      correo: recipient,
      archivos: archivos.map((a) => a.entrega),
      liga_descargas: conCuenta ? ligaMisDescargas() : null,
      liga_directa_vence: vence ? new Date(vence) : null,
      liga_terminos: `${STORE_URL}/mx/terminos-y-condiciones`,
      contacto: CONTACTO_HETNA,
    })
  } catch (e) {
    // Sin PDF el cliente igual recibe sus archivos: el comprobante es extra.
    logger.error(`[digital-delivery] no se pudo generar el PDF de la orden ${order.id}: ${e}`)
  }

  const { sent, reason } = await sendEmail({
    to: recipient,
    subject: archivos.length === 1 ? `Tu archivo de ${archivos[0].titulo} ya está listo` : `Tus ${archivos.length} archivos ya están listos`,
    html: digitalDownloadEmailHtml({
      displayId: String(order.display_id),
      archivos: archivos.map(({ titulo, url }) => ({ titulo, url })),
      expiresAt: vence,
      misDescargasUrl: conCuenta ? ligaMisDescargas() : null,
    }),
    adjuntos: pdf ? [{ nombre: `HETNA-entrega-pedido-${order.display_id}.pdf`, contenido: pdf }] : undefined,
  })

  if (!sent) {
    // No se marca como entregada: lo reintenta jobs/reintentar-entregas-digitales.ts
    await avisarFalla(`el correo no salió a ${recipient}: ${reason}`)
    return
  }
  logger.info(`[digital-delivery] ${archivos.length} archivo(s) entregados a ${recipient}, orden ${order.id}`)

  const ahora = [...entregados, ...archivos.map((a) => a.pid)]
  if (faltantes.length) {
    // Entrega parcial: se anota lo que sí salió y se reintenta lo que falta
    orderMetadata.digital_entregados = ahora
    await avisarFalla(`entrega parcial; faltan: ${faltantes.join(" · ")}`)
    return
  }
  await guardar({ digital_entregados: ahora, digital_delivery_sent_at: new Date().toISOString(), digital_delivery_error: null })
}
