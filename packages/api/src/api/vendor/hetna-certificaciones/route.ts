// Certificaciones acreditadas del taller (Licitaciones 3.0, Fase 3).
//   GET  -> sus certificaciones (con estado) y los tipos disponibles
//   POST (multipart: archivo + tipo, nombre, emisor, numero, vigencia) -> sube una
//        para que HETNA la revise. Plan Gratis: requiere el pago único de
//        verificación ($299); en los planes de pago va incluida.
// Separado de la reputación: una certificación aprobada sube el
// posicionamiento, nunca la calificación.
import { randomBytes } from "crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { uploadFile } from "../../../lib/backblaze"
import { PRECIO_VERIFICACION_GRATIS, T_CERT, TIPOS_CERT, asegurarCertificaciones, debePagarVerificacion } from "../../../lib/confianza"
import { planComision } from "../../../lib/licitacion-cobro"
import type { ArchivoSubido } from "../../cam-multipart"

const corto = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCertificaciones(knex)
  const filas = await knex(T_CERT).where({ seller_id: sellerId }).orderBy("created_at", "desc")
  res.json({
    tipos: TIPOS_CERT,
    certificaciones: filas.map((c: any) => ({
      id: c.id,
      tipo: c.tipo,
      nombre: c.nombre,
      emisor: c.emisor,
      numero: c.numero,
      vigencia: c.vigencia ? new Date(c.vigencia).toISOString().slice(0, 10) : null,
      archivo: c.archivo_nombre,
      estado: c.estado,
      motivo: c.motivo,
    })),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCertificaciones(knex)

  const s = await knex("seller").where({ id: sellerId }).first("id", "email", "metadata")
  const plan = await planComision(s || {}).catch(() => "gratis")
  if (s && debePagarVerificacion(plan, s)) {
    return res.status(402).json({ message: `Con el plan Gratis la revisión de certificaciones requiere el pago único de verificación ($${PRECIO_VERIFICACION_GRATIS}). En los planes de pago va incluida.`, pagar: true })
  }
  const n = await knex(T_CERT).where({ seller_id: sellerId }).count("* as n").first()
  if (Number(n?.n || 0) >= 20) return res.status(400).json({ message: "Máximo 20 certificaciones." })

  const b = (req.body || {}) as Record<string, string>
  const tipo = corto(b.tipo, 30)
  if (!TIPOS_CERT[tipo]) return res.status(400).json({ message: "Elige el tipo de certificación." })
  const vig = corto(b.vigencia, 10)
  const vigencia = /^\d{4}-\d{2}-\d{2}$/.test(vig) ? vig : null
  if (vigencia && new Date(vigencia).getTime() < Date.now() - 86_400_000) return res.status(400).json({ message: "Esa certificación ya venció." })

  const archivo = ((req as unknown as { files?: Record<string, ArchivoSubido[]> }).files?.archivo || [])[0]
  if (!archivo?.buffer?.length) return res.status(400).json({ message: "Sube el certificado (PDF o foto)." })
  const nombreArchivo = String(archivo.originalname || "certificado").replace(/[^\w.\- ]/g, "_").slice(0, 120)
  const esPdf = archivo.buffer.toString("ascii", 0, 5) === "%PDF-"
  const esImg = (archivo.buffer[0] === 0xff && archivo.buffer[1] === 0xd8) || (archivo.buffer[0] === 0x89 && archivo.buffer[1] === 0x50)
  if (!esPdf && !esImg) return res.status(400).json({ message: "Sube el certificado en PDF, JPG o PNG." })

  const id = `cert_${randomBytes(10).toString("hex")}`
  const subida = await uploadFile(archivo.buffer, `certificaciones/${sellerId}/${id}-${nombreArchivo.replace(/\s+/g, "_")}`, esPdf ? "application/pdf" : "b2/x-auto")
  if (!subida.ok) {
    req.scope.resolve("logger").error(`[certificaciones] B2 ${sellerId}: ${subida.reason}`)
    return res.status(502).json({ message: "No se pudo guardar el archivo. Intenta de nuevo." })
  }
  await knex(T_CERT).insert({
    id,
    seller_id: sellerId,
    tipo,
    nombre: corto(b.nombre, 160) || null,
    emisor: corto(b.emisor, 160) || null,
    numero: corto(b.numero, 80) || null,
    vigencia,
    archivo_clave: subida.storageKey,
    archivo_nombre: nombreArchivo,
    estado: "pendiente",
  })
  res.json({ ok: true, id })
}
