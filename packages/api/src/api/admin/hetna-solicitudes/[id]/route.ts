// GET /admin/hetna-solicitudes/:id
// Detalle para el dashboard: historial completo (también las notas internas),
// propuestas, ligas de 1 hora a los archivos del cliente (registradas, ver
// lib/archivo-acceso) y quién ha bajado cada archivo.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { accesosDe, ligaArchivo } from "../../../../lib/archivo-acceso"
import { T_PROPUESTA, T_SOLICITUD, folioTexto } from "../../../../lib/licitacion"
import { NOMBRE_ETAPA, T_EVENTO, asegurarSeguimiento, type Etapa } from "../../../../lib/seguimiento"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })

  const [eventos, propuestas] = await Promise.all([
    knex(T_EVENTO).where({ solicitud_id: s.id }).orderBy("created_at", "asc").select("*"),
    knex(`${T_PROPUESTA} as p`)
      .join("seller as v", "v.id", "p.seller_id")
      .where("p.solicitud_id", s.id)
      .orderBy("p.precio", "asc")
      .select("p.id", "p.precio", "p.dias", "p.incluye_envio", "p.condiciones", "p.estado", "v.name as taller", "v.email as taller_email"),
  ])

  const adminId = String((req as any).auth_context?.actor_id || "admin")
  const archivos: { nombre: string; tamano: number; url: string | null }[] = []
  for (const a of s.trabajo?.archivos || []) {
    archivos.push({ nombre: a.nombre, tamano: a.tamano, url: ligaArchivo({ s: s.id, k: a.clave, a: "hetna", i: adminId }) })
  }
  const accesos = await accesosDe(knex, s.id).catch(() => [])

  res.json({
    folio: folioTexto(s.folio),
    archivos,
    archivos_borrados_en: s.trabajo?.archivos_borrados_en || null,
    accesos: (accesos as any[]).map((x) => ({
      fecha: x.created_at, archivo: x.nombre, quien: x.actor_nombre || x.actor, actor: x.actor, accion: x.accion, ip: x.ip,
    })),
    eventos: (eventos as any[]).map((e) => ({
      fecha: e.created_at,
      etapa: e.etapa,
      etapa_nombre: e.etapa ? NOMBRE_ETAPA[e.etapa as Etapa] || e.etapa : null,
      actor: e.actor,
      nota: e.nota,
      visible_cliente: e.visible_cliente,
    })),
    propuestas: (propuestas as any[]).map((p) => ({ ...p, precio: Number(p.precio) })),
  })
}
