import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../../lib/backblaze"
import { T_ENVIO, TIPOS_EVIDENCIA, asegurarTablasEnvio, folioEnvio, leerEvidencia, numeroFolio } from "../../../../lib/envios"

// Un envío con sus datos y la evidencia con ligas firmadas (1 hora), para
// mandarla a Skydropx cuando llegue un sobrepeso o haya que reclamar la SOS.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasEnvio(knex)
  const n = numeroFolio(String(req.params.folio || ""))
  const e = n ? await knex(T_ENVIO).where({ folio: n }).first() : null
  if (!e) return res.status(404).json({ message: "Envío no encontrado." })
  const fotos: { tipo: string; etiqueta: string; nombre: string; subido: string; url: string | null }[] = []
  for (const x of leerEvidencia(e.evidencia)) {
    const s = await getSignedDownloadUrl(x.clave, 3600)
    fotos.push({ tipo: x.tipo, etiqueta: TIPOS_EVIDENCIA[x.tipo] || x.tipo, nombre: x.nombre, subido: x.subido, url: s.ok ? s.url : null })
  }
  const j = (v: any) => (typeof v === "string" ? JSON.parse(v) : v)
  return res.json({
    folio: folioEnvio(e.folio),
    estado: e.estado,
    precio: Number(e.precio),
    tarifa: j(e.tarifa),
    origen: j(e.origen),
    destino: j(e.destino),
    paquete: j(e.paquete),
    contenido: e.contenido,
    contenido_estado: e.contenido_estado,
    acepta_evidencia: e.acepta_evidencia,
    proteccion_valor: e.proteccion_valor ? Number(e.proteccion_valor) : null,
    proteccion_costo: e.proteccion_costo ? Number(e.proteccion_costo) : null,
    guia: j(e.guia),
    pago_id: e.pago_id,
    evidencia: fotos,
    created_at: e.created_at,
  })
}
