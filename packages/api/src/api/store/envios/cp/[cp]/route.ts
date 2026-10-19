import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { buscarCP } from "../../../../../lib/envios"

// Colonias, municipio y estado de un código postal (catálogo de Correos de México).
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cp = String(req.params.cp || "")
  if (!/^\d{5}$/.test(cp)) return res.status(400).json({ message: "El código postal debe tener 5 dígitos." })
  const info = buscarCP(cp)
  if (!info) return res.status(404).json({ message: `No encontramos el código postal ${cp}.` })
  res.setHeader("Cache-Control", "public, max-age=86400")
  return res.json(info)
}
