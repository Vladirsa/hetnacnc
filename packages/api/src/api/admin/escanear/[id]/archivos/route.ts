// POST /admin/escanear/:id/archivos — el equipo sube render, modelo rediseñado (o escaneo/fotos en nombre del cliente)
// multipart: archivo + tipo ("render" | "modelo" | "escaneo" | "foto"). Máx. 95 MB.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { uploadFile } from "../../../../../lib/backblaze"
import { ErrorEscanear, TIPOS_ARCHIVO, agregarArchivo, cargar, type TipoArchivo } from "../../../../../lib/escanear"
import type { ArchivoSubido } from "../../../../cam-multipart"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const s = await cargar(knex, String(req.params.id))
  if (!s) return res.status(404).json({ message: "No encontrada." })
  const tipo = String((req.body as any)?.tipo || "") as TipoArchivo
  if (!(TIPOS_ARCHIVO as readonly string[]).includes(tipo)) return res.status(400).json({ message: "Tipo de archivo no válido." })
  const f = (((req as unknown as { files?: ArchivoSubido[] }).files) || [])[0]
  if (!f?.buffer?.length) return res.status(400).json({ message: "Elige un archivo." })
  try {
    const n = await agregarArchivo(knex, s, { tipo, nombre: f.originalname || `archivo`, buffer: f.buffer, de: "equipo" }, uploadFile)
    res.json({ ok: true, solicitud: n })
  } catch (e) {
    if (e instanceof ErrorEscanear) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
