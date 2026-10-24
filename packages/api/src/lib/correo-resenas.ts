import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  CAMPOS_ORDEN_PENDIENTES,
  estaPagada,
  pendientesDeOrdenes,
  productosResenadosPor,
  type OrdenLigera,
} from "./resenas-pendientes"
import { sendReviewRequestEmailWorkflow } from "../workflows/send-review-request-email"

// El cuerpo del recordatorio "califica lo que compraste", en un solo lugar.
//
// Lo llaman dos cosas: el job de todos los días y el script de prueba que
// permite correrlo a mano. Están separados de esto a propósito -- si el script
// tuviera su propia copia de la lógica, probaría su copia y no el job, que es
// justo lo que uno quiere comprobar.
//
// `enviar: false` recorre todo igual pero no manda nada ni marca ninguna orden:
// sirve para ver a quién le escribiría con los datos de hoy, antes de escribirle
// de verdad a un cliente real.

// Se espera unos días a propósito: pedir la reseña el mismo día que se cobró es
// pedirla antes de que la pieza llegue. Se cuenta desde que se creó la orden y
// no desde que se entregó porque la entrega de este catálogo no siempre queda
// registrada; el retraso por omisión es generoso para compensar eso.
//
// Y se deja de insistir pasado el tope: a los dos meses el cliente ya ni se
// acuerda, y un correo que no se contesta sólo entrena al buzón a mandarnos a
// spam.
const MIN_DIAS = Number(process.env.RESENA_EMAIL_MIN_DIAS || 10)
const MAX_DIAS = Number(process.env.RESENA_EMAIL_MAX_DIAS || 60)
const MAX_ORDENES_POR_CORRIDA = 40
// Más de esto en un correo deja de ser una invitación y parece una tarea.
const MAX_PRODUCTOS_POR_CORREO = 4

const DIA = 24 * 60 * 60 * 1000

// El correo se tapa al reportarlo porque estas salidas se pegan en chats y en
// tickets. Para verificar que el destinatario es el correcto basta con el
// principio y el dominio.
const enmascarar = (correo: string): string => {
  const [antes, dominio] = correo.split("@")
  if (!dominio) return "***"
  const visible = antes.slice(0, 2)
  return `${visible}${"*".repeat(Math.max(1, antes.length - 2))}@${dominio}`
}

export type Previsualizacion = {
  order_id: string
  correo: string
  productos: string[]
}

export type ReporteCorreoResenas = {
  elegibles: number
  yaResenadas: number
  enviados: number
  // Lo que se mandaría (o se mandó): una entrada por orden.
  detalle: Previsualizacion[]
  // Por qué no se hizo nada, cuando aplica.
  motivo?: string
}

export async function correrRecordatorioDeResenas(
  container: MedusaContainer,
  { enviar = true }: { enviar?: boolean } = {}
): Promise<ReporteCorreoResenas> {
  const logger = container.resolve("logger")

  // En seco no hace falta proveedor de correo: no se manda nada.
  if (enviar && !process.env.RESEND_API_KEY) {
    return {
      elegibles: 0,
      yaResenadas: 0,
      enviados: 0,
      detalle: [],
      motivo: "RESEND_API_KEY no está configurada",
    }
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const ahora = Date.now()
  const masNuevaQue = ahora - MIN_DIAS * DIA // órdenes más nuevas que esto: la pieza quizá no llegó
  const masViejaQue = ahora - MAX_DIAS * DIA // más viejas que esto: ya no se insiste

  const { data: ordenes } = await query.graph({
    entity: "order",
    fields: CAMPOS_ORDEN_PENDIENTES,
  })

  const storefrontUrl =
    process.env.STOREFRONT_URL ||
    process.env.STOREFRONT_REVALIDATE_URL ||
    "http://localhost:3000"

  const candidatas = ((ordenes || []) as unknown as OrdenLigera[])
    .filter((orden) => {
      if (!orden.email || !orden.customer_id) return false
      // Ya se le pidió por esta orden. Pedirlo otra vez es spam.
      if (orden.metadata?.resena_email_sent_at) return false
      if (!estaPagada(orden)) return false

      const creada = new Date(orden.created_at).getTime()
      if (!Number.isFinite(creada)) return false
      return creada <= masNuevaQue && creada >= masViejaQue
    })
    .slice(0, MAX_ORDENES_POR_CORRIDA)

  // Un cliente con varias órdenes elegibles se consulta una sola vez: lo que ya
  // reseñó no cambia entre una orden y otra dentro de la misma corrida.
  const resenadosPorCliente = new Map<string, Set<string>>()

  const detalle: Previsualizacion[] = []
  let enviados = 0
  let yaResenadas = 0

  for (const orden of candidatas) {
    const customerId = orden.customer_id as string
    try {
      if (!resenadosPorCliente.has(customerId)) {
        resenadosPorCliente.set(
          customerId,
          await productosResenadosPor(container, customerId)
        )
      }
      const yaResenados = resenadosPorCliente.get(customerId) as Set<string>

      const pendientes = pendientesDeOrdenes([orden], yaResenados)
        // Sin handle no hay a dónde mandar al cliente, y un enlace roto en un
        // correo es peor que no mandarlo.
        .filter((p) => !!p.handle)
        .slice(0, MAX_PRODUCTOS_POR_CORREO)

      if (!pendientes.length) {
        // Ya reseñó todo lo de esta orden. No se manda nada y tampoco se marca:
        // si mañana compra y devuelve algo, el estado se vuelve a evaluar solo.
        yaResenadas += 1
        continue
      }

      detalle.push({
        order_id: orden.id,
        correo: enmascarar(orden.email as string),
        productos: pendientes.map((p) => p.titulo || p.product_id),
      })

      if (!enviar) continue

      const { result } = await sendReviewRequestEmailWorkflow(container).run({
        input: {
          order_id: orden.id,
          email: orden.email as string,
          nombre: null,
          productos: pendientes.map((p) => ({
            titulo: p.titulo || "tu producto",
            url: `${storefrontUrl}/mx/products/${p.handle}`,
          })),
          metadata: orden.metadata || null,
        },
      })
      if (result?.sent) enviados += 1
    } catch (e) {
      logger.error(`[resenas-correo] fallo para la orden ${orden.id}: ${e}`)
    }
  }

  return { elegibles: candidatas.length, yaResenadas, enviados, detalle }
}
