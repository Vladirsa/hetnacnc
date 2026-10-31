// Revisa una foto en cuanto el taller la sube (antes de publicar), para decirle
// de una vez si no tiene fondo blanco.
//   POST /vendor/hetna-publicar/revisar-foto { url } -> { blanco: true | false | null }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { revisarFoto } from "../../fondo-blanco/middlewares"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (process.env.FONDO_BLANCO_ACTIVO === "false") return res.json({ blanco: true })
  const url = String(((req.body || {}) as { url?: string }).url || "")
  if (!url) return res.status(400).json({ message: "Falta la foto." })
  res.json({ blanco: await revisarFoto(url) })
}
