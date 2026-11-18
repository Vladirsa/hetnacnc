// Taller aprobado desde el panel de administración (Tiendas > Confirmar): Mercur
// corre approveSellerWorkflow y emite "seller.approved", sin pasar por
// lib/aprobar-taller.ts. Aquí se manda lo extra de HETNA (correo de bienvenida
// y anuncio en redes) si nadie lo mandó todavía: el botón del correo y el alta
// automática toman la marca antes de aprobar, así que en esos caminos no se
// repite. Aprobado por una persona de HETNA, el anuncio no queda en borrador.
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { servicioTalleres } from "../lib/alta-taller"
import { extrasAprobacion, reclamarBienvenida } from "../lib/aprobar-taller"

export default async function tallerAprobadoBienvenida({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    if (!(await reclamarBienvenida(knex, event.data.id))) return
    const t = await servicioTalleres(container).retrieveSeller(event.data.id)
    if (!t) return
    logger.info(`[alta-taller] aprobado desde el panel: ${t.name} (${t.email})`)
    await extrasAprobacion(container, t as any, { automatica: false })
  } catch (e) {
    logger.warn(`[alta-taller] bienvenida de ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "seller.approved",
}
