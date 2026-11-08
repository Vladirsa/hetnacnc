// POST /vendor/hetna-solicitudes/:id/adjunto  (multipart, campo "archivo")
// Licitaciones 3.0 (Fase 2): el taller adjunta a su propuesta su cotización
// en PDF, planos o fotos. Se guarda en el bucket PRIVADO de B2 y se agrega a
// la lista de adjuntos de su propuesta. El cliente los descarga desde su liga.
//
// DELETE /vendor/hetna-solicitudes/:id/adjunto  { clave }  quita uno.
import { randomBytes } from "crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { uploadFile } from "../../../../../lib/backblaze"
import { T_PROPUESTA, asegurarTablas } from "../../../../../lib/licitacion"
import { type AdjuntoPropuesta, MAX_ADJUNTOS_PROPUESTA, asegurarPropuestaFormal } from "../../../../../lib/licitacion-propuesta"
import type { ArchivoSubido } from "../../../../cam-multipart"

const EXT_OK = /\.(pdf|dxf|dwg|step|stp|stl|svg|png|jpe?g|webp|xlsx?|docx?)$/i

const miPropuesta = async (knex: any, solicitudId: string, sellerId: string) =>
  knex(T_PROPUESTA).where({ solicitud_id: solicitudId, seller_id: sellerId }).first("id", "adjuntos", "estado")

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  await asegurarTablas(knex)
  await asegurarPropuestaFormal(knex)

  const p = await miPropuesta(knex, String(req.params.id), sellerId)
  if (!p) return res.status(409).json({ message: "Primero manda tu propuesta; después adjunta archivos." })
  if (p.estado === "descartada") return res.status(409).json({ message: "Esta propuesta ya no está activa." })
  const actuales: AdjuntoPropuesta[] = Array.isArray(p.adjuntos) ? p.adjuntos : []
  if (actuales.length >= MAX_ADJUNTOS_PROPUESTA) return res.status(400).json({ message: `Máximo ${MAX_ADJUNTOS_PROPUESTA} archivos por propuesta.` })

  const archivo = ((req as unknown as { files?: Record<string, ArchivoSubido[]> }).files?.archivo || [])[0]
  if (!archivo?.buffer?.length) return res.status(400).json({ message: "Elige un archivo." })
  const nombre = String((archivo as any).originalname || (archivo as any).nombre || "archivo").replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, "_").slice(0, 120)
  if (!EXT_OK.test(nombre)) return res.status(400).json({ message: "Sube un PDF, plano (DXF, DWG, STEP, STL, SVG), imagen, Excel o Word." })

  const clave = `propuestas/${String(req.params.id)}/${sellerId}/${randomBytes(8).toString("hex")}-${nombre.replace(/\s+/g, "_")}`
  const subida = await uploadFile(archivo.buffer, clave)
  if (!subida.ok) {
    req.scope.resolve("logger").error(`[propuesta-adjunto] B2 ${sellerId}: ${subida.reason}`)
    return res.status(502).json({ message: "No se pudo guardar el archivo. Intenta de nuevo." })
  }
  const nuevo: AdjuntoPropuesta = { clave: subida.storageKey, nombre, tamano: archivo.buffer.length }
  const lista = [...actuales, nuevo]
  await knex(T_PROPUESTA).where({ id: p.id }).update({ adjuntos: JSON.stringify(lista), updated_at: knex.fn.now() })
  res.json({ ok: true, adjuntos: lista.map((a) => ({ clave: a.clave, nombre: a.nombre, tamano: a.tamano })) })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  await asegurarPropuestaFormal(knex)
  const p = await miPropuesta(knex, String(req.params.id), sellerId)
  if (!p) return res.status(404).json({ message: "No tienes propuesta en esta solicitud." })
  const clave = String(((req.body || {}) as { clave?: string }).clave || "")
  const lista = (Array.isArray(p.adjuntos) ? p.adjuntos : []).filter((a: AdjuntoPropuesta) => a.clave !== clave)
  await knex(T_PROPUESTA).where({ id: p.id }).update({ adjuntos: JSON.stringify(lista), updated_at: knex.fn.now() })
  res.json({ ok: true, adjuntos: lista })
}
