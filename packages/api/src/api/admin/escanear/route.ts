// GET /admin/escanear?estado= — todas las solicitudes de Escanear (panel interno)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ESTADOS, NOMBRE_ESTADO, NOMBRE_SALIDA, NOMBRE_USO, T_ESCANEAR, aSolicitud, asegurarEscanear, duraciones, folioEscanear } from "../../../lib/escanear"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarEscanear(knex)
  const estado = typeof req.query.estado === "string" && (ESTADOS as readonly string[]).includes(req.query.estado) ? req.query.estado : null
  const q = knex(T_ESCANEAR).orderBy("creado", "desc").limit(300)
  if (estado) q.where({ estado })
  const filas = (await q).map(aSolicitud)
  res.json({
    estados: ESTADOS.map((e) => ({ valor: e, nombre: NOMBRE_ESTADO[e] })),
    usos: NOMBRE_USO,
    salidas: NOMBRE_SALIDA,
    publico: String(process.env.ESCANEAR_PUBLICO || "").toLowerCase() === "on",
    solicitudes: filas.map((s: any) => ({ ...s, folio_texto: folioEscanear(s.folio), nombre_estado: NOMBRE_ESTADO[s.estado as keyof typeof NOMBRE_ESTADO], duraciones: duraciones(s) })),
  })
}
