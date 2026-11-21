// POST /store/escanear/:id/archivos — el cliente sube su escaneo (STL/OBJ/PLY/3MF/ZIP) o fotos
// multipart: archivo + tipo ("escaneo" | "foto"). Máx. 95 MB por archivo.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { uploadFile } from "../../../../../lib/backblaze"
import { ErrorEscanear, agregarArchivo, avisarEquipo, cargar, vistaCliente } from "../../../../../lib/escanear"
import type { ArchivoSubido } from "../../../../cam-multipart"
import { knexDe } from "../../helpers"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = knexDe(req)
  const s = await cargar(knex, String(req.params.id))
  if (!s || s.customer_id !== req.auth_context.actor_id) return res.status(404).json({ message: "No encontramos esa solicitud." })
  if (["terminada", "cancelada"].includes(s.estado)) return res.status(409).json({ message: "Esta solicitud ya está cerrada." })
  const tipo = String((req.body as any)?.tipo || "") === "foto" ? "foto" : "escaneo"
  const f = (((req as unknown as { files?: ArchivoSubido[] }).files) || [])[0]
  if (!f?.buffer?.length) return res.status(400).json({ message: "Elige un archivo." })
  try {
    const n = await agregarArchivo(knex, s, { tipo, nombre: f.originalname || `archivo.${tipo === "foto" ? "jpg" : "stl"}`, buffer: f.buffer, de: "cliente" }, uploadFile)
    if (tipo === "escaneo") void avisarEquipo(knex, n!, `📎 El cliente subió un escaneo: ${f.originalname} (${(f.buffer.length / 1048576).toFixed(1)} MB)`, req.scope.resolve("logger"))
    res.json({ ok: true, solicitud: vistaCliente(n!) })
  } catch (e) {
    if (e instanceof ErrorEscanear) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
