// @ts-nocheck
// Marketing HETNA — estadísticas de cada publicación y aprendizaje.
// Cada pocas horas se leen de Facebook e Instagram (vía n8n, ruta "metricas")
// el alcance, me gusta, comentarios, compartidos, guardados y vistas de lo
// publicado en los últimos 30 días. Con eso se calcula qué formato, mercado y
// hora funcionan mejor en cada red; el agente de estrategia lo usa al llenar
// el plan semanal y el panel lo muestra en Resultados.
import { REDES, T_POST, asegurarSocial, enviarAN8n, horaEn, zonaDe } from "./social-hub"

const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0)

/** Intentos de campos por tipo de objeto (si una métrica no existe, se prueba la siguiente lista). */
export function camposPara(red: string, id: string): string[] {
  const base = "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)"
  if (red === "instagram") return ["like_count,comments_count,insights.metric(reach,saved,shares,views)", "like_count,comments_count,insights.metric(reach,saved)", "like_count,comments_count"]
  if (red === "facebook") return id.includes("_") ? [`${base},shares,insights.metric(post_impressions_unique)`, `${base},shares`, base] : [base]
  return []
}

/** Id del objeto en la red: guardado al publicar o sacado de la liga. */
export function idDe(red: string, r: any): string | null {
  if (!r?.ok) return null
  if (r.id && /^[0-9_]+$/.test(String(r.id))) return String(r.id)
  if (red === "facebook") {
    const m = String(r.url || "").match(/facebook\.com\/([0-9]+(?:_[0-9]+)?)/)
    return m ? m[1] : null
  }
  return null
}

const metrica = (datos: any, nombre: string) => {
  const m = (datos?.insights?.data || []).find((x: any) => x.name === nombre)
  return n(m?.values?.[0]?.value ?? m?.total_value?.value)
}

/** Convierte lo que regresa Graph a un formato común. */
export function normalizar(red: string, d: any) {
  const e: any = red === "instagram"
    ? { me_gusta: n(d.like_count), comentarios: n(d.comments_count), compartidos: metrica(d, "shares"), guardados: metrica(d, "saved"), alcance: metrica(d, "reach"), vistas: metrica(d, "views") }
    : { me_gusta: n(d.reactions?.summary?.total_count), comentarios: n(d.comments?.summary?.total_count), compartidos: n(d.shares?.count), guardados: 0, alcance: metrica(d, "post_impressions_unique"), vistas: 0 }
  // Puntos de interacción: lo que más pesa en los algoritmos (compartir y guardar) vale más
  e.interaccion = e.me_gusta + e.comentarios * 2 + e.compartidos * 3 + e.guardados * 3
  return e
}

export const formatoDe = (medios: any[]) => {
  const m = (medios || []).filter((x) => x?.url)
  if (m.some((x) => x.tipo === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(String(x.url)))) return "video"
  if (m.length >= 2) return "carrusel"
  return m.length ? "imagen" : "texto"
}

/** Job: actualiza las estadísticas de lo publicado en los últimos 30 días. */
export async function actualizarEstadisticas(knex: any, logger?: any, limite = 40) {
  await asegurarSocial(knex)
  const posts = await knex(T_POST)
    .whereIn("estado", ["publicada", "parcial"])
    .where("publicada_en", ">=", knex.raw("now() - interval '30 days'"))
    .orderBy("publicada_en", "desc")
    .limit(200)
    .select("id", "resultado", "estadisticas")
  let leidas = 0
  for (const p of posts) {
    if (leidas >= limite) break
    const est = { ...(p.estadisticas || {}) }
    let cambio = false
    for (const red of ["facebook", "instagram"]) {
      const id = idDe(red, p.resultado?.[red])
      if (!id) continue
      // Cada publicación se lee como mucho cada 6 horas
      if (est[red]?.en && Date.now() - new Date(est[red].en).getTime() < 6 * 3600_000) continue
      // Si falta un permiso (p. ej. instagram_manage_insights) o una métrica ya no
      // existe, se prueba con menos campos; sólo se avisa si fallan todos
      let ultimo = ""
      for (const campos of camposPara(red, id)) {
        const r: any = await enviarAN8n({ red: "metricas", objeto: id, campos, texto: "" })
        if (r.ok && r.datos) {
          est[red] = { ...normalizar(red, r.datos), en: new Date().toISOString() }
          cambio = true
          ultimo = ""
          break
        }
        ultimo = String(r.error || "sin respuesta")
        if (/fetch failed|timeout|abort|N8N_/i.test(ultimo)) break
      }
      if (ultimo) logger?.warn?.(`[social] estadísticas ${p.id} ${red}: ${ultimo}`)
      leidas++
    }
    if (cambio) await knex(T_POST).where({ id: p.id }).update({ estadisticas: JSON.stringify(est) })
  }
  return { leidas }
}

/** Promedios por red y formato, mercado y hora; y frases con lo aprendido. */
export async function aprendizaje(knex: any, dias = 60) {
  await asegurarSocial(knex)
  const posts = await knex(T_POST)
    .whereNotNull("estadisticas")
    .where("publicada_en", ">=", knex.raw(`now() - (? || ' days')::interval`, [String(Math.max(7, Math.min(365, dias)))]))
    .select("id", "titulo", "medios", "mercado", "origen", "publicada_en", "estadisticas", "resultado")
  const grupos: Record<string, any> = {}
  const sumar = (clave: string, base: any, e: any) => {
    const g = (grupos[clave] ??= { ...base, n: 0, interaccion: 0, alcance: 0 })
    g.n++
    g.interaccion += e.interaccion
    g.alcance += e.alcance
  }
  const mejores: any[] = []
  for (const p of posts) {
    const formato = formatoDe(p.medios)
    for (const [red, e] of Object.entries(p.estadisticas || {}) as any) {
      if (!e || !REDES[red]) continue
      const hora = horaEn(new Date(p.publicada_en), zonaDe(p.mercado))
      sumar(`f|${red}|${formato}`, { tipo: "formato", red, formato }, e)
      sumar(`m|${red}|${p.mercado || "mx"}`, { tipo: "mercado", red, mercado: p.mercado || "mx" }, e)
      sumar(`h|${red}|${hora}`, { tipo: "hora", red, hora }, e)
      sumar(`o|${red}|${p.origen}`, { tipo: "origen", red, origen: p.origen }, e)
      mejores.push({ id: p.id, titulo: p.titulo, red, formato, mercado: p.mercado || "mx", url: p.resultado?.[red]?.url || null, ...e })
    }
  }
  const lista = Object.values(grupos).map((g: any) => ({ ...g, interaccion_media: +(g.interaccion / g.n).toFixed(1), alcance_medio: Math.round(g.alcance / g.n) }))
  const de = (tipo: string) => lista.filter((g) => g.tipo === tipo).sort((a, b) => b.interaccion_media - a.interaccion_media)
  // Frases: sólo con al menos 3 publicaciones por grupo, para no sacar conclusiones de un caso
  const resumen: string[] = []
  for (const red of ["instagram", "facebook"]) {
    const f = de("formato").filter((g) => g.red === red && g.n >= 3)
    if (f.length >= 2 && f[f.length - 1].interaccion_media > 0) {
      const x = f[0].interaccion_media / f[f.length - 1].interaccion_media
      if (x >= 1.3) resumen.push(`En ${REDES[red].nombre}, ${f[0].formato} rinde ${x.toFixed(1)} veces más que ${f[f.length - 1].formato} (${f[0].n} y ${f[f.length - 1].n} publicaciones).`)
    }
    const h = de("hora").filter((g) => g.red === red && g.n >= 3)
    if (h.length >= 2) resumen.push(`En ${REDES[red].nombre}, la mejor hora ha sido las ${h[0].hora}:00 (hora local del mercado).`)
    const m = de("mercado").filter((g) => g.red === red && g.n >= 3)
    if (m.length >= 2) resumen.push(`En ${REDES[red].nombre}, el mercado que más responde es ${m[0].mercado.toUpperCase()}.`)
  }
  return {
    dias,
    publicaciones: posts.length,
    por_formato: de("formato"),
    por_mercado: de("mercado"),
    por_hora: de("hora"),
    por_origen: de("origen"),
    mejores: mejores.sort((a, b) => b.interaccion - a.interaccion).slice(0, 8),
    resumen,
  }
}
