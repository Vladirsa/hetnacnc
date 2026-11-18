// Liga "confirma tu correo" del taller (lib/alta-taller.ts). Llega desde la
// tienda (/api/app/confirmar-taller), que pinta la página con el botón.
//   GET  /hooks/alta-taller/confirmar?s=<taller>&e=<vence>&t=<firma>  -> sólo revisa la liga (no cambia nada)
//   POST /hooks/alta-taller/confirmar {s,e,t}                          -> confirma (y aprueba, con alta automática)
// El GET no confirma a propósito: los antivirus del correo abren las ligas
// solos y con eso un taller quedaba confirmado y aprobado con correo ajeno.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { avisarAdmin, avisarAdminAltaAutomatica, firmaConfirmacion, marcarConfirmado, servicioTalleres } from "../../../../lib/alta-taller"
import { altaAutomatica, aprobarTaller } from "../../../../lib/aprobar-taller"

const leer = async (req: MedusaRequest, d: Record<string, unknown>) => {
  const id = String(d.s || "")
  if (!id) return null
  let t
  try {
    t = await servicioTalleres(req.scope).retrieveSeller(id)
  } catch {
    return null
  }
  // La firma incluye el correo al que se mandó la liga: si el taller cambió
  // su correo después, la liga sigue confirmando la cuenta pero no ese correo.
  const firma = firmaConfirmacion(id, String(d.e || ""), String(d.t || ""), t.email)
  return firma ? { id, t, firma } : null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const r = await leer(req, (req.query || {}) as Record<string, unknown>)
  if (!r) return res.status(400).json({ ok: false, motivo: "liga" })
  // "ya" es que este taller abrió antes la liga (no los talleres de antes, que nunca confirmaron)
  res.json({ ok: true, ya: r.t.metadata?.correo_confirmado === true, aprobado: r.t.status === "open" })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const r = await leer(req, (req.body || {}) as Record<string, unknown>)
  if (!r) return res.status(400).json({ ok: false, motivo: "liga" })
  const { id, firma } = r
  let t = r.t
  const primeraVez = await marcarConfirmado(req.scope, id, firma === "correo" ? t.email : null)
  if (primeraVez) {
    req.scope.resolve("logger").info(`[alta-taller] ${t.email} confirmó su correo`)
    if (t.status === "pending_approval") {
      // Alta automática: queda aprobado al confirmar su correo y HETNA lo
      // revisa después. Si algo falla, vuelve a la aprobación manual.
      if (altaAutomatica()) {
        try {
          await aprobarTaller(req.scope, t as any, { automatica: true })
          t = { ...t, status: "open" }
          await avisarAdminAltaAutomatica(t).catch(() => undefined)
        } catch (e) {
          // Dos clics casi juntos (o el antivirus del correo): si ya quedó
          // aprobado por la otra petición, no hay nada que avisar
          const actual = await servicioTalleres(req.scope).retrieveSeller(id).catch(() => null)
          if (actual?.status === "open") {
            t = actual
          } else {
            req.scope.resolve("logger").error(`[alta-taller] no se aprobó solo ${t.email}: ${(e as Error).message}`)
            await avisarAdmin(t).catch(() => undefined)
          }
        }
      } else {
        await avisarAdmin(t).catch(() => undefined)
      }
    }
  }
  res.json({ ok: true, ya: !primeraVez, aprobado: t.status === "open" })
}
