// Acuerdo de confidencialidad de una solicitud (lib/licitacion-nda.ts).
//   GET   el texto que el taller debe leer y si ya lo aceptó
//   POST  { acepto: true } lo acepta; queda registrado quién, IP, navegador y fecha
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, asegurarTablas } from "../../../../../lib/licitacion"
import { VERSION_NDA, aceptarNda, textoNda } from "../../../../../lib/licitacion-nda"
import { privacidadDe, relacionTaller, tallerPuedeVer } from "../../../../../lib/licitacion-privacidad"

async function cargar(req: AuthenticatedMedusaRequest) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return { knex, sellerId, s: null, rel: null }
  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s || (s.modo !== "abierta" && s.taller_id !== sellerId)) return { knex, sellerId, s: null, rel: null }
  const rel = await relacionTaller(knex, s, sellerId)
  if (!tallerPuedeVer(s, rel)) return { knex, sellerId, s: null, rel: null }
  return { knex, sellerId, s, rel }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { s, rel } = await cargar(req)
  if (!s || !rel) return res.status(404).json({ message: "Solicitud no encontrada." })
  res.json({ requerido: privacidadDe(s).nda === "requerido", aceptado: !!rel.nda, version: VERSION_NDA, texto: textoNda(String(s.folio || s.id)) })
}

export const POST = async (req: AuthenticatedMedusaRequest<{ acepto?: boolean }>, res: MedusaResponse) => {
  const { knex, sellerId, s, rel } = await cargar(req)
  if (!s || !rel || !sellerId) return res.status(404).json({ message: "Solicitud no encontrada." })
  if ((req.body as any)?.acepto !== true) return res.status(400).json({ message: "Marca que leíste y aceptas el acuerdo." })
  const ip = String(req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.ip || "").split(",")[0].trim()
  await aceptarNda(knex, s, sellerId, { quien: req.auth_context?.actor_id || null, ip, agente: String(req.headers["user-agent"] || "") })
  res.json({ ok: true, aceptado: true })
}
