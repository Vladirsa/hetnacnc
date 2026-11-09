// POST /admin/hetna-fabrica/video (multipart: archivo + mercado, publico, voz)
// Tu video grabado se guarda en el B2 privado (el permiso de subida nunca sale
// del servidor) y se crea el trabajo: subtítulos + 5 cortos con RunPod.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { uploadFile } from "../../../../lib/backblaze"
import { crearTrabajo } from "../../../../lib/fabrica"
import { nuevoId } from "../../../../lib/licitacion"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const archivo = ((req as any).files?.archivo || [])[0]
  if (!archivo?.buffer?.length) return res.status(400).json({ message: "Sube un video." })
  const b = archivo.buffer as Buffer
  const esVideo = b.toString("ascii", 4, 8) === "ftyp" || (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
  if (!esVideo) return res.status(400).json({ message: "Formato no válido: sube MP4, MOV o WebM." })
  const ext = b.toString("ascii", 8, 10) === "qt" ? "mov" : b[0] === 0x1a ? "webm" : "mp4"
  const clave = `fabrica/videos/${nuevoId("vid")}.${ext}`
  const r = await uploadFile(b, clave, ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4")
  if (!r.ok) return res.status(502).json({ message: `No se pudo guardar el video: ${r.reason}` })
  try {
    const body: any = req.body || {}
    const id = await crearTrabajo(req.scope, { video_clave: clave, mercado: body.mercado, publico: body.publico, voz: body.voz }, req.scope.resolve("logger"))
    res.json({ ok: true, id })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status || 500).json({ message: err.message })
  }
}
