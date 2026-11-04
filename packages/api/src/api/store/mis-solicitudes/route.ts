// GET /store/mis-solicitudes  (cliente con sesión)
// Las solicitudes de fabricación del cliente: las que mandó con sesión
// iniciada y las que abrió desde su liga estando dentro de su cuenta.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, folioTexto, ligaPropuestas } from "../../../lib/licitacion"
import { asegurarExtra } from "../../../lib/licitacion-extra"
import { NOMBRE_ETAPA, asegurarSeguimiento, etapaDe } from "../../../lib/seguimiento"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const clienteId = req.auth_context?.actor_id
  if (!clienteId) return res.status(401).json({ message: "Inicia sesión." })
  await asegurarTablas(knex)
  await asegurarSeguimiento(knex)
  await asegurarExtra(knex)

  const filas = (await knex(T_SOLICITUD)
    .where({ cliente_id: clienteId })
    .orderBy("created_at", "desc")
    .limit(100)
    .select("id", "folio", "token", "estado", "etapa", "pago_estado", "trabajo", "created_at", "propuesta_elegida")) as any[]
  const ids = filas.map((f) => f.id)
  const conteos = ids.length
    ? ((await knex(T_PROPUESTA).whereIn("solicitud_id", ids).groupBy("solicitud_id").select("solicitud_id").count("* as n")) as any[])
    : []
  const n = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))
  const elegidas = filas.filter((f) => f.propuesta_elegida).map((f) => f.propuesta_elegida)
  const talleres = elegidas.length
    ? ((await knex(`${T_PROPUESTA} as p`).join("seller as v", "v.id", "p.seller_id").whereIn("p.id", elegidas).select("p.id", "p.precio", "v.name")) as any[])
    : []
  const tallerPor = Object.fromEntries(talleres.map((t) => [t.id, t]))

  return res.json({
    solicitudes: filas.map((f) => {
      const etapa = etapaDe(f, n[f.id] || 0)
      const t = f.propuesta_elegida ? tallerPor[f.propuesta_elegida] : null
      return {
        folio: folioTexto(f.folio),
        liga: ligaPropuestas(f.token),
        etapa,
        etapa_nombre: NOMBRE_ETAPA[etapa],
        resumen: [f.trabajo?.necesidad || f.trabajo?.servicio, f.trabajo?.material, f.trabajo?.cantidad && `${f.trabajo.cantidad} pzas`]
          .filter(Boolean)
          .join(" · ") || String(f.trabajo?.descripcion || "").slice(0, 80),
        propuestas: n[f.id] || 0,
        taller: t ? { nombre: t.name, precio: Number(t.precio) } : null,
        falta_pago: f.estado === "elegida" && f.pago_estado !== "pagado" && f.pago_estado !== "anticipo",
        creada: f.created_at,
      }
    }),
  })
}
