// POST /vendor/hetna-solicitudes/:id/hito-foto  (multipart: archivo, clave)
// Foto del avance de un hito (JPG, PNG o WEBP). Va al bucket PRIVADO de B2; el
// cliente la ve con liga firmada desde su pedido.
import { randomBytes } from "crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { uploadFile } from "../../../../../lib/backblaze"
import { revisarArchivo } from "../../../../../lib/archivo-seguro"
import { ErrorHito, agregarFoto, hitosDe } from "../../../../../lib/licitacion-hitos"
import type { ArchivoSubido } from "../../../../cam-multipart"
import { hitosConFotos, pedidoDelTaller } from "../../../../../lib/licitacion-hitos-pedido"

const IMAGEN = /\.(png|jpe?g|webp)$/i

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const r = await pedidoDelTaller(knex, String(req.params.id), sellerId)
  if (!r.ok) return res.status(r.error[0]).json({ message: r.error[1] })

  const cuerpo = (req as unknown as { files?: Record<string, ArchivoSubido[]>; body?: Record<string, unknown> })
  const archivo = (cuerpo.files?.archivo || [])[0]
  const clave = String((cuerpo.body as any)?.clave || "")
  if (!archivo?.buffer?.length) return res.status(400).json({ message: "Elige una foto." })
  const nombre = String((archivo as any).originalname || (archivo as any).nombre || "foto.jpg").replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, "_").slice(0, 120)
  if (!IMAGEN.test(nombre)) return res.status(400).json({ message: "Sube una foto JPG, PNG o WEBP." })
  const revision = await revisarArchivo(archivo.buffer, nombre)
  if (!revision.ok) return res.status(400).json({ message: `No aceptamos "${nombre}": ${revision.motivo}.` })

  await hitosDe(knex, r.s, r.inicio)
  const llave = `avances/${r.s.id}/${clave.replace(/[^a-z_]/g, "")}/${randomBytes(8).toString("hex")}-${nombre.replace(/\s+/g, "_")}`
  const subida = await uploadFile(archivo.buffer, llave)
  if (!subida.ok) {
    req.scope.resolve("logger").error(`[hito-foto] B2 ${sellerId}: ${subida.reason}`)
    return res.status(502).json({ message: "No se pudo guardar la foto. Intenta de nuevo." })
  }
  try {
    await agregarFoto(knex, r.s, clave, { clave: subida.storageKey, nombre })
  } catch (e) {
    if (e instanceof ErrorHito) return res.status(e.status).json({ message: e.message })
    throw e
  }
  res.json({ ok: true, hitos: await hitosConFotos(knex, r.s, r.inicio) })
}
