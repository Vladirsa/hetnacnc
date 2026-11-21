// GET /store/mis-piezas  (cliente con sesión)
// Biblioteca de piezas para "Repetir pedido" (estrategia 2.4): cada solicitud
// anterior del cliente con lo necesario para volver a pedirla en un clic
// (descripción, material, medidas, cantidad, acabado y sus archivos si siguen
// guardados) y, si eligió taller, a quién y en cuánto.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, folioTexto } from "../../../lib/licitacion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const clienteId = req.auth_context?.actor_id
  if (!clienteId) return res.status(401).json({ message: "Inicia sesión." })
  await asegurarTablas(knex)
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .leftJoin(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
    .leftJoin("seller as v", "v.id", "p.seller_id")
    .where("s.cliente_id", clienteId)
    .whereRaw("coalesce(s.tipo, 'fabricacion') <> 'suministro'")
    .orderBy("s.created_at", "desc")
    .limit(200)
    .select("s.folio", "s.trabajo", "s.created_at", "s.etapa", "p.precio", "v.name as taller", "v.handle as taller_handle")
    .catch(async () =>
      knex(`${T_SOLICITUD} as s`)
        .leftJoin(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
        .leftJoin("seller as v", "v.id", "p.seller_id")
        .where("s.cliente_id", clienteId)
        .orderBy("s.created_at", "desc")
        .limit(200)
        .select("s.folio", "s.trabajo", "s.created_at", "s.etapa", "p.precio", "v.name as taller", "v.handle as taller_handle")
    )) as any[]
  res.json({
    piezas: filas.map((f) => {
      const t = f.trabajo || {}
      return {
        folio: folioTexto(f.folio),
        descripcion: String(t.descripcion || ""),
        servicio: t.servicio || "",
        material: t.material || "",
        medidas: t.medidas || "",
        cantidad: t.cantidad || "",
        acabado: t.acabado || "",
        necesidad: t.necesidad || "",
        archivos: (t.archivos || []).map((a: any) => ({ clave: a.clave, nombre: a.nombre, tamano: a.tamano })),
        archivos_borrados: (t.archivos_borrados || []).length,
        medidas_archivo: t.medidas_archivo || "",
        creada: f.created_at,
        etapa: f.etapa || null,
        taller: f.taller ? { nombre: f.taller, handle: f.taller_handle, precio: f.precio != null ? Number(f.precio) : null } : null,
      }
    }),
  })
}
