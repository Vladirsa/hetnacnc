// Recibe el PDF de un libro del taller y lo sube al bucket PRIVADO de B2
// (libros/<seller_id>/<aleatorio>.pdf). El permiso de B2 nunca sale del
// backend; al navegador sólo vuelve la llave, que luego se manda al publicar.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { uploadFile } from "../../../../lib/backblaze"
import { llaveLibro } from "../../../../lib/publicar-libro"
import type { ArchivoSubido } from "../../../cam-multipart"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as unknown as { seller_context?: { seller_id?: string } }).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })

  const pdf = ((req as unknown as { files?: Record<string, ArchivoSubido[]> }).files?.pdf || [])[0]
  if (!pdf?.buffer?.length) return res.status(400).json({ message: "Elige el archivo PDF." })
  // La firma del archivo, no lo que dice el navegador
  if (pdf.buffer.toString("ascii", 0, 5) !== "%PDF-") {
    return res.status(400).json({ message: "El archivo no es un PDF." })
  }

  const subida = await uploadFile(pdf.buffer, llaveLibro(sellerId), "application/pdf")
  if (!subida.ok) {
    req.scope.resolve("logger").error(`[libros] B2 ${sellerId}: ${subida.reason}`)
    return res.status(502).json({ message: "No se pudo guardar el PDF. Intenta de nuevo." })
  }
  res.json({ storage_key: subida.storageKey, mb: Math.round((pdf.size / 1048576) * 10) / 10 })
}
