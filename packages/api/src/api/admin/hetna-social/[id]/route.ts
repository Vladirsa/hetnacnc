// POST /admin/hetna-social/:id { accion, ... }
//   guardar   { titulo, textos, redes, medios, url_destino }
//   adaptar   -> vuelve a escribir los textos por red (IA o plantillas)
//   programar { programada_para }   (vacío = lo antes posible dentro del horario)
//   publicar  { redes? }            -> ahora mismo
//   descartar
//   liga      { red, grupo }        -> liga medida para pegar a mano (p. ej. un grupo de Facebook)
//   revisar                         -> el revisor con IA mejora los textos (guarda la versión anterior)
//   deshacer                        -> vuelve a los textos de antes de la revisión
// Social Hub (Licitaciones 3.0, Fase 5A).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { deshacerRevision, revisarPublicacion } from "../../../../lib/social-revisor"
import { REDES, T_LIGA, T_POST, adaptar, motivoSinIa, zonaDe, asegurarSocial, dentroDeHorario, leerConfig, ligaPara, publicar, urlCorta, vistaPublicacion } from "../../../../lib/social-hub"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSocial(knex)
  const p = await knex(T_POST).where({ id: String(req.params.id) }).first()
  if (!p) return res.status(404).json({ message: "Publicación no encontrada." })
  res.json(await vistaPublicacion(knex, p))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  await asegurarSocial(knex)
  const p = await knex(T_POST).where({ id: String(req.params.id) }).first()
  if (!p) return res.status(404).json({ message: "Publicación no encontrada." })
  const b: any = req.body || {}
  let extra: Record<string, unknown> = {}
  const redesValidas = (x: any) => (Array.isArray(x) ? x.filter((r: string) => r in REDES) : p.redes)

  switch (b.accion) {
    case "guardar": {
      // La liga de destino se puede cambiar desde la tarjeta; si no es https se avisa en lugar de ignorarla
      const destino = typeof b.url_destino === "string" ? b.url_destino.trim() : ""
      if (destino && !/^https:\/\/\S+$/.test(destino)) return res.status(400).json({ message: "La liga de destino debe empezar con https://" })
      if (b.titulo != null && !String(b.titulo).trim()) return res.status(400).json({ message: "El título no puede quedar vacío." })
      const textos = typeof b.textos === "object" && b.textos ? Object.fromEntries(Object.entries(b.textos).map(([k, v]) => [k, String(v).slice(0, 5000)])) : p.textos
      await knex(T_POST).where({ id: p.id }).update({
        titulo: String(b.titulo || p.titulo).trim().slice(0, 160),
        textos: JSON.stringify(textos),
        redes: JSON.stringify(redesValidas(b.redes)),
        medios: JSON.stringify(Array.isArray(b.medios) ? b.medios.filter((m: any) => /^https:\/\//.test(m?.url)).slice(0, 10) : p.medios || []),
        url_destino: destino || p.url_destino,
        updated_at: knex.fn.now(),
      })
      // Las ligas medidas ya creadas (al copiar o publicar) apuntan al nuevo destino
      if (destino && destino !== p.url_destino) await knex(T_LIGA).where({ post_id: p.id }).update({ destino })
      break
    }
    case "adaptar": {
      const redes = redesValidas(b.redes)
      const base = String(b.texto_base || p.texto_base)
      const { textos, ia } = await adaptar(base.includes("{{liga}}") ? base : `${base}\n\n{{liga}}`, redes, logger, p.mercado || "mx")
      await knex(T_POST).where({ id: p.id }).update({ texto_base: base, textos: JSON.stringify(textos), redes: JSON.stringify(redes), adaptada_ia: ia, updated_at: knex.fn.now() })
      break
    }
    case "programar": {
      const cfg = await leerConfig(knex)
      const cuando = b.programada_para ? new Date(b.programada_para) : dentroDeHorario(new Date(Date.now() + 2 * 60_000), cfg.horario, zonaDe(p.mercado))
      if (Number.isNaN(cuando.getTime())) return res.status(400).json({ message: "Fecha no válida." })
      await knex(T_POST).where({ id: p.id }).whereNotIn("estado", ["publicando"]).update({ estado: "programada", programada_para: cuando, updated_at: knex.fn.now() })
      break
    }
    case "publicar": {
      // Fecha especial vencida: ya no sale (y no se toca su estado)
      if (p.vence && new Date(p.vence).getTime() <= Date.now()) return res.status(409).json({ message: "Esta publicación era para una fecha especial que ya pasó; ya no se publica." })
      if (p.estado === "descartada") return res.status(409).json({ message: "Esta publicación está descartada; no se puede publicar." })
      if (p.estado === "publicando") return res.status(409).json({ message: "Se está publicando en este momento." })
      if (p.estado === "publicada") await knex(T_POST).where({ id: p.id, estado: "publicada" }).update({ estado: "parcial" })
      const r = await publicar(knex, p.id, logger, Array.isArray(b.redes) ? b.redes : undefined)
      if (!r) {
        // No se pudo tomar (otra petición la tomó o cambió mientras): si estaba publicada, se deja como estaba
        if (p.estado === "publicada") await knex(T_POST).where({ id: p.id, estado: "parcial" }).update({ estado: "publicada" })
        return res.status(409).json({ message: "No se pudo publicar: la publicación cambió o se está publicando en este momento. Recarga la página." })
      }
      break
    }
    case "descartar":
      await knex(T_POST).where({ id: p.id }).whereNot({ estado: "publicando" }).update({ estado: "descartada", updated_at: knex.fn.now() })
      break
    case "revisar": {
      const r = await revisarPublicacion(knex, p.id, logger, { forzar: true })
      if (!r.cambiadas?.length) return res.status(400).json({ message: r.motivo === "sin IA configurada" ? motivoSinIa() : r.motivo === "no editable" ? "Esta publicación ya no se puede cambiar." : "La IA no mejoró el texto; quedó como estaba." })
      extra = { cambiadas: r.cambiadas }
      break
    }
    case "deshacer":
      if (!(await deshacerRevision(knex, p.id))) return res.status(400).json({ message: "No hay versión anterior." })
      break
    case "liga": {
      const red = String(b.red || "grupos_facebook")
      if (!(red in REDES)) return res.status(400).json({ message: "Red no válida." })
      const codigo = await ligaPara(knex, p.id, red, p.url_destino, String(b.grupo || "").trim().slice(0, 80) || null)
      return res.json({ ok: true, codigo, url: urlCorta(codigo) })
    }
    default:
      return res.status(400).json({ message: "Acción no válida." })
  }
  const nueva = await knex(T_POST).where({ id: p.id }).first()
  res.json({ ok: true, ...extra, publicacion: await vistaPublicacion(knex, nueva) })
}
