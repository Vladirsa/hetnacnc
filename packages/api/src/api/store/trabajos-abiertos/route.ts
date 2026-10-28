import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, trabajoPublico } from "../../../lib/licitacion"

// Tablero público de trabajos abiertos: las solicitudes de licitación que
// todavía reciben propuestas, sin datos del cliente.
//
// Le sirve a los dos lados. Al cliente le enseña que hay movimiento real y que
// los talleres sí contestan; al taller le enseña trabajo esperando su precio,
// que es la mejor razón para registrarse. Y cada trabajo tiene su página, que
// Google indexa.
//
// Sólo modo "abierta": una solicitud directa es entre el cliente y un taller.
//
// GET /store/trabajos-abiertos?servicio=&estado_mx=&limit=&offset=
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablas(knex)

  const servicio = String(req.query.servicio || "").trim().slice(0, 80)
  const estadoMx = String(req.query.estado_mx || "").trim().slice(0, 60)
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60)
  const offset = Math.max(Number(req.query.offset) || 0, 0)

  const base = () =>
    knex(T_SOLICITUD)
      .where({ modo: "abierta", estado: "abierta" })
      .where((q: any) => q.whereNull("cierra_en").orWhere("cierra_en", ">", knex.fn.now()))
      .modify((q: any) => {
        if (servicio) q.whereRaw("trabajo->>'servicio' = ?", [servicio])
        if (estadoMx) q.whereRaw("trabajo->>'estado_mx' = ?", [estadoMx])
      })

  const [{ n }] = (await base().count("* as n")) as { n: string }[]
  const filas = (await base()
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset)
    .select("id", "folio", "estado", "trabajo", "cierra_en", "created_at")) as any[]

  const conteos = filas.length
    ? ((await knex(T_PROPUESTA)
        .whereIn("solicitud_id", filas.map((f) => f.id))
        .groupBy("solicitud_id")
        .select("solicitud_id")
        .count("* as n")) as { solicitud_id: string; n: string }[])
    : []
  const nPorSol = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))

  res.json({
    trabajos: filas.map((f) => trabajoPublico({ ...f, propuestas: nPorSol[f.id] || 0 })),
    total: Number(n) || 0,
    limit,
    offset,
  })
}
