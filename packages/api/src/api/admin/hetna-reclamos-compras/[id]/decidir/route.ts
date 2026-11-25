// HETNA decide un reclamo de compra.
//   POST /admin/hetna-reclamos-compras/:id/decidir
//     { decision: liberar|reembolso_total|reembolso_parcial, monto?, guia_paga: taller|cliente, costo_guia?, nota }
// El reembolso al cliente se hace a mano en Mercado Pago o PayPal; aquí se mueve
// el saldo del taller (y se le descuenta si ya se le había pagado) y se avisa.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { avisarDecision } from "../../../../../lib/reclamos-correos"
import { ErrorReclamo, decidirReclamo } from "../../../../../lib/reclamos-pedido"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  try {
    const { reclamo, calc, saldo } = await decidirReclamo(req.scope, {
      id: String(req.params.id || ""),
      decision: b.decision,
      monto: b.monto,
      guiaPaga: b.guia_paga,
      costoGuia: b.costo_guia,
      nota: b.nota,
      adminId: req.auth_context?.actor_id || null,
    })
    res.json({ ok: true, descontado_taller: calc.descuento, reembolso: calc.monto })
    await avisarDecision(req.scope, reclamo, saldo).catch(() => undefined)
  } catch (e) {
    if (e instanceof ErrorReclamo) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
