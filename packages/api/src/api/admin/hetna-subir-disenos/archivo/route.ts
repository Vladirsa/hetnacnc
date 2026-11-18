// POST /admin/hetna-subir-disenos/archivo (multipart: archivo, sku?) -> { sku, storage_key, formato, nombre }
// El archivo del diseño va al bucket PRIVADO: sólo se entrega con liga firmada al comprador.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listaDeArchivos } from "../../../cam-multipart"
import { guardarArchivo } from "../../../../lib/subir-disenos"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const [f] = listaDeArchivos(req)
  if (!f) return res.status(400).json({ message: "No llegó el archivo." })
  try {
    res.json(await guardarArchivo(f.buffer, f.originalname, String((req.body as any)?.sku || "")))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
