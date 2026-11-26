// Muestra 3D de un servicio (panel > Mis servicios): el diseñador sube un STL
// (o ZIP con STL) y recibe la liga de una versión simplificada para su
// servicio. El original no se guarda. Se publica al guardar sus servicios.
//   POST /vendor/hetna-paquetes/modelo  (multipart: archivo)  -> { url }
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listaDeArchivos } from "../../../cam-multipart"
import { ErrorPaquete, generarModeloPaquete } from "../../../../lib/paquetes-servicio"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const [subido] = listaDeArchivos(req)
  if (!subido) return res.status(400).json({ message: "No llegó ningún archivo." })
  try {
    res.json({ url: await generarModeloPaquete(req.scope, sellerId, subido.buffer) })
  } catch (e) {
    if (e instanceof ErrorPaquete) return res.status(400).json({ message: e.message })
    throw e
  }
}
