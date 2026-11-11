import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { codigoPublico } from "../../../../lib/distribuidores"

// GET /api/distribuidor/<código> → { codigo, nombre, dias } o 404.
// Lo usa la página hetnacnc.com/distribuidores/<código>. Público: sólo dice
// si el código vale, de quién es y cuántos días regala.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const c = await codigoPublico(String(req.params.codigo || ""))
    if (!c) return res.status(404).json({ message: "Código no encontrado." })
    res.setHeader("Cache-Control", "public, max-age=300")
    res.json(c)
  } catch (e) {
    req.scope.resolve("logger").warn(`[distribuidor] ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo revisar el código." })
  }
}
