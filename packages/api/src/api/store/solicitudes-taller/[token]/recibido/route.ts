// POST /store/solicitudes-taller/:token/recibido
// El cliente confirma que tiene su pedido: se cierra el proyecto.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD } from "../../../../../lib/licitacion"
import { avisarLiquidacion } from "../../../../../lib/liquidacion-aviso"
import { asegurarSeguimiento, cambiarEtapa, etapaDe } from "../../../../../lib/seguimiento"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })

  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (etapaDe(s) !== "entregada") {
    return res.status(409).json({ message: "Tu pedido todavía no está marcado como entregado." })
  }

  await cambiarEtapa(knex, s, "cerrada", {
    actor: "cliente",
    nota: "Confirmaste que recibiste tu pedido.",
    extra: { estado: "cerrada" },
    logger,
  })
  res.json({ ok: true })

  // Si cobró HETNA, toca transferirle al taller lo cobrado menos la comisión.
  // Si el cliente pagó directo al taller, sólo es aviso.
  await avisarLiquidacion(knex, s, "El cliente confirmó la entrega de").catch((e) =>
    logger.error(`[recibido] no se pudo avisar la liquidación: ${(e as Error).message}`)
  )
}
