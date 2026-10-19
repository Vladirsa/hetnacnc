import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_ENVIO_COT, VIGENCIA_HORAS, asegurarTablasEnvio } from "../../../../../lib/envios"

// Una cotización guardada y la tarifa elegida (?t=<tarifa_id>), sin el costo interno.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasEnvio(knex)
  const fila = await knex(T_ENVIO_COT).where({ id: String(req.params.id || "") }).first()
  if (!fila) return res.status(404).json({ message: "Cotización no encontrada. Vuelve a cotizar." })
  const d = typeof fila.datos === "string" ? JSON.parse(fila.datos) : fila.datos
  const t = String((req.query as any)?.t || "")
  const op = d.opciones.find((o: any) => o.tarifa_id === t)
  if (!op) return res.status(404).json({ message: "Esa opción de envío ya no está disponible. Vuelve a cotizar." })
  const vencida = Date.now() - new Date(fila.created_at).getTime() > VIGENCIA_HORAS * 3600_000
  const { costo, peso, ...opcion } = op
  return res.json({ cotizacion_id: fila.id, origen: d.origen, destino: d.destino, paquete: d.paquete, opcion, vencida })
}
