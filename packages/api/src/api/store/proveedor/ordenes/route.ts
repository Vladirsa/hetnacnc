// GET /store/proveedor/ordenes — órdenes de compra que los talleres le mandaron
// al proveedor con sesión (identificado por su correo confirmado). lib/proveedor-panel.ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ordenesDeProveedor } from "../../../../lib/proveedor-panel"
import { correoConfirmadoDe, listo, responderError } from "../helpers"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    const { correo, email } = await correoConfirmadoDe(req)
    if (!correo) return res.json({ correo: email, correo_confirmado: false, es_proveedor: false, acciones_activas: false, ordenes: [] })
    if (!listo()) return res.json({ correo, correo_confirmado: true, es_proveedor: false, acciones_activas: false, ordenes: [] })
    res.json({ correo, correo_confirmado: true, ...(await ordenesDeProveedor(correo)) })
  } catch (e) {
    responderError(res, e, "leer órdenes")
  }
}
