// Botón "Revisar y aprobar" del correo al administrador (lib/alta-taller.ts).
// La tienda (/api/app/aprobar-taller) pinta la página de confirmación:
//   GET  /hooks/alta-taller/aprobar?s=&e=&t=   -> datos del taller (no cambia nada)
//   POST /hooks/alta-taller/aprobar {s,e,t}     -> aprueba
// El GET no aprueba a propósito: los antivirus del correo abren las ligas solos.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import * as flujos from "@mercurjs/core/workflows"

import { avisarAprobado, correoConfirmado, firmaValida, servicioTalleres } from "../../../../lib/alta-taller"

const leer = async (req: MedusaRequest, d: Record<string, unknown>) => {
  const id = String(d.s || "")
  if (!firmaValida("aprobar", id, String(d.e || ""), String(d.t || ""))) return null
  try {
    return await servicioTalleres(req.scope).retrieveSeller(id)
  } catch {
    return null
  }
}

const datos = (t: Awaited<ReturnType<typeof leer>>) => ({
  nombre: t?.name || "",
  correo: t?.email || "",
  telefono: t?.phone || "",
  estado: t?.status || "",
  correo_confirmado: correoConfirmado(t),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const t = await leer(req, (req.query || {}) as Record<string, unknown>)
  if (!t) return res.status(400).json({ ok: false, motivo: "liga" })
  res.json({ ok: true, ...datos(t) })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const t = await leer(req, (req.body || {}) as Record<string, unknown>)
  if (!t) return res.status(400).json({ ok: false, motivo: "liga" })
  if (t.status === "open") return res.json({ ok: true, ya: true, ...datos(t) })
  if (t.status !== "pending_approval") return res.status(409).json({ ok: false, motivo: "estado", ...datos(t) })
  await (flujos as any).approveSellerWorkflow(req.scope).run({ input: { seller_id: t.id } })
  req.scope.resolve("logger").info(`[alta-taller] aprobado ${t.name} (${t.email})`)
  await avisarAprobado(t)
  res.json({ ok: true, ...datos({ ...t, status: "open" }) })
}
