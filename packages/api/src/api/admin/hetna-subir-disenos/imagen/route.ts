// POST /admin/hetna-subir-disenos/imagen (multipart: imagen, modo, contexto?) -> { url, modo }
//   modo: original | fondo_blanco (IA quita el fondo) | escena (IA la pone como pieza real)
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listaDeArchivos } from "../../../cam-multipart"
import { type ModoImagen, prepararImagen } from "../../../../lib/subir-disenos"

const MODOS: ModoImagen[] = ["original", "fondo_blanco", "escena"]

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const [f] = listaDeArchivos(req)
  if (!f || !/^image\/(png|jpe?g|webp)$/.test(f.mimetype)) return res.status(400).json({ message: "Sube una imagen JPG, PNG o WebP." })
  const b = (req.body || {}) as Record<string, string>
  const modo = MODOS.includes(b.modo as ModoImagen) ? (b.modo as ModoImagen) : "original"
  try {
    res.json(await prepararImagen(req.scope, f.buffer, f.originalname, modo, String(b.contexto || "")))
  } catch (e) {
    req.scope.resolve("logger").warn(`[subir-disenos] imagen ${modo}: ${(e as Error).message}`)
    res.status(400).json({ message: (e as Error).message })
  }
}
