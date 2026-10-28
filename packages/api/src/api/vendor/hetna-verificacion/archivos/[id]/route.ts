// GET    /vendor/hetna-verificacion/archivos/:id -> el archivo (solo el propio taller)
// DELETE /vendor/hetna-verificacion/archivos/:id -> lo quita (antes de enviar o tras un rechazo)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarExpediente, leerExpediente, vistaTaller } from "../../../../../lib/verificacion"
import { borrarArchivo, encabezadosPrivados, leerArchivo } from "../../../../../lib/verificacion-archivos"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const exp = await leerExpediente(req.scope, sellerId)
  const a = exp?.archivos.find((x) => x.id === req.params.id)
  if (!a) return res.status(404).json({ message: "No existe." })
  try {
    const contenido = await leerArchivo(sellerId, a)
    res.set(encabezadosPrivados(a.mime)).send(contenido)
  } catch {
    res.status(404).json({ message: "No se encontró el archivo." })
  }
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const exp = await leerExpediente(req.scope, sellerId)
  const a = exp?.archivos.find((x) => x.id === req.params.id)
  if (!exp || !a) return res.status(404).json({ message: "No existe." })
  if (exp.estado === "en_revision" || exp.estado === "verificado") {
    return res.status(409).json({ message: "No se pueden quitar documentos mientras están en revisión o ya verificados." })
  }
  await borrarArchivo(sellerId, a)
  await guardarExpediente(req.scope, exp.id, {
    archivos: exp.archivos.filter((x) => x.id !== a.id),
    estado: exp.estado === "rechazado" ? "borrador" : exp.estado,
  })
  res.json(vistaTaller(await leerExpediente(req.scope, sellerId)))
}
