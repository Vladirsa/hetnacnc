// PDF del contrato (?tipo=contrato) o constancia de firmas (?tipo=constancia)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { documentoAcuerdo } from "../../../../../../lib/safedeal"
import { NO_ENCONTRADA, solicitudCliente } from "../../../../../../lib/safedeal-http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudCliente(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const q: any = req.query || {}
  const d: any = await documentoAcuerdo(knex, s, q.tipo === "constancia" ? "constancia" : "contrato", q.version ? Number(q.version) : undefined)
  if (!d) return res.status(404).json({ message: "Todavía no hay contrato generado." })
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${d.nombre}"`)
  res.setHeader("Cache-Control", "private, no-store")
  res.send(Buffer.from(d.bytes))
}
