import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correosEnviados, correrCorreosCotizador, panelVentas } from "../../../lib/cotizador-crm"
import { supabaseListo } from "../../../lib/cotizador-suscripciones"

// Panel "Cotizador" del dashboard: talleres registrados, en prueba, en Gratis
// y pagando; ingreso mensual; a quién hablarle esta semana; y los correos
// automáticos que ya salieron (y los que saldrían hoy, sin mandarlos).
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!supabaseListo())
    return res.status(503).json({ message: "Falta COTIZADOR_SUPABASE_SERVICE_KEY en el .env de packages/api." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  try {
    const [panel, enviados, hoy] = await Promise.all([
      panelVentas(),
      correosEnviados(knex),
      correrCorreosCotizador(knex, logger, { simular: true }),
    ])
    return res.json({ ...panel, correos: { enviados, hoy } })
  } catch (e) {
    return res.status(502).json({ message: `No se pudo leer la base del Cotizador: ${(e as Error).message}` })
  }
}
