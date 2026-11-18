// POST /admin/hetna-conta/descarga  { accion: "anio", anio } | { accion: "revisar" }
// "anio": pide al SAT todo el año, mes por mes. "revisar": descarga lo que ya esté listo.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna } from "../../../../lib/conta/almacen"
import { ErrorEfirma } from "../../../../lib/conta/efirma"
import { avanzar, pedirAnio } from "../../../../lib/conta/descarga"

export const POST = async (req: AuthenticatedMedusaRequest<{ accion?: string; anio?: number }>, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC." })
  const b = (req.body || {}) as any
  try {
    if (b.accion === "anio") {
      const anio = Number(b.anio) || new Date().getFullYear()
      const r = await pedirAnio(knex, ctb, anio)
      const mal = r.find((x) => !x.ok)
      return res.json({ ok: !mal, solicitudes: r.filter((x) => x.ok).length, mensaje: mal?.mensaje || null })
    }
    res.json({ ok: true, ...(await avanzar(knex, ctb, logger)) })
  } catch (e) {
    if (e instanceof ErrorEfirma) return res.status(e.status).json({ message: e.message })
    res.status(502).json({ message: `No se pudo hablar con el SAT: ${(e as Error).message}` })
  }
}
