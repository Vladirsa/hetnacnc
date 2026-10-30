// El taller no puede emitir la factura (datos fiscales que no coinciden con el SAT, etc.)
//   POST /vendor/hetna-facturas/:id/rechazar { nota }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_FACTURA, asegurarTablaFacturas, avisarCliente } from "../../../../../lib/facturas"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const nota = String((req.body as any)?.nota || "").trim().slice(0, 300)
  if (nota.length < 5) return res.status(400).json({ message: "Dile al cliente por qué no se puede emitir." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaFacturas(knex)
  const f = await knex(T_FACTURA).where({ id: String(req.params.id), seller_id: sellerId }).first()
  if (!f) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (f.estado !== "solicitada")
    return res.status(400).json({ message: f.estado === "emitida" ? "Esta factura ya está emitida." : "Esta solicitud ya fue rechazada." })
  await knex(T_FACTURA).where({ id: f.id }).update({ estado: "rechazada", nota, updated_at: knex.fn.now() })
  const fiscal = typeof f.fiscal === "string" ? JSON.parse(f.fiscal) : f.fiscal
  await avisarCliente(knex, { ...f, fiscal, estado: "rechazada", nota })
  res.json({ ok: true })
}
