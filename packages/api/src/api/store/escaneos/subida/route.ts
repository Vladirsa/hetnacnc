import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"

import { uploadFile } from "../../../../lib/backblaze"
import type { ArchivoSubido } from "../../../cam-multipart"

// Recibe UNA foto del escaneo y la sube a B2 desde aquí.
//
// Antes esta ruta entregaba el permiso de subida de B2 para que el storefront
// subiera la foto. Ese permiso autoriza a escribir en el bucket COMPLETO, y la
// ruta se podía llamar directo con una sesión de cliente: cualquiera podía
// sobrescribir archivos de otros (diseños pagados, facturas). Ahora el permiso
// nunca sale del backend: la foto llega aquí y se sube con la ruta que arma el
// servidor (escaneos3d/<customer_id>/...).
const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

// Revisa la firma del archivo, no lo que dice quien lo manda
function tipoReal(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length > 8 && b.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png"
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")
    return "image/webp"
  return null
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const body = (req.body || {}) as Record<string, unknown>
  const foto = ((req as unknown as { files?: Record<string, ArchivoSubido[]> }).files?.foto || [])[0]
  if (!foto?.buffer?.length) {
    return res.status(400).json({ message: "Elige una foto." })
  }

  const contentType = tipoReal(foto.buffer)
  const extension = contentType ? EXTENSIONES[contentType] : undefined
  if (!contentType || !extension) {
    return res.status(400).json({ message: "Sólo se aceptan fotos JPG, PNG o WebP." })
  }

  // lote agrupa las fotos de un mismo escaneo bajo una carpeta. Sólo se acepta
  // un uuid, nada que pueda salirse de su carpeta.
  const lote =
    typeof body.lote === "string" && /^[a-f0-9-]{36}$/i.test(body.lote) ? body.lote : randomUUID()

  const storageKey = `escaneos3d/${customerId}/${lote}/${randomUUID()}.${extension}`

  const subida = await uploadFile(foto.buffer, storageKey, contentType)
  if (!subida.ok) {
    console.error("[escaneos] no se pudo subir la foto a B2:", subida.reason)
    return res.status(502).json({ message: "No se pudo guardar la foto. Intenta de nuevo." })
  }

  res.json({ lote, storage_key: subida.storageKey })
}
