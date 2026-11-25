// Biblioteca de planos (/planos) en redes y por correo.
//   - Todos los días (decisión del dueño, 25 nov 2026: «uno al día»): carrusel
//     en Facebook e Instagram del siguiente plano (los más nuevos primero),
//     programado o como borrador según Configuración.
//   - El correo a suscritos sigue siendo semanal: «plano gratis de la semana»
//     es el que salió en redes el miércoles. Se manda en lotes diarios
//     (PLANOS_AVISO_LOTE, 150 por omisión), respetando las bajas.
//     APAGADO hasta que el dueño ponga PLANOS_AVISO_CORREO=1 en el .env.
// Corre diario a las 10:17 del centro de México (16:17 UTC).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROMO, asegurarPromo, promoPlano } from "../lib/fabrica/promociones"
import { avisarPlano } from "../lib/planos-avisos"

/** Horas mínimas entre dos carruseles de planos (evita dos el mismo día si el job corre dos veces). */
const HORAS_ENTRE_PLANOS = 20

export default async function planosSemanal(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    await asegurarPromo(knex)
    const ultimo = await knex(T_PROMO).where({ tipo: "plano" }).orderBy("created_at", "desc").first("ref", "created_at")
    const horas = ultimo ? (Date.now() - new Date(ultimo.created_at).getTime()) / 3_600_000 : Infinity
    if (horas >= HORAS_ENTRE_PLANOS) await promoPlano(container, logger)

    // Correo semanal: el plano que salió en redes el miércoles (hora del centro de México)
    if (process.env.PLANOS_AVISO_CORREO === "1") {
      const deLaSemana = await knex(T_PROMO)
        .where({ tipo: "plano" })
        .where("created_at", ">=", knex.raw("now() - interval '7 days'"))
        .whereRaw("extract(dow from created_at at time zone 'America/Mexico_City') = 3")
        .orderBy("created_at", "desc")
        .first("ref")
      if (deLaSemana) {
        const r = await avisarPlano(knex, deLaSemana.ref, logger)
        if (r.enviados || r.omitidos) logger.info(`[planos-semanal] aviso ${deLaSemana.ref}: ${r.enviados} enviados, ${r.omitidos} de baja`)
      }
    }
  } catch (e) {
    logger.error(`[planos-semanal] ${(e as Error).message}`)
  }
}

export const config = { name: "planos-semanal", schedule: "17 16 * * *" }
