// Cuando se crea o edita un producto, le pone el perfil de envío correcto:
// Tipo "Digital" (o etiqueta "digital") => perfil "Producto digital" (envío $0).
// Cualquier otro => perfil normal. Si ya tiene el correcto, no hace nada (así no se cicla).
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { ajustarPerfilDeProducto } from "../lib/envios-automaticos"

export default async function productoDigitalSinEnvio({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    const cambio = await ajustarPerfilDeProducto(container, event.data.id)
    if (cambio) logger.info(`[envios-auto] producto ${event.data.id} marcado como ${cambio}`)
  } catch (e) {
    logger.error(`[envios-auto] no se pudo ajustar el envío del producto ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
