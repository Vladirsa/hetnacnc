import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { limitador } from "../../../lib/cotizador-archivos"
import { ipCliente } from "../../../lib/ip-cliente"
import { disponible, ErrorRelieve, profundidad } from "../../../lib/relieve-ia/servicio"

// Profundidad con IA para el generador de relieves (lib/relieve-ia/servicio.ts).
// GET  https://hetnacnc.com/api/relieve-ia  -> { disponible }
// POST multipart: ancho, alto (múltiplos de 14) y "rgb" (ancho×alto×3 bytes, RGB intercalado)
//      -> binario Uint16 little-endian (cerca = 65535), con cabeceras X-Ancho y X-Alto.
// Sin sesión. La foto no se guarda.
const permitido = limitador(20, 3_600_000) // 20 fotos por hora por IP

export const GET = (_req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "no-store")
  res.json({ disponible: disponible() })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    if (!permitido(ipCliente(req as any))) throw new ErrorRelieve(429, "Ya procesaste varias fotos. Intenta de nuevo en una hora.")
    const campos = (req.body || {}) as Record<string, any>
    const archivo = (((req as any).files || {}) as Record<string, any[]>).rgb?.[0]
    if (!archivo?.buffer) throw new ErrorRelieve(400, "Falta la imagen.")
    const r = await profundidad(Number(campos.ancho), Number(campos.alto), new Uint8Array(archivo.buffer))
    res.setHeader("Content-Type", "application/octet-stream")
    res.setHeader("Cache-Control", "no-store")
    res.setHeader("X-Ancho", String(r.ancho))
    res.setHeader("X-Alto", String(r.alto))
    res.send(Buffer.from(r.profundidad.buffer, r.profundidad.byteOffset, r.profundidad.byteLength))
  } catch (e) {
    if (e instanceof ErrorRelieve) {
      res.status(e.status).json({ error: e.message })
      return
    }
    ;(req.scope.resolve("logger") as any).error(`[relieve-ia] ${(e as Error).message}`)
    res.status(500).json({ error: "No se pudo procesar la foto. Intenta de nuevo." })
  }
}
