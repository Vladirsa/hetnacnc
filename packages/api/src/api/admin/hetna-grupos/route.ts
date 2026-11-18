// Respuesta rápida a publicaciones de grupos de Facebook (lib/respuesta-grupos.ts).
//   POST /admin/hetna-grupos { texto?, imagen? (data URL), ciudad? }
//        -> la IA saca los datos y regresa { datos, liga, comentario, mensaje_taller }
//   POST /admin/hetna-grupos { datos }  -> sólo rearma liga y textos con datos editados
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { armarRespuesta, extraerPieza, leerImagen, normalizar } from "../../../lib/respuesta-grupos"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, any>
  if (b.datos) return res.json(armarRespuesta(normalizar(b.datos)))
  const texto = String(b.texto || "").trim()
  const imagen = leerImagen(b.imagen)
  if (!texto && !imagen) return res.status(400).json({ message: "Pega el texto o la captura de la publicación." })
  try {
    const datos = await extraerPieza({ texto, imagen, ciudad: String(b.ciudad || "") })
    res.json(armarRespuesta(datos))
  } catch (e) {
    req.scope.resolve("logger").warn(`[grupos] la IA falló: ${(e as Error).message}`)
    res.json(armarRespuesta(normalizar({ ciudad: b.ciudad, nota: "La IA falló: llena los datos a mano." })))
  }
}
