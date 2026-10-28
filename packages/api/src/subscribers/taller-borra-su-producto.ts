// Cada taller borra sus propios productos sin esperar al administrador.
//
// Mercur manda toda baja de un producto publicado a revisión ("Solicitudes" en el
// panel de administración). En HETNA cada producto es de un solo taller, así que
// la baja que pide el dueño se aprueba sola aquí mismo.
//
// Solo se aprueba si:
//   - la solicitud trae únicamente "borrar producto" (las ediciones siguen a revisión),
//   - quien la pide es el taller dueño del producto,
//   - y ningún otro taller vende ese mismo producto.
// En cualquier otro caso la solicitud se queda pendiente como siempre.
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  confirmProductChangeWorkflow,
  ProductChangeWorkflowEvents,
} from "@mercurjs/core/workflows"

type Cambio = {
  id: string
  status: string
  product_id: string
  created_by?: string | null
  actions?: { action: string }[]
}

export default async function tallerBorraSuProducto({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const {
      data: [cambio],
    } = (await query.graph({
      entity: "product_change",
      fields: ["id", "status", "product_id", "created_by", "actions.action"],
      filters: { id: event.data.id },
    })) as unknown as { data: Cambio[] }

    if (!cambio || cambio.status !== "pending") return
    const acciones = cambio.actions ?? []
    if (!acciones.length || !acciones.every((a) => a.action === "PRODUCT_DELETE")) return
    if (!cambio.created_by) return

    const {
      data: [producto],
    } = (await query.graph({
      entity: "product",
      fields: ["id", "title", "sellers.id"],
      filters: { id: cambio.product_id },
    })) as unknown as { data: { id: string; title?: string; sellers?: { id: string }[] }[] }

    const talleres = (producto?.sellers ?? []).map((s) => s.id)
    if (talleres.length !== 1 || talleres[0] !== cambio.created_by) return

    await confirmProductChangeWorkflow(container).run({
      input: {
        ids: [cambio.id],
        confirmed_by: cambio.created_by,
        internal_note: "Aprobado solo: el taller dueño borró su producto",
      },
    })
    logger.info(`[taller-borra] ${cambio.created_by} borró su producto "${producto?.title ?? cambio.product_id}"`)
  } catch (e) {
    // Si algo falla, la solicitud queda pendiente y el administrador la ve en Solicitudes
    logger.warn(`[taller-borra] no se aprobó la baja ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ProductChangeWorkflowEvents.CREATED,
}
