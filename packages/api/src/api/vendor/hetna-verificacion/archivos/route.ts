// POST /vendor/hetna-verificacion/archivos  (multipart: archivo + tipo)
// Guarda un documento en la carpeta privada y lo agrega al expediente.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listaDeArchivos } from "../../../cam-multipart"
import { expedienteOCrear, guardarExpediente, leerExpediente, vistaTaller } from "../../../../lib/verificacion"
import { esTipo, guardarArchivo, TIPOS } from "../../../../lib/verificacion-archivos"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  const tipo = (req.body as Record<string, unknown> | undefined)?.tipo
  if (!esTipo(tipo)) return res.status(400).json({ message: "Tipo de documento no válido." })
  const [subido] = listaDeArchivos(req)
  if (!subido) return res.status(400).json({ message: "No llegó ningún archivo." })

  const exp = await expedienteOCrear(req.scope, sellerId)
  if (exp.estado === "en_revision") {
    return res.status(409).json({ message: "Tus documentos están en revisión. Espera la respuesta para cambiarlos." })
  }
  if (exp.estado === "verificado") {
    return res.status(409).json({ message: "Tu taller ya está verificado." })
  }
  if (exp.archivos.filter((a) => a.tipo === tipo).length >= TIPOS[tipo].max) {
    return res.status(400).json({ message: `Ya subiste el máximo para "${TIPOS[tipo].nombre}". Quita uno para cambiarlo.` })
  }

  let nuevo
  try {
    nuevo = await guardarArchivo(sellerId, tipo, subido.buffer)
  } catch (e) {
    return res.status(400).json({ message: (e as Error).message })
  }
  await guardarExpediente(req.scope, exp.id, {
    archivos: [...exp.archivos, nuevo],
    // Si lo habían rechazado, al cambiar documentos vuelve a borrador para reenviarlo
    estado: exp.estado === "rechazado" ? "borrador" : exp.estado,
  })
  res.json(vistaTaller(await leerExpediente(req.scope, sellerId)))
}
