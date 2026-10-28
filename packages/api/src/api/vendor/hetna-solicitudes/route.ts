import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, folioTexto, ocultarContacto } from "../../../lib/licitacion"

// Panel del taller: solicitudes que puede cotizar (abiertas + las dirigidas a él)
// y las que ya cotizó. Nunca incluye datos de contacto del cliente.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  // Filtros del panel: por servicio y por estado de entrega. Sólo acotan lo
  // que está por cotizar; lo que el taller ya cotizó sale siempre.
  const servicio = String(req.query.servicio || "").trim().slice(0, 80)
  const estadoMx = String(req.query.estado_mx || "").trim().slice(0, 60)

  await asegurarTablas(knex)
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .leftJoin(`${T_PROPUESTA} as p`, function (this: any) {
      this.on("p.solicitud_id", "=", "s.id").andOn("p.seller_id", "=", knex.raw("?", [sellerId]))
    })
    .where((q: any) =>
      q
        .where((a: any) => a.where("s.modo", "abierta").orWhere("s.taller_id", sellerId))
        // Por cotizar = abierta y sin pasar su fecha de cierre (ver
        // recibePropuestas). Lo ya cotizado se ve siempre, aunque haya cerrado.
        .andWhere((a: any) =>
          a
            .where((x: any) =>
              x
                .where("s.estado", "abierta")
                .andWhere((c: any) => c.whereNull("s.cierra_en").orWhere("s.cierra_en", ">", knex.fn.now()))
                .modify((c: any) => {
                  if (servicio) c.whereRaw("s.trabajo->>'servicio' = ?", [servicio])
                  if (estadoMx) c.whereRaw("s.trabajo->>'estado_mx' = ?", [estadoMx])
                })
            )
            .orWhereNotNull("p.id")
        )
    )
    .orderBy("s.created_at", "desc")
    .limit(100)
    .select(
      "s.id", "s.folio", "s.modo", "s.taller_id", "s.estado", "s.trabajo", "s.cierra_en", "s.created_at",
      "p.id as p_id", "p.precio", "p.dias", "p.vigencia_dias", "p.incluye_envio", "p.condiciones", "p.estado as p_estado"
    )) as any[]

  const conteos = (await knex(T_PROPUESTA)
    .whereIn("solicitud_id", filas.map((f) => f.id))
    .groupBy("solicitud_id")
    .select("solicitud_id")
    .count("* as n")) as { solicitud_id: string; n: string }[]
  const nPorSol = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))

  const solicitudes = filas.map((f) => ({
    id: f.id,
    folio: folioTexto(f.folio),
    para_mi: f.taller_id === sellerId,
    estado: f.estado,
    cierra_en: f.cierra_en,
    creada: f.created_at,
    trabajo: { ...f.trabajo, descripcion: ocultarContacto(f.trabajo?.descripcion || "") },
    propuestas_recibidas: nPorSol[f.id] || 0,
    mi_propuesta: f.p_id
      ? {
          id: f.p_id,
          precio: Number(f.precio),
          dias: f.dias,
          vigencia_dias: f.vigencia_dias,
          incluye_envio: f.incluye_envio === "si",
          condiciones: f.condiciones || "",
          estado: f.p_estado,
        }
      : null,
  }))

  return res.json({ solicitudes })
}
