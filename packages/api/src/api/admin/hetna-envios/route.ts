import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_ENVIO, asegurarTablasEnvio, evidenciaCompleta, folioEnvio, leerEvidencia } from "../../../lib/envios"

// Envíos HETNA para el panel: los últimos, con su protección y si ya tienen la
// evidencia de medidas y báscula (para pelear un sobrepeso o reclamar la SOS).
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasEnvio(knex)
  const q = (req.query || {}) as Record<string, string>
  let consulta = knex(T_ENVIO).orderBy("created_at", "desc").limit(Math.min(200, Number(q.limit) || 100))
  if (q.estado) consulta = consulta.where({ estado: q.estado })
  const filas = await consulta
  return res.json({
    envios: filas.map((e: any) => {
      const t = typeof e.tarifa === "string" ? JSON.parse(e.tarifa) : e.tarifa
      const ev = leerEvidencia(e.evidencia)
      return {
        folio: folioEnvio(e.folio),
        estado: e.estado,
        precio: Number(e.precio),
        paqueteria: `${t?.paqueteria || ""} ${t?.servicio || ""}`.trim(),
        paquete: e.paquete,
        contenido: e.contenido,
        contenido_estado: e.contenido_estado,
        proteccion_valor: e.proteccion_valor ? Number(e.proteccion_valor) : null,
        proteccion_costo: e.proteccion_costo ? Number(e.proteccion_costo) : null,
        evidencia: ev.length,
        evidencia_completa: evidenciaCompleta(ev),
        created_at: e.created_at,
      }
    }),
  })
}
