// GET /api/anuncios-talleres → anuncios listos para publicar en grupos de CNC
// (Facebook, WhatsApp, etc.) de las solicitudes que siguen abiertas.
// Lo lee el agente que publica en grupos: título, texto, imagen diseñada y
// liga. Es público: sólo trae el resumen que ya sale en redes (sin nombre,
// contacto ni archivos del cliente).
//   ?dias=7 (1 a 30) · ?formato=texto (uno tras otro, para copiar y pegar)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD } from "../../../lib/licitacion"
import { T_POST, textoBase } from "../../../lib/social-hub"
import { materialClaro, resumenRedes } from "../../../lib/licitacion-privacidad"

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
    .select("p.id", "p.titulo", "p.texto_base", "p.medios", "p.url_destino", "p.created_at", "s.cierra_en", "s.trabajo", "s.privacidad", "s.contacto", "s.tipo")
    .catch(() => [])) as any[]

  const anuncios = filas.map((p) => {
    // El texto se arma al momento con la plantilla vigente (título que llama
    // a los talleres del estado), también para anuncios creados antes.
    const s = { trabajo: json(p.trabajo) || {}, privacidad: json(p.privacidad), contacto: json(p.contacto), tipo: p.tipo }
    const resumen = resumenRedes(s)
    // Mismo lugar y mismos datos que ya permite mostrar el resumen (respeta la privacidad)
    const lugar = (resumen.match(/Ubicación: ([^.]+)\./) || [])[1] || ""
    const mat = materialClaro(s.trabajo.material)
    const titulo = s.trabajo.servicio ? [s.trabajo.servicio, mat].filter(Boolean).join(" - ") : mat ? `Trabajo - ${mat}` : "Trabajo de fabricación CNC"
    const texto = textoBase("licitacion", { titulo, lugar, resumen, tipo: p.tipo }).replace(/\{\{liga\}\}/g, p.url_destino || "")
    const imagen = (json(p.medios) || []).find((m: any) => m?.url && m.tipo !== "video")?.url || null
    return {
      id: p.id,
      tipo: p.tipo === "suministro" ? "proveedor" : "taller",
      titulo: texto.split("\n").find((l) => l.trim()) || p.titulo,
      texto,
      imagen,
      liga: p.url_destino,
      publicado: p.created_at,
      cierra: p.cierra_en,
    }
  })

  // El anuncio del mes «HETNA CNC en números» (lib/metricas-extranjeros): una vez en cada grupo
  const metricas = (await knex(T_POST)
    .where({ fuente: "metricas" })
    .where("created_at", ">=", knex.raw("now() - interval '7 days'"))
    .orderBy("created_at", "desc")
    .first("id", "titulo", "texto_base", "medios", "url_destino", "created_at")
    .catch(() => null)) as any
  if (metricas) {
    const texto = String(metricas.texto_base || "").replace(/\{\{liga\}\}/g, metricas.url_destino || "")
    anuncios.push({
      id: metricas.id,
      tipo: "metricas",
      titulo: texto.split("\n").find((l) => l.trim()) || metricas.titulo,
      texto,
      imagen: (json(metricas.medios) || []).find((m: any) => m?.url && m.tipo !== "video")?.url || null,
      liga: metricas.url_destino,
      publicado: metricas.created_at,
      cierra: null,
    })
  }

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
