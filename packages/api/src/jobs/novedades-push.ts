// Diario (7:10 pm de México): "productos nuevos" al celular de quien activó el
// aviso en /mx/novedades o en la portada, con o sin cuenta (lib/push.ts).
// Un solo aviso al día con lo que se publicó desde el anterior; si no hubo
// nada, no manda. NOVEDADES_PUSH=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { avisoNovedades, pushNovedades } from "../lib/push"

const T_AVISADOS = "hetna_push_novedades"
const T_ESTADO = "hetna_push_novedades_estado"

export default async function novedadesPush(container: MedusaContainer) {
  if (process.env.NOVEDADES_PUSH === "0") return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    // Los productos ya avisados (por id, no por fecha: un borrador que se publica días después también cuenta)
    // y una marca de "catálogo inicial anotado": hasta tenerla no se avisa nada
    await knex.raw(`CREATE TABLE IF NOT EXISTS ${T_AVISADOS} (product_id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`)
    await knex.raw(`CREATE TABLE IF NOT EXISTS ${T_ESTADO} (id int PRIMARY KEY, iniciado timestamptz NOT NULL)`)
    // lo que se ve en la tienda: publicado, con foto y en algún canal de venta
    const visiblesSQL = `SELECT p.id FROM product p WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.thumbnail IS NOT NULL
      AND EXISTS (SELECT 1 FROM product_sales_channel psc WHERE psc.product_id = p.id AND psc.deleted_at IS NULL)`
    const iniciado = await knex(T_ESTADO).where({ id: 1 }).first()
    if (!iniciado) {
      // primera vez: se anota TODO el catálogo visible (sin límite) y la marca, juntos
      await knex.transaction(async (trx: any) => {
        await trx.raw(`INSERT INTO ${T_AVISADOS} (product_id) ${visiblesSQL} ON CONFLICT DO NOTHING`)
        await trx(T_ESTADO).insert({ id: 1, iniciado: new Date() }).onConflict("id").ignore()
      })
      return logger.info("[novedades-push] catálogo inicial anotado; el primer aviso sale con lo que se publique desde hoy")
    }
    const visibles = await knex("product as p")
      .whereRaw(`p.id IN (${visiblesSQL})`)
      .whereNotExists(knex.select(1).from(T_AVISADOS + " as a").whereRaw("a.product_id = p.id"))
      .orderBy("p.created_at", "desc")
      .limit(500)
      .select("p.id", "p.title", "p.handle")
    if (visibles.length) await knex.batchInsert(T_AVISADOS, visibles.map((v: any) => ({ product_id: v.id })), 200)
    const aviso = avisoNovedades(visibles)
    if (!aviso) return
    const n = await pushNovedades(knex, aviso, logger)
    logger.info(`[novedades-push] ${visibles.length} productos nuevos, aviso a ${n} dispositivos`)
  } catch (e) {
    logger.error(`[novedades-push] falló: ${(e as Error).message}`)
  }
}

export const config = { name: "novedades-push", schedule: "10 1 * * *" }
