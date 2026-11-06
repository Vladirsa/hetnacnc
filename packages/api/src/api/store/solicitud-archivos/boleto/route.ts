import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomBytes } from "crypto"

import { getUploadTicket } from "../../../../lib/backblaze"
import { EXT_ARCHIVO_SOLICITUD, MAX_MB_ARCHIVO_DIRECTO } from "../../../../lib/licitacion"

// POST /store/solicitud-archivos/boleto  { nombre, tamano, destino? }
//
// Permiso para que el navegador suba UN archivo directo a Backblaze, sin
// pasar por este servidor (así caben modelos de cientos de MB). Devuelve la
// dirección y el token de subida de B2 más la clave que debe usar; el
// formulario después manda esa clave con la solicitud, igual que antes.
// El bucket necesita las reglas CORS (scripts/cors-backblaze.ts).

const nombreSeguro = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-100) || "archivo"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const cuerpo = (req.body || {}) as { nombre?: unknown; tamano?: unknown; destino?: unknown }
  const original = String(cuerpo.nombre || "").slice(0, 200)
  const tamano = Number(cuerpo.tamano)
  if (!original) return res.status(400).json({ message: "Falta el nombre del archivo." })
  const ext = (original.split(".").pop() || "").toLowerCase()
  if (!EXT_ARCHIVO_SOLICITUD.includes(ext)) {
    return res.status(400).json({ message: `Ese tipo de archivo no se acepta. Sube ${EXT_ARCHIVO_SOLICITUD.slice(0, 12).join(", ")}…` })
  }
  if (!Number.isFinite(tamano) || tamano <= 0) return res.status(400).json({ message: "El archivo está vacío." })
  if (tamano > MAX_MB_ARCHIVO_DIRECTO * 1024 * 1024) {
    return res.status(413).json({ message: `El archivo pesa más de ${MAX_MB_ARCHIVO_DIRECTO} MB.` })
  }
  const destino = String(cuerpo.destino || "")
  const carpeta = destino === "taller" ? "talleres" : destino === "envio" ? "envios" : "solicitudes"
  const mes = new Date().toISOString().slice(0, 7)
  const clave = `${carpeta}/${mes}/${randomBytes(12).toString("hex")}/${nombreSeguro(original)}`

  const boleto = await getUploadTicket(clave)
  if (!boleto.ok) {
    logger.error(`[solicitud-archivos/boleto] sin boleto para ${clave}: ${boleto.reason}`)
    return res.status(503).json({ message: "No pudimos preparar la subida. Intenta de nuevo en un momento." })
  }
  return res.status(201).json({
    url: boleto.uploadUrl,
    token: boleto.token,
    // El nombre va codificado por segmento, como lo exige B2
    nombre_b2: clave.split("/").map(encodeURIComponent).join("/"),
    clave,
    nombre: original.slice(0, 120),
    tamano,
    tope_mb: MAX_MB_ARCHIVO_DIRECTO,
  })
}
