// GET /api/anuncios-talleres → anuncios listos para publicar en grupos de CNC
// (Facebook, WhatsApp, etc.) de las solicitudes que siguen abiertas.
// Lo lee el agente que publica en grupos: título, texto, imagen diseñada y
// liga. Es público: sólo trae el resumen que ya sale en redes (sin nombre,
// contacto ni archivos del cliente).
//   ?dias=7 (1 a 30) · ?formato=texto (uno tras otro, para copiar y pegar)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD } from "../../../lib/licitacion"
import { T_POST } from "../../../lib/social-hub"

const json = (v: any) => (typeof v === "string" ? (() => { try { return JSON.parse(v) } catch { return null } })() : v)

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const dias = Math.max(1, Math.min(30, Number(req.query.dias) || 7))
  const filas = (await knex(`${T_POST} as p`)
    .join(`${T_SOLICITUD} as s`, "s.id", "p.origen_id")
    .where("p.origen", "licitacion")
    .where("s.estado", "abierta")
    .where("p.created_at", ">=", knex.raw(`now() - (? || ' days')::interval`, [String(dias)]))
    .orderBy("p.created_at", "desc")
    .limit(50)
    .select("p.id", "p.titulo", "p.texto_base", "p.textos", "p.medios", "p.url_destino", "p.created_at", "s.cierra_en")
    .catch(() => [])) as any[]

  const anuncios = filas.map((p) => {
    const textos = json(p.textos) || {}
    const base = String(textos.grupos_facebook || textos.facebook || p.texto_base || "")
    const texto = base.replace(/\{\{liga\}\}/g, p.url_destino || "")
    const imagen = (json(p.medios) || []).find((m: any) => m?.url && m.tipo !== "video")?.url || null
    return {
      id: p.id,
      titulo: texto.split("\n").find((l) => l.trim()) || p.titulo,
      texto,
      imagen,
      liga: p.url_destino,
      publicado: p.created_at,
      cierra: p.cierra_en,
    }
  })

  res.setHeader("Cache-Control", "public, max-age=300")
  if (req.query.formato === "texto") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    return res.status(200).send(
      anuncios.length
        ? anuncios.map((a) => `${a.texto}${a.imagen ? `\n\nImagen: ${a.imagen}` : ""}`).join("\n\n-----\n\n")
        : "Por ahora no hay solicitudes abiertas."
    )
  }
  res.json({ total: anuncios.length, anuncios })
}
