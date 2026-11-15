// Liga "confirma tu correo" del taller (lib/alta-taller.ts). Llega desde la
// tienda (/api/app/confirmar-taller), que pinta la página.
//   GET /hooks/alta-taller/confirmar?s=<taller>&e=<vence>&t=<firma>
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { avisarAdmin, firmaConfirmacion, marcarConfirmado, servicioTalleres } from "../../../../lib/alta-taller"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as Record<string, string>
  const id = String(q.s || "")
  let t
  try {
    t = await servicioTalleres(req.scope).retrieveSeller(id)
  } catch {
    return res.status(400).json({ ok: false, motivo: "liga" })
  }
  // La firma incluye el correo al que se mandó la liga: si el taller cambió
  // su correo después, la liga sigue confirmando la cuenta pero no ese correo.
  const firma = firmaConfirmacion(id, String(q.e || ""), String(q.t || ""), t.email)
  if (!firma) return res.status(400).json({ ok: false, motivo: "liga" })
  const primeraVez = await marcarConfirmado(req.scope, id, firma === "correo" ? t.email : null)
  if (primeraVez) {
    req.scope.resolve("logger").info(`[alta-taller] ${t.email} confirmó su correo`)
    if (t.status === "pending_approval") await avisarAdmin(t).catch(() => undefined)
  }
  res.json({ ok: true, aprobado: t.status === "open" })
}
