import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorFoto, frenoFotos, hayIaFotos, leerPiezaDeFoto, MEDIOS_FOTO, type MedioFoto } from "../../../lib/solicitud-foto-ia"

// POST /store/solicitud-foto { imagen: base64, medio: "image/jpeg", texto? }
// → la solicitud llenada por la IA desde una foto o un boceto (lib/solicitud-foto-ia.ts).
// La tienda manda la imagen ya reducida (≈1600 px); aquí se acepta hasta ~5 MB.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  try {
    if (!hayIaFotos()) throw new ErrorFoto("La lectura con IA no está disponible por ahora. Llena la solicitud a mano.", 503)
    const b: any = req.body || {}
    const imagen = String(b.imagen || "").replace(/^data:[^,]+,/, "")
    const medio = String(b.medio || "") as MedioFoto
    if (!(MEDIOS_FOTO as readonly string[]).includes(medio)) throw new ErrorFoto("Sube una foto JPG, PNG o WebP.")
    if (imagen.length < 1000) throw new ErrorFoto("La imagen llegó vacía.")
    if (imagen.length > 7_000_000) throw new ErrorFoto("La imagen es muy grande (máx. 5 MB).")
    const ip = String(req.headers["x-real-ip"] || req.headers["cf-connecting-ip"] || req.ip || "?")
    const freno = frenoFotos(ip)
    if (freno) throw new ErrorFoto(freno, 429)
    const lectura = await leerPiezaDeFoto(imagen, medio, typeof b.texto === "string" ? b.texto : undefined)
    res.json(lectura)
  } catch (e) {
    if (e instanceof ErrorFoto) return res.status(e.status).json({ message: e.message })
    logger.warn(`[solicitud-foto] ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo leer la foto. Llena la solicitud a mano." })
  }
}
