// Plano gratis de la semana (Biblioteca de planos, /planos).
//   - Miércoles: carrusel en Facebook e Instagram del siguiente plano (los más
//     nuevos primero), programado o como borrador según Configuración.
//   - Todos los días: aviso por correo de ese plano a los suscritos que faltan,
//     en lotes (PLANOS_AVISO_LOTE, 150 por omisión), respetando las bajas.
//     APAGADO hasta que el dueño ponga PLANOS_AVISO_CORREO=1 en el .env.
// Corre diario a las 10:17 del centro de México (16:17 UTC) para que, si un
// miércoles falla, lo recupere al día siguiente.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROMO, asegurarPromo, promoPlano } from "../lib/fabrica/promociones"
import { avisarPlano } from "../lib/planos-avisos"

export default async function planosSemanal(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    await asegurarPromo(knex)
    const dia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getDay()
    let ultimo = await knex(T_PROMO).where({ tipo: "plano" }).orderBy("created_at", "desc").first("ref", "created_at")
    const dias = ultimo ? (Date.now() - new Date(ultimo.created_at).getTime()) / 86_400_000 : Infinity
    // miércoles (o después, si el miércoles no salió) y nada en los últimos 6 días
    if (dias > 6 && ([3, 4, 5].includes(dia) || !ultimo)) {
      const r = await promoPlano(container, logger)
      if (r) ultimo = { ref: r.slug, created_at: new Date() }
    }
    // el aviso por correo es del plano de esta semana
    if (process.env.PLANOS_AVISO_CORREO === "1" && ultimo && (Date.now() - new Date(ultimo.created_at).getTime()) / 86_400_000 <= 7) {
      const r = await avisarPlano(knex, ultimo.ref, logger)
      if (r.enviados || r.omitidos) logger.info(`[planos-semanal] aviso ${ultimo.ref}: ${r.enviados} enviados, ${r.omitidos} de baja`)
    }
  } catch (e) {
    logger.error(`[planos-semanal] ${(e as Error).message}`)
  }
}

export const config = { name: "planos-semanal", schedule: "17 16 * * *" }
