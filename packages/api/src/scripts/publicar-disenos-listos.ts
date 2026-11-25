// Publica los Diseños listos en la tienda HETNA (ver src/lib/disenos-listos.ts).
//
// Antes, en la tienda, se arman las imágenes y datos.json:
//   cd apps/storefront && npx tsx scripts/disenos-listos.mts
// Y luego, en packages/api:
//   NODE_ENV=production bunx medusa exec ./src/scripts/publicar-disenos-listos.ts
// Sólo algunos: HANDLES=hetna-maceta-con-drenaje,hetna-posavasos …
//
// Es seguro correrlo las veces que sea: actualiza precio, imagen y textos.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { publicarDisenosListos } from "../lib/disenos-listos-publicar"

export default async function publicar({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const handles = (process.env.HANDLES || "").split(",").map((s) => s.trim()).filter(Boolean)
  const r = await publicarDisenosListos(container, { handles })
  for (const x of r) logger.info(`[disenos-listos] ${x.handle}: ${x.accion}${x.precio ? ` · $${x.precio} · ${x.gramos} g` : ""}${x.mensaje ? ` · ${x.mensaje}` : ""}`)
  logger.info(`[disenos-listos] ${r.filter((x) => x.accion !== "error").length} de ${r.length} listos`)
}
