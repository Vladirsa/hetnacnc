// GET /api/planos-redes/[slug]/[n] → PNG de la lámina n (1 a 4) del carrusel de
// un plano (lib/planos-imagen.ts). Lo usa el correo "plano de la semana".
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { cargarNombresPlanos } from "../../../../../lib/planos-correo"
import { laminaValida, pngLaminaPlano } from "../../../../../lib/planos-imagen"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const slug = String(req.params.slug || "")
  const n = Number(req.params.n)
  await cargarNombresPlanos(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION))
  if (!laminaValida(slug, n)) return res.status(404).json({ message: "No existe" })
  try {
    const png = await pngLaminaPlano(slug, n)
    res.setHeader("Content-Type", "image/png")
    res.setHeader("Cache-Control", "public, max-age=86400")
    res.status(200).send(png)
  } catch (e) {
    req.scope.resolve("logger").warn(`[planos-redes] ${slug}/${n}: ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo generar la imagen" })
  }
}
