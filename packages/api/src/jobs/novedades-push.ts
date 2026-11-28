// Diario (7:10 pm de México): "productos nuevos" al celular de quien activó el
// aviso en /mx/novedades o en la portada, con o sin cuenta (lib/push.ts).
// Un solo aviso al día con lo que se publicó desde el anterior; si no hubo
// nada, no manda. NOVEDADES_PUSH=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { avisoNovedades, pushNovedades } from "../lib/push"

const T_AVISADOS = "hetna_push_novedades"

export default async function novedadesPush(container: MedusaContainer) {
  if (process.env.NOVEDADES_PUSH === "0") return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    // Los productos ya avisados (por id, no por fecha: un borrador que se publica días después también cuenta)
    let primeraVez = false
    if (!(await knex.schema.hasTable(T_AVISADOS))) {
      await knex.schema.createTable(T_AVISADOS, (t: any) => {
        t.text("product_id").primary()
        t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      })
      primeraVez = true
    }
    // lo que se ve en la tienda: publicado, con foto y en algún canal de venta
    const visibles = await knex("product as p")
      .where("p.status", "published")
      .whereNull("p.deleted_at")
      .whereNotNull("p.thumbnail")
      .whereExists(knex.select(1).from("product_sales_channel as psc").whereRaw("psc.product_id = p.id").whereNull("psc.deleted_at"))
      .whereNotExists(knex.select(1).from(T_AVISADOS + " as a").whereRaw("a.product_id = p.id"))
      .orderBy("p.created_at", "desc")
      .limit(500)
      .select("p.id", "p.title", "p.handle")
    if (visibles.length) await knex.batchInsert(T_AVISADOS, visibles.map((v: any) => ({ product_id: v.id })), 200)
    // la primera vez sólo se anota el catálogo que ya existe (no se avisa)
    if (primeraVez) return logger.info(`[novedades-push] catálogo inicial anotado (${visibles.length} productos)`)
    const aviso = avisoNovedades(visibles)
    if (!aviso) return
    const n = await pushNovedades(knex, aviso, logger)
    logger.info(`[novedades-push] ${visibles.length} productos nuevos, aviso a ${n} dispositivos`)
  } catch (e) {
    logger.error(`[novedades-push] falló: ${(e as Error).message}`)
  }
}

export const config = { name: "novedades-push", schedule: "10 1 * * *" }
