import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../../../../../lib/backblaze"
import {
  EXT_EVIDENCIA,
  T_ENVIO,
  TIPOS_EVIDENCIA,
  type Evidencia,
  type TipoEvidencia,
  asegurarTablasEnvio,
  evidenciaCompleta,
  leerEvidencia,
  numeroFolio,
} from "../../../../../../../lib/envios"

// Evidencia de un envío (fotos de las medidas y de la báscula con la guía
// visible), sólo para el dueño del envío. La foto se sube primero al bucket
// privado (POST /store/solicitud-archivos con destino=envio) y aquí se liga
// al envío con su tipo. Guarda la fecha: lo que cuenta ante la paquetería es
// que se tomó antes de entregar el paquete.

const clienteId = (req: MedusaRequest) => (req as any).auth_context?.actor_id as string | undefined
const MAX_EXTRA = 6

async function miEnvio(req: MedusaRequest) {
  const id = clienteId(req)
  if (!id) return { error: 401 as const }
  const n = numeroFolio(String(req.params.folio || ""))
  if (!n) return { error: 404 as const }
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablasEnvio(knex)
  const e = await knex(T_ENVIO).where({ folio: n, customer_id: id }).first()
  return e ? { knex, e } : { error: 404 as const }
}

// Ligas firmadas (1 hora) para ver la propia evidencia
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const r = await miEnvio(req)
  if (!r.e) return res.status(r.error || 404).json({ message: r.error === 401 ? "Inicia sesión." : "Envío no encontrado." })
  const ev = leerEvidencia(r.e.evidencia)
  const fotos: { tipo: string; nombre: string; subido: string; url: string | null }[] = []
  for (const x of ev) {
    const s = await getSignedDownloadUrl(x.clave, 3600)
    fotos.push({ tipo: x.tipo, nombre: x.nombre, subido: x.subido, url: s.ok ? s.url : null })
  }
  return res.json({ evidencia: fotos, completa: evidenciaCompleta(ev) })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const r = await miEnvio(req)
  if (!r.e) return res.status(r.error || 404).json({ message: r.error === 401 ? "Inicia sesión." : "Envío no encontrado." })
  if (r.e.estado === "cancelado") return res.status(400).json({ message: "Este envío está cancelado." })

  const b = (req.body || {}) as Record<string, unknown>
  const tipo = String(b.tipo || "") as TipoEvidencia
  const clave = String(b.clave || "")
  if (!(tipo in TIPOS_EVIDENCIA)) return res.status(400).json({ message: "Tipo de foto no válido." })
  // Sólo archivos subidos a la carpeta de evidencia, y sólo imágenes
  const ext = (clave.split(".").pop() || "").toLowerCase()
  if (!/^envios\/\d{4}-\d{2}\/[0-9a-f]{24}\/[^/]+$/.test(clave) || !EXT_EVIDENCIA.includes(ext))
    return res.status(400).json({ message: "Sube una foto (JPG, PNG, WEBP o HEIC)." })

  const nueva: Evidencia = {
    tipo,
    clave,
    nombre: String(b.nombre || "foto").slice(0, 120),
    tamano: Math.max(0, Number(b.tamano) || 0),
    subido: new Date().toISOString(),
  }
  let ev = leerEvidencia(r.e.evidencia)
  if (tipo === "extra") {
    if (ev.filter((x) => x.tipo === "extra").length >= MAX_EXTRA) return res.status(400).json({ message: `Máximo ${MAX_EXTRA} fotos extra.` })
    ev = [...ev, nueva]
  } else {
    // Una por tipo: la nueva reemplaza a la anterior (la anterior queda en el bucket)
    ev = [...ev.filter((x) => x.tipo !== tipo), nueva]
  }
  await r.knex(T_ENVIO).where({ id: r.e.id }).update({ evidencia: JSON.stringify(ev), updated_at: r.knex.fn.now() })
  return res.json({ ok: true, evidencia: ev.map(({ tipo, nombre, subido }) => ({ tipo, nombre, subido })), completa: evidenciaCompleta(ev) })
}
