// Comprobante de entrega (PDF) de una compra digital del cliente.
//   GET /store/customers/me/descargas/comprobante/:orderId
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CONTACTO_HETNA, ligaMisDescargas } from "../../../../../../../lib/digital-delivery"
import { STORE_URL } from "../../../../../../../lib/licitacion"
import { archivosDeOrden } from "../../../../../../../lib/mis-descargas"
import { generarPdfEntrega } from "../../../../../../../lib/pdf-entrega"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const datos = await archivosDeOrden(req.scope, req.auth_context.actor_id, String(req.params.orderId))
  if (!datos) return res.status(404).json({ message: "Esa compra no tiene archivos digitales en tu cuenta." })
  const pdf = await generarPdfEntrega({
    display_id: datos.orden.display_id,
    fecha: new Date(datos.orden.created_at),
    correo: datos.orden.email,
    archivos: datos.archivos,
    liga_descargas: ligaMisDescargas(),
    liga_terminos: `${STORE_URL}/mx/terminos-y-condiciones`,
    contacto: CONTACTO_HETNA,
  })
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="HETNA-entrega-pedido-${datos.orden.display_id}.pdf"`)
  res.setHeader("Cache-Control", "private, no-store")
  res.send(Buffer.from(pdf))
}
