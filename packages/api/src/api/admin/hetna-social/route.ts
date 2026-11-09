// GET  /admin/hetna-social?estado=...  -> publicaciones (para la lista y el calendario)
// POST /admin/hetna-social { titulo, texto_base, url, redes, medios, programada_para?, estado? } -> nueva publicación manual
// Social Hub (Licitaciones 3.0, Fase 5A).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ORIGENES, REDES, T_POST, asegurarSocial, crearPublicacion, leerConfig, urlN8nSocial, vistaPublicacion } from "../../../lib/social-hub"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSocial(knex)
  const estado = String((req.query as any)?.estado || "")
  const q = knex(T_POST).orderByRaw("coalesce(programada_para, created_at) desc").limit(150)
  if (estado === "pendientes") q.whereIn("estado", ["borrador", "programada", "error", "parcial"])
  else if (estado) q.where({ estado })
  const filas = await q
  const publicaciones: any[] = []
  for (const p of filas) publicaciones.push(await vistaPublicacion(knex, p))
  res.json({
    publicaciones,
    redes: Object.entries(REDES).map(([clave, r]) => ({ clave, ...r })),
    origenes: ORIGENES,
    config: await leerConfig(knex),
    n8n: !!urlN8nSocial(),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b: any = req.body || {}
  const titulo = String(b.titulo || "").trim()
  const texto = String(b.texto_base || "").trim()
  const url = String(b.url || "https://hetnacnc.com/mx").trim()
  if (!titulo || !texto) return res.status(400).json({ message: "Escribe un título y el texto." })
  if (!/^https:\/\//.test(url)) return res.status(400).json({ message: "La liga debe empezar con https://" })
  const id = await crearPublicacion(
    knex,
    {
      origen: "manual", titulo, texto_base: texto, url, redes: Array.isArray(b.redes) ? b.redes : undefined,
      medios: Array.isArray(b.medios) ? b.medios : [], programada_para: b.programada_para || null,
      estado: b.programada_para ? "programada" : "borrador",
    },
    req.scope.resolve("logger")
  )
  res.json({ ok: true, id })
}
