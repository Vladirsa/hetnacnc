import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"

import { getSignedDownloadUrl } from "./backblaze"
import { digitalDownloadEmailHtml } from "./email-templates"
import { STORE_URL } from "./licitacion"
import { generarPdfEntrega, type ArchivoEntrega } from "./pdf-entrega"
import { sendEmail } from "./resend"

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
      "metadata",
      "items.id",
      "items.title",
      "items.product_id",
      "payment_collections.status",
    ],
    filters: { id: orderId },
  })

  if (!order) {
    return
  }

  // order.placed se dispara antes de autorizar el pago, asi que la mayoria
  // de las veces este guard hace que esa rama no haga nada todavia: la
  // entrega real ocurre cuando payment.captured llega despues. "completed"
  // es el estado de payment_collections.status para una captura total
  // (el campo conveniente order.payment_status de OrderDetailDTO no se
  // puede pedir via query.graph en la entidad "order" generica).
  const paymentCollections = order.payment_collections || []
  const isPaid = paymentCollections.some(
    (pc: any) => pc?.status === "completed" || pc?.status === "partially_captured"
  )
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
  const vistos = new Set<string>()
  const archivos: { titulo: string; url: string; entrega: ArchivoEntrega }[] = []
  let vence = ""

  for (const item of order.items || []) {
    const pid = item?.product_id as string
    if (!item || !pid || vistos.has(pid)) {
      continue
    }
    const product = products.find((p: any) => p.id === item.product_id)
    const metadata = (product?.metadata || {}) as Record<string, unknown>
    if (metadata.producto_digital !== true || !metadata.archivo_storage_key) {
      continue
    }
    vistos.add(pid)

    // La liga se genera al momento de la compra, nunca se reutiliza una vieja:
    // así la ventana de 7 días empieza cuando el cliente de verdad la puede usar.
    const liga = await getSignedDownloadUrl(metadata.archivo_storage_key as string)
    if (!liga.ok) {
      logger.error(`[digital-delivery] sin liga para ${metadata.archivo_storage_key} (orden ${order.id}): ${liga.reason}`)
      continue
    }
    const entrega = archivoDeProducto(product, item)
    archivos.push({ titulo: entrega.titulo, url: liga.url, entrega })
    vence = liga.expiresAt
  }

  if (!archivos.length) {
    return
  }

  const conCuenta = Boolean(order.customer_id)
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
    // No se marca como entregada: el siguiente evento de pago lo reintenta.
    logger.error(`[digital-delivery] correo no enviado a ${recipient} (orden ${order.id}): ${reason}`)
    return
  }
  logger.info(`[digital-delivery] ${archivos.length} archivo(s) entregados a ${recipient}, orden ${order.id}`)

  const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER)
  await orderModuleService.updateOrders(order.id, {
    metadata: {
      ...orderMetadata,
      digital_delivery_sent_at: new Date().toISOString(),
    },
  })
}
