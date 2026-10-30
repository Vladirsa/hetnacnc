// Compra la guía cotizada (cobra del saldo de Skydropx de HETNA), marca el
// pedido como enviado y avisa al cliente. Exige { acepta: true }: el taller
// confirma medidas y peso, acepta pagar el sobrepeso y subir la evidencia.
//   POST /vendor/hetna-guias/:id/comprar
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { comprarGuia, ErrorGuia } from "../../../../../lib/guias"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    const fila = await comprarGuia(req.scope, sellerId, req.params.id, (req.body as any)?.acepta === true)
    res.json({
      guia: fila
        ? {
            estado: fila.estado,
            guia: fila.guia,
            paqueteria: fila.paqueteria,
            costo: fila.costo != null ? Number(fila.costo) : null,
            tiene_etiqueta: Boolean(fila.etiqueta_url),
            error: fila.error,
          }
        : null,
    })
  } catch (e) {
    if (e instanceof ErrorGuia) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").error(`[guias] comprar ${req.params.id}: ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo generar la guía. Revisa en unos minutos antes de reintentar." })
  }
}
