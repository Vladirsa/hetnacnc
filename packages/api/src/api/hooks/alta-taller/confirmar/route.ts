// Liga "confirma tu correo" del taller (lib/alta-taller.ts). Llega desde la
// tienda (/api/app/confirmar-taller), que pinta la página.
//   GET /hooks/alta-taller/confirmar?s=<taller>&e=<vence>&t=<firma>
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { avisarAdmin, firmaValida, marcarConfirmado, servicioTalleres } from "../../../../lib/alta-taller"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as Record<string, string>
  const id = String(q.s || "")
  if (!firmaValida("confirmar", id, String(q.e || ""), String(q.t || ""))) {
    return res.status(400).json({ ok: false, motivo: "liga" })
  }
  let t
  try {
    t = await servicioTalleres(req.scope).retrieveSeller(id)
  } catch {
    return res.status(404).json({ ok: false, motivo: "taller" })
  }
  const primeraVez = await marcarConfirmado(req.scope, id)
  if (primeraVez) {
    req.scope.resolve("logger").info(`[alta-taller] ${t.email} confirmó su correo`)
    if (t.status === "pending_approval") await avisarAdmin(t).catch(() => undefined)
  }
  res.json({ ok: true, aprobado: t.status === "open" })
}
