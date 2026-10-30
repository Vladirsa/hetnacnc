// Evidencia del paquete de un pedido (fotos con la guía pegada y visible).
//   GET  /vendor/hetna-guias/:id/evidencia            -> fotos con ligas firmadas (1 hora)
//   POST /vendor/hetna-guias/:id/evidencia  multipart  { tipo, archivo }
// La foto va al bucket privado (carpeta guias/). Con ella HETNA disputa un
// sobrepeso; sin las 4 obligatorias, el taller no puede comprar otra guía.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomBytes } from "crypto"

import { listaDeArchivos } from "../../../../cam-multipart"
import { getSignedDownloadUrl, uploadFile } from "../../../../../lib/backblaze"
import { EXT_EVIDENCIA, TIPOS_EVIDENCIA, type TipoEvidencia } from "../../../../../lib/envios"
import { ErrorGuia, evidenciaDeGuia, evidenciaGuiaCompleta, guardarEvidenciaGuia } from "../../../../../lib/guias"

const seller = (req: AuthenticatedMedusaRequest) => (req as any).seller_context?.seller_id as string | undefined

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = seller(req)
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    const ev = await evidenciaDeGuia(req.scope, sellerId, req.params.id)
    const fotos: { tipo: string; nombre: string; subido: string; url: string | null }[] = []
    for (const x of ev) {
      const s = await getSignedDownloadUrl(x.clave, 3600)
      fotos.push({ tipo: x.tipo, nombre: x.nombre, subido: x.subido, url: s.ok ? s.url : null })
    }
    res.json({ evidencia: fotos })
  } catch (e) {
    if (e instanceof ErrorGuia) return res.status(e.status).json({ message: e.message })
    throw e
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = seller(req)
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const tipo = String((req.body as Record<string, string> | undefined)?.tipo || "") as TipoEvidencia
  if (!(tipo in TIPOS_EVIDENCIA)) return res.status(400).json({ message: "Tipo de foto no válido." })
  const [archivo] = listaDeArchivos(req as any)
  if (!archivo?.size) return res.status(400).json({ message: "No llegó la foto." })
  const ext = (archivo.originalname.split(".").pop() || "").toLowerCase()
  if (!EXT_EVIDENCIA.includes(ext)) return res.status(400).json({ message: "Sube una foto (JPG, PNG, WEBP o HEIC)." })

  try {
    // Primero se revisa que el pedido sea suyo y ya tenga guía (no se suben fotos de más)
    await evidenciaDeGuia(req.scope, sellerId, req.params.id)
    const clave = `guias/${new Date().toISOString().slice(0, 7)}/${randomBytes(12).toString("hex")}/${tipo}.${ext}`
    const r = await uploadFile(archivo.buffer, clave, archivo.mimetype || "b2/x-auto")
    if (!r.ok) {
      req.scope.resolve("logger").error(`[guias] evidencia ${req.params.id}: ${r.reason}`)
      return res.status(503).json({ message: "No pudimos guardar la foto. Intenta de nuevo en un momento." })
    }
    const ev = await guardarEvidenciaGuia(req.scope, sellerId, req.params.id, {
      tipo,
      clave,
      nombre: archivo.originalname.slice(0, 120),
      tamano: archivo.size,
      subido: new Date().toISOString(),
    })
    res.json({
      ok: true,
      evidencia: ev.map(({ tipo, nombre, subido }) => ({ tipo, nombre, subido })),
      completa: evidenciaGuiaCompleta({ evidencia: ev }),
    })
  } catch (e) {
    if (e instanceof ErrorGuia) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
