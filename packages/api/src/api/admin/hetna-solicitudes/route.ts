// GET /admin/hetna-solicitudes?etapa=en_revision
// Las solicitudes de fabricación para el dashboard de HETNA, con contacto
// completo (esto sólo lo ve el administrador) y su seguimiento.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, folioTexto, ligaPropuestas } from "../../../lib/licitacion"
import { ETAPAS, NOMBRE_ETAPA, asegurarSeguimiento, etapaDe } from "../../../lib/seguimiento"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSeguimiento(knex)
  const etapa = String(req.query.etapa || "")

  const filas = (await knex(T_SOLICITUD)
    .modify((q: any) => {
      if (!(ETAPAS as readonly string[]).includes(etapa)) return
      // Las de antes de existir la columna se deducen del estado.
      if (etapa === "en_revision") q.where((w: any) => w.where({ etapa }).orWhere({ estado: "revision" }))
      else q.where({ etapa })
    })
    .orderBy("created_at", "desc")
    .limit(200)
    .select("*")) as any[]

  const conteos = (await knex(T_PROPUESTA)
    .whereIn("solicitud_id", filas.map((f) => f.id))
    .groupBy("solicitud_id")
    .select("solicitud_id")
    .count("* as n")) as { solicitud_id: string; n: string }[]
  const nPor = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))

  // Cuántas hay en cada etapa, para las pestañas.
  const porEtapa = (await knex(T_SOLICITUD).groupBy("etapa").select("etapa").count("* as n")) as {
    etapa: string | null
    n: string
  }[]

  res.json({
    totales: Object.fromEntries(porEtapa.map((e) => [e.etapa || "sin_etapa", Number(e.n)])),
    solicitudes: filas.map((s) => {
      const e = etapaDe(s, nPor[s.id] || 0)
      return {
        id: s.id,
        folio: folioTexto(s.folio),
        modo: s.modo,
        estado: s.estado,
        etapa: e,
        etapa_nombre: NOMBRE_ETAPA[e],
        etapa_desde: s.etapa_desde || s.updated_at,
        creada: s.created_at,
        cierra_en: s.cierra_en,
        trabajo: { ...s.trabajo, archivos: (s.trabajo?.archivos || []).map((a: any) => ({ nombre: a.nombre, tamano: a.tamano })) },
        contacto: s.contacto,
        propuestas: nPor[s.id] || 0,
        pago_estado: s.pago_estado,
        pago_monto: s.pago_monto ? Number(s.pago_monto) : null,
        paqueteria: s.paqueteria,
        guia: s.guia,
        liga_cliente: ligaPropuestas(s.token),
      }
    }),
  })
}
