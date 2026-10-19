import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"

import { getUploadTicket } from "../../../../lib/backblaze"

// Entrega un permiso de subida para UNA foto, con la ruta ya decidida de este
// lado.
//
// CUIDADO: el boleto de B2 autoriza a escribir en el bucket completo, no sólo
// en la ruta que va aquí. Por eso esta respuesta NO puede llegar al navegador:
// la consume el servidor del storefront, que recibe el archivo del usuario y
// lo reenvía. Si algún día se expone al cliente, hay que cambiar a URLs
// firmadas por objeto (S3 presign), no dejar pasar esto.
//
// La ruta la arma el servidor con el customer_id: así un taller no puede
// escribir sobre los archivos de otro, aunque mande la llave que quiera.
const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const body = (req.validatedBody || req.body || {}) as Record<string, unknown>

  const contentType = String(body.content_type || "")
  const extension = EXTENSIONES[contentType]
  if (!extension) {
    return res.status(400).json({ message: "Sólo se aceptan fotos JPG, PNG o WebP." })
  }

  // lote agrupa las fotos de un mismo escaneo bajo una carpeta. Lo manda el
  // cliente para que las fotos de una sesión queden juntas, pero se valida:
  // sólo se acepta un uuid, nada que pueda salirse de su carpeta.
  const lote =
    typeof body.lote === "string" && /^[a-f0-9-]{36}$/i.test(body.lote) ? body.lote : randomUUID()

  const storageKey = `escaneos3d/${customerId}/${lote}/${randomUUID()}.${extension}`

  const boleto = await getUploadTicket(storageKey)
  if (!boleto.ok) {
    console.error("[escaneos] no se pudo pedir permiso de subida a B2:", boleto.reason)
    return res.status(502).json({ message: "No se pudo preparar la subida de la foto." })
  }

  res.json({
    lote,
    storage_key: boleto.storageKey,
    upload_url: boleto.uploadUrl,
    token: boleto.token,
  })
}
