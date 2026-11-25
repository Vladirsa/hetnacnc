// Crea en la tienda un producto por plano de la Biblioteca de planos (o pone al
// día su precio recomendado, peso y medidas si ya existe). Sin taller ligado:
// cada taller pone su oferta desde su panel.
//
// Uso (en packages/api, con la tienda ya desplegada):
//   NODE_ENV=production bunx medusa exec ./src/scripts/crear-productos-planos.ts
// Quedan como BORRADOR. Para publicarlos:
//   PUBLICAR=1 NODE_ENV=production bunx medusa exec ./src/scripts/crear-productos-planos.ts
// Sólo algunos: SOLO=librero-bajo,especiero-de-pared
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sincronizarProductosPlanos } from "../lib/planos-catalogo"

export default async function crearProductosPlanos({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const solo = (process.env.SOLO || "").split(",").map((s) => s.trim()).filter(Boolean)
  const r = await sincronizarProductosPlanos(container, { publicar: process.env.PUBLICAR === "1", solo })
  logger.info(`[planos-tienda] ${r.creados} creados, ${r.actualizados} actualizados de ${r.total} planos`)
}
