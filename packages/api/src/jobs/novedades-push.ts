// Diario (7:10 pm de México): "productos nuevos" al celular de quien activó el
// aviso en /mx/novedades o en la portada, con o sin cuenta (lib/push.ts).
// Un solo aviso al día con lo publicado desde el último envío; si no hubo
// nada, no manda. NOVEDADES_PUSH=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { avisoNovedades, pushNovedades } from "../lib/push"

const T_ULTIMO = "hetna_push_novedades"

export default async function novedadesPush(container: MedusaContainer) {
  if (process.env.NOVEDADES_PUSH === "0") return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    if (!(await knex.schema.hasTable(T_ULTIMO))) {
      await knex.schema.createTable(T_ULTIMO, (t: any) => {
        t.integer("id").primary()
        t.timestamp("hasta", { useTz: true }).notNullable()
      })
    }
    const fila = await knex(T_ULTIMO).where({ id: 1 }).first()
    const ahora = new Date()
    // la primera vez, sólo lo del último día (no todo el catálogo)
    const desde = fila?.hasta ? new Date(fila.hasta) : new Date(ahora.getTime() - 24 * 3600_000)
    const nuevos = await knex("product")
      .where({ status: "published" })
      .whereNull("deleted_at")
      .whereNotNull("thumbnail")
      .where("created_at", ">", desde)
      .where("created_at", "<=", ahora)
      .orderBy("created_at", "desc")
      .limit(50)
      .select("title", "handle")
    const aviso = avisoNovedades(nuevos)
    if (aviso) {
      const n = await pushNovedades(knex, aviso, logger)
      logger.info(`[novedades-push] ${nuevos.length} productos nuevos, aviso a ${n} dispositivos`)
    }
    await knex(T_ULTIMO).insert({ id: 1, hasta: ahora }).onConflict("id").merge(["hasta"])
  } catch (e) {
    logger.error(`[novedades-push] falló: ${(e as Error).message}`)
  }
}

export const config = { name: "novedades-push", schedule: "10 1 * * *" }
