import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  CAMPOS_ORDEN_PENDIENTES,
  estaPagada,
  pendientesDeOrdenes,
  productosResenadosPor,
  type OrdenLigera,
} from "../lib/resenas-pendientes"
import { sendReviewRequestEmailWorkflow } from "../workflows/send-review-request-email"

// "Califica lo que compraste": el correo que hace que las reseñas existan.
//
// El módulo de reseñas ya estaba construido -- se ven en la ficha, hay
// formulario, el backend sabe qué compraste y no has reseñado -- pero nadie
// invitaba a dejar una, así que todas las fichas se quedaban en cero. Y una
// ficha en ceros compite nada más por precio.
//
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

export default async function reviewRequestReminder(container: MedusaContainer) {
  const logger = container.resolve("logger")

  if (!process.env.RESEND_API_KEY) {
    // Sin proveedor de correo no hay nada que hacer, y no vale la pena ensuciar
    // el log con un aviso cada día.
    return
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

  let enviados = 0
  let sinPendientes = 0

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
        sinPendientes += 1
        continue
      }

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

  logger.info(
    `[resenas-correo] ${candidatas.length} órdenes elegibles, ${sinPendientes} ya reseñadas, ${enviados} correos enviados`
  )
}

export const config = {
  name: "review-request-reminder",
  // Una vez al día y temprano: es un correo que no urge, y mandarlo cada hora
  // sólo multiplica las probabilidades de duplicarlo si algo sale mal.
  schedule: "0 15 * * *",
}
