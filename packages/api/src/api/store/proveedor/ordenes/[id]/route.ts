// POST /store/proveedor/ordenes/:id — el proveedor confirma la orden (con fecha
// de entrega) o avisa que ya la envió. lib/proveedor-panel.ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { actuarSobreOrden } from "../../../../../lib/proveedor-panel"
import { correoConfirmadoDe, listo, responderError } from "../../helpers"

const nota = z.string().trim().max(500).optional()
const Cuerpo = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("confirmar"), fecha_compromiso: z.string().trim().max(10), nota }),
  z.object({ accion: z.literal("enviada"), nota }),
])

export const POST = async (req: AuthenticatedMedusaRequest<z.infer<typeof Cuerpo>>, res: MedusaResponse) => {
  const d = Cuerpo.safeParse(req.body)
  if (!d.success) return res.status(400).json({ message: "Revisa los datos de la confirmación." })
  try {
    const { correo } = await correoConfirmadoDe(req)
    if (!correo) return res.status(403).json({ message: "Confirma tu correo para usar el panel de proveedores." })
    if (!listo()) return res.status(503).json({ message: "El panel de proveedores no está disponible en este momento." })
    const orden = await actuarSobreOrden(correo, req.params.id, d.data)
    res.json({ orden })
  } catch (e) {
    responderError(res, e, "actuar sobre orden")
  }
}
