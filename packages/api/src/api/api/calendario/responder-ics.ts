import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { limitador } from "../../../lib/cotizador-archivos"
import { ErrorSuscripcion } from "../../../lib/cotizador-suscripciones"
import { ipCliente } from "../../../lib/ip-cliente"

// Google, Outlook y el iPhone piden el calendario cada pocas horas: con 120 por hora por IP sobra
const permitido = limitador(120, 3_600_000)

/** Responde un .ics (o un error en texto) para las ligas de calendario. */
export async function responderIcs(req: MedusaRequest, res: MedusaResponse, fn: () => Promise<string>) {
  if (!permitido(ipCliente(req as any))) {
    res.status(429).type("text/plain").send("Demasiadas consultas. Intenta más tarde.")
    return
  }
  try {
    const ics = await fn()
    res.setHeader("Content-Type", "text/calendar; charset=utf-8")
    res.setHeader("Content-Disposition", 'inline; filename="calendario.ics"')
    res.setHeader("Cache-Control", "private, max-age=900")
    res.setHeader("X-Robots-Tag", "noindex")
    res.send(ics)
  } catch (e) {
    if (e instanceof ErrorSuscripcion) {
      res.status(e.status).type("text/plain").send(e.message)
      return
    }
    ;(req.scope.resolve("logger") as any).error(`[calendario] ${(e as Error).message}`)
    res.status(502).type("text/plain").send("No se pudo armar el calendario. Intenta más tarde.")
  }
}

/** La firma puede venir con ".ics" al final. */
export const firmaDe = (v: unknown) => String(v || "").replace(/\.ics$/i, "")
