// GET  /admin/hetna-social?estado=...  -> publicaciones (para la lista y el calendario)
// POST /admin/hetna-social { titulo, texto_base, url, redes, medios, programada_para?, estado? } -> nueva publicación manual
// Social Hub (Licitaciones 3.0, Fase 5A).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MERCADOS, ORIGENES, REDES, T_POST, asegurarSocial, crearPublicacion, leerConfig, urlN8nSocial, vistaPublicacion } from "../../../lib/social-hub"
import { puntuar } from "../../../lib/estrategia"
import { threadsListo } from "../../../lib/threads"
import { tiktokConectado } from "../../../lib/tiktok"

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
  // Las redes que se conectan después (YouTube, Threads, TikTok) dejan de ser
  // "a mano" en cuanto están conectadas: lo mismo que decide publicar()
  const config = await leerConfig(knex)
  const tiktok = await tiktokConectado(knex).catch(() => false)
  const autoDe = (clave: string, r: any) =>
    clave === "youtube" ? !!config.youtube_auto : clave === "threads" ? threadsListo() : clave === "tiktok" ? !!tiktok : !!r.auto
  const notas: Record<string, string> = { tiktok: "Con video llega como borrador a la app de TikTok: tú le das Publicar" }
  res.json({
    publicaciones,
    redes: Object.entries(REDES).map(([clave, r]) => ({ clave, ...r, auto: autoDe(clave, r), nota: autoDe(clave, r) ? notas[clave] : undefined })),
    origenes: ORIGENES,
    mercados: Object.entries(MERCADOS).map(([clave, m]) => ({ clave, nombre: m.nombre })),
    config,
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
