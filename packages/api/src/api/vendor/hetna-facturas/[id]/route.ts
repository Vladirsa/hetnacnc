// Subir la factura (CFDI) de un pedido: PDF y XML.
//   POST /vendor/hetna-facturas/:id  multipart { pdf, xml }
// Se guardan en el bucket privado (carpeta facturas/) y se le avisa al cliente.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { randomBytes } from "crypto"

import { archivosDe } from "../../../cam-multipart"
import { uploadFile } from "../../../../lib/backblaze"
import { T_FACTURA, asegurarTablaFacturas, avisarCliente } from "../../../../lib/facturas"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaFacturas(knex)
  const f = await knex(T_FACTURA).where({ id: String(req.params.id), seller_id: sellerId }).first()
  if (!f) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (f.estado !== "solicitada")
    return res.status(400).json({ message: f.estado === "emitida" ? "Esta factura ya está emitida." : "El cliente debe volver a pedir esta factura." })

  const archivos = archivosDe(req as any)
  const pdf = archivos.pdf?.[0]
  const xml = archivos.xml?.[0]
  if (!pdf || !xml) return res.status(400).json({ message: "Sube los dos archivos de la factura: el PDF y el XML." })
  if (!/\.pdf$/i.test(pdf.originalname)) return res.status(400).json({ message: "El primer archivo debe ser el PDF." })
  if (!/\.xml$/i.test(xml.originalname)) return res.status(400).json({ message: "El segundo archivo debe ser el XML del CFDI." })
  // Revisión mínima del XML: que sea un CFDI con el RFC del cliente como receptor
  const texto = xml.buffer.toString("utf8")
  const fiscal = typeof f.fiscal === "string" ? JSON.parse(f.fiscal) : f.fiscal
  if (!/<cfdi:Comprobante/i.test(texto)) return res.status(400).json({ message: "El XML no parece un CFDI (falta cfdi:Comprobante)." })
  // En el XML el "&" de algunos RFC va escrito como &amp;
  const rfcXml = `(${fiscal?.rfc}|${String(fiscal?.rfc).replace(/&/g, "&amp;")})`
  if (fiscal?.rfc && !new RegExp(`<cfdi:Receptor[^>]*Rfc="${rfcXml}"`, "i").test(texto))
    return res.status(400).json({ message: `El receptor del XML no es el RFC del cliente (${fiscal.rfc}).` })

  const base = `facturas/${new Date().toISOString().slice(0, 7)}/${randomBytes(12).toString("hex")}`
  const [a, b] = await Promise.all([
    uploadFile(pdf.buffer, `${base}/factura-${f.display_id}.pdf`, "application/pdf"),
    uploadFile(xml.buffer, `${base}/factura-${f.display_id}.xml`, "application/xml"),
  ])
  if (!a.ok || !b.ok) {
    const motivo = [a, b].map((x) => (!x.ok ? x.reason : "")).filter(Boolean).join("; ")
    req.scope.resolve("logger").error(`[facturas] no se pudo subir ${f.id}: ${motivo}`)
    return res.status(503).json({ message: "No pudimos guardar los archivos. Intenta de nuevo en un momento." })
  }
  await knex(T_FACTURA).where({ id: f.id }).update({
    estado: "emitida",
    pdf_clave: `${base}/factura-${f.display_id}.pdf`,
    xml_clave: `${base}/factura-${f.display_id}.xml`,
    nota: null,
    emitida_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  })
  await avisarCliente(knex, { ...f, fiscal, estado: "emitida" })
  res.json({ ok: true })
}
