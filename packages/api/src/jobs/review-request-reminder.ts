import { MedusaContainer } from "@medusajs/framework/types"

import { correrRecordatorioDeResenas } from "../lib/correo-resenas"

// "Califica lo que compraste": el correo que hace que las reseñas existan.
//
// El módulo de reseñas ya estaba construido -- se ven en la ficha, hay
// formulario, el backend sabe qué compraste y no has reseñado -- pero nadie
// invitaba a dejar una, así que todas las fichas se quedaban en cero. Y una
// ficha en ceros compite nada más por precio.
//
// El cuerpo vive en lib/correo-resenas porque el script de prueba
// (src/scripts/probar-correo-resenas.ts) corre exactamente lo mismo: si tuviera
// su propia copia, probaría su copia y no esto.
export default async function reviewRequestReminder(container: MedusaContainer) {
  const logger = container.resolve("logger")

  const reporte = await correrRecordatorioDeResenas(container, { enviar: true })

  if (reporte.motivo) {
    // Sin proveedor de correo no hay nada que hacer. Se dice una vez al día y
    // ya; no vale la pena ensuciar el log a cada rato.
    logger.info(`[resenas-correo] sin hacer nada: ${reporte.motivo}`)
    return
  }

  logger.info(
    `[resenas-correo] ${reporte.elegibles} órdenes elegibles, ${reporte.yaResenadas} ya reseñadas, ${reporte.enviados} correos enviados`
  )
}

export const config = {
  name: "review-request-reminder",
  // Una vez al día y temprano: es un correo que no urge, y mandarlo cada hora
  // sólo multiplica las probabilidades de duplicarlo si algo sale mal.
  schedule: "0 15 * * *",
}
