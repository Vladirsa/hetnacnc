// GET  /admin/hetna-social?estado=...  -> publicaciones (para la lista y el calendario)
// POST /admin/hetna-social { titulo, texto_base, url, redes, medios, programada_para?, estado? } -> nueva publicación manual
// Social Hub (Licitaciones 3.0, Fase 5A).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MERCADOS, ORIGENES, REDES, T_POST, asegurarSocial, crearPublicacion, leerConfig, urlN8nSocial, vistaPublicacion } from "../../../lib/social-hub"
import { puntuar } from "../../../lib/estrategia"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSocial(knex)
  const estado = String((req.query as any)?.estado || "")
  const q = knex(T_POST).orderByRaw("coalesce(programada_para, created_at) desc").limit(400)
  if (estado === "pendientes") q.whereIn("estado", ["borrador", "programada", "error", "parcial"])
  else if (estado) q.where({ estado })
  const filas = await q
  const publicaciones: any[] = []
  for (const p of filas) {
    const v = await vistaPublicacion(knex, p)
    // Puntaje de algoritmo por red (Estrategia)
    v.puntajes = Object.fromEntries((p.redes || []).map((red: string) => [red, puntuar(p.textos?.[red] || "", red, { medios: p.medios, programada_para: p.programada_para, mercado: p.mercado })]))
    publicaciones.push(v)
  }
  res.json({
    publicaciones,
    redes: Object.entries(REDES).map(([clave, r]) => ({ clave, ...r })),
    origenes: ORIGENES,
    mercados: Object.entries(MERCADOS).map(([clave, m]) => ({ clave, nombre: m.nombre })),
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
      mercado: typeof b.mercado === "string" ? b.mercado : "mx",
    },
    req.scope.resolve("logger")
  )
  res.json({ ok: true, id })
}
