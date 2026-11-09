// GET /admin/hetna-certificaciones?estado=pendiente
// Certificaciones que suben los talleres, para que HETNA las revise
// (Licitaciones 3.0, Fase 3). Cada una trae una liga firmada al archivo.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrls } from "../../../lib/backblaze"
import { T_CERT, TIPOS_CERT, asegurarCertificaciones } from "../../../lib/confianza"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCertificaciones(knex)
  const estado = ["pendiente", "aprobada", "rechazada"].includes(String(req.query.estado)) ? String(req.query.estado) : "pendiente"
  const filas = await knex(`${T_CERT} as c`)
    .join("seller as v", "v.id", "c.seller_id")
    .where("c.estado", estado)
    .orderBy("c.created_at", "asc")
    .limit(200)
    .select("c.*", "v.name as taller", "v.handle")
  const ligas = await getSignedDownloadUrls(filas.map((f: any) => f.archivo_clave).filter(Boolean), 3600).catch(() => new Map<string, string>())
  res.json({
    certificaciones: filas.map((c: any) => ({
      id: c.id,
      taller: c.taller,
      handle: c.handle,
      tipo: TIPOS_CERT[c.tipo] || c.tipo,
      nombre: c.nombre,
      emisor: c.emisor,
      numero: c.numero,
      vigencia: c.vigencia ? new Date(c.vigencia).toISOString().slice(0, 10) : null,
      archivo: c.archivo_nombre,
      url: c.archivo_clave ? ligas.get(c.archivo_clave) || null : null,
      estado: c.estado,
      motivo: c.motivo,
      creada: c.created_at,
    })),
  })
}
