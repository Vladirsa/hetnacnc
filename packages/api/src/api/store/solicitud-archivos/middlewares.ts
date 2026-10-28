import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"

import { leerMultipart } from "../../cam-multipart"
import { MAX_MB_ARCHIVO_SOLICITUD } from "../../../lib/licitacion"

// La subida es pública (el cliente todavía no tiene cuenta ni folio), así que
// se limita por IP ANTES de leer el cuerpo: así nadie llena el bucket ni
// obliga al servidor a leer cientos de MB.
const POR_HORA = 30
const visitas = new Map<string, number[]>()

function limitarPorIp(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim()
  const ahora = Date.now()
  const lista = (visitas.get(ip) || []).filter((t) => ahora - t < 3600_000)
  if (lista.length >= POR_HORA) {
    res.status(429).json({ message: "Subiste muchos archivos seguidos. Intenta de nuevo en un rato." })
    return
  }
  lista.push(ahora)
  visitas.set(ip, lista)
  // Que el mapa no crezca sin fin con IPs que ya no vuelven.
  if (visitas.size > 5000) {
    for (const [k, v] of visitas) if (!v.some((t) => ahora - t < 3600_000)) visitas.delete(k)
  }
  next()
}

export const storeSolicitudArchivosMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/solicitud-archivos",
    middlewares: [
      limitarPorIp,
      leerMultipart({ campos: { archivo: 1 }, maxMb: MAX_MB_ARCHIVO_SOLICITUD, forma: "lista" }),
    ],
  },
]
