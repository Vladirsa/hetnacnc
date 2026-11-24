// @ts-nocheck
// Marketing HETNA — reciclar lo que funcionó y resumen semanal.
//   - Reciclar: cada lunes, las publicaciones con más interacción de hace 45 a
//     120 días vuelven como borrador con otro gancho (mismo material), para la
//     semana. Máximo 2 por semana y nunca la misma dos veces en 90 días.
//   - Resumen: cada lunes a las 9 (centro de México) llega por Telegram (y por
//     correo si hay HETNA_LEADS_EMAIL) lo de la semana pasada y lo que viene.
import { T_POST, asegurarSocial, crearPublicacion, dentroDeHorario, leerConfig, metricas, zonaDe, REDES } from "./social-hub"
import { aprendizaje } from "./social-estadisticas"
import { ganchoAlterno, oraciones } from "./fabrica/plan-material"
import { mandarPrivado } from "./social-telegram"
import { sendEmail } from "./resend"
import { correosDeLaCasa } from "./cuentas-casa"

export async function reciclar(knex: any, logger?: any, maximo = 2) {
  await asegurarSocial(knex)
  await knex.raw(`alter table ?? add column if not exists reciclada_de text`, [T_POST]).catch(() => {})
  const candidatas = await knex(T_POST)
    .where("estado", "publicada")
    .whereNull("reciclada_de")
    .whereNull("vence") // lo de fecha especial (Día de las Madres…) no se recicla fuera de temporada
    .whereNotNull("estadisticas")
    .whereBetween("publicada_en", [knex.raw("now() - interval '120 days'"), knex.raw("now() - interval '45 days'")])
    .whereRaw(`coalesce(jsonb_array_length(medios), 0) > 0`)
    .select("id", "titulo", "texto_base", "textos", "redes", "medios", "url_destino", "mercado", "estadisticas", "notas")
  const ya = new Set(await knex(T_POST).whereNotNull("reciclada_de").where("created_at", ">=", knex.raw("now() - interval '90 days'")).pluck("reciclada_de"))
  const puntos = (p: any) => Object.values(p.estadisticas || {}).reduce((a: number, e: any) => a + Number(e?.interaccion || 0), 0)
  const mejores = candidatas.filter((p: any) => !ya.has(p.id) && puntos(p) > 0).sort((a: any, b: any) => puntos(b) - puntos(a)).slice(0, maximo)
  const cfg = await leerConfig(knex)
  const creadas: string[] = []
  for (const [i, p] of mejores.entries()) {
    const red = (p.redes || [])[0]
    const texto = String(p.textos?.[red] || p.texto_base)
    const primera = texto.split("\n").find((l) => l.trim()) || ""
    const nuevo = await ganchoAlterno(primera, oraciones(texto).slice(1, 4), p.mercado || "mx", logger)
    const cambia = (t: string) => (nuevo ? String(t).replace(primera, nuevo) : String(t))
    const cuando = dentroDeHorario(new Date(Date.now() + (2 + i * 2) * 86_400_000), cfg.horario, zonaDe(p.mercado))
    const id = await crearPublicacion(knex, {
      origen: "manual", fuente: "reciclaje", titulo: `♻ ${p.titulo}`.slice(0, 160), texto_base: cambia(p.texto_base), url: p.url_destino, redes: p.redes,
      textos: Object.fromEntries(Object.entries(p.textos || {}).map(([r, t]) => [r, cambia(String(t))])), medios: p.medios,
      estado: "borrador", programada_para: cuando, mercado: p.mercado, notas: `Reciclada de una publicación con ${puntos(p)} puntos de interacción.`,
    } as any, logger)
    await knex(T_POST).where({ id }).update({ reciclada_de: p.id })
    creadas.push(id)
  }
  if (creadas.length) logger?.info?.(`[social] recicladas: ${creadas.length}`)
  return creadas
}

const n = (x: any) => Number(x || 0)

/**
 * Lo que falló en la semana, explicado (Vlado, 23 nov 2026: "¿por qué dice 33
 * errores?"). Antes se sumaba todo junto: las que no salieron en ninguna red,
 * las que salieron en unas redes y en otras no (parcial) y hasta las de
 * Instagram que seguían procesándose. Ahora se separa y se dice por red cuántas
 * fallaron y por qué (el mensaje más repetido).
 */
export async function erroresSemana(knex: any) {
  const filas = await knex(T_POST)
    .whereIn("estado", ["error", "parcial"])
    .where("updated_at", ">=", knex.raw("now() - interval '7 days'"))
    .select("id", "estado", "resultado")
  let ninguna = 0
  let parciales = 0
  const porRed: Record<string, { n: number; motivos: Record<string, number> }> = {}
  for (const f of filas) {
    const res = (typeof f.resultado === "string" ? JSON.parse(f.resultado || "{}") : f.resultado) || {}
    const fallas = Object.entries(res).filter(([, r]: any) => r && !r.ok && !r.pendiente && !r.manual)
    if (!fallas.length) continue // sólo pendientes (Instagram procesando): no es error
    if (f.estado === "error") ninguna++
    else parciales++
    for (const [red, r] of fallas as any) {
      const motivo = String(r.error || "sin detalle").replace(/\s+/g, " ").trim().slice(0, 90)
      porRed[red] = porRed[red] || { n: 0, motivos: {} }
      porRed[red].n++
      porRed[red].motivos[motivo] = (porRed[red].motivos[motivo] || 0) + 1
    }
  }
  const redes = Object.entries(porRed)
    .sort((a, b) => b[1].n - a[1].n)
    .map(([red, d]) => ({ red, nombre: REDES[red]?.nombre || red, n: d.n, motivo: Object.entries(d.motivos).sort((a, b) => b[1] - a[1])[0]?.[0] || "" }))
  return { ninguna, parciales, total: ninguna + parciales, redes }
}

/** Altas reales en toda la página en los últimos 7 días (no sólo las que llegaron por una liga de redes). */
export async function altasSemana(knex: any) {
  const casa = correosDeLaCasa().map((c) => c.toLowerCase())
  const contar = async (tabla: string, extra?: (q: any) => any) => {
    try {
      let q = knex(tabla).whereNull("deleted_at").where("created_at", ">=", knex.raw("now() - interval '7 days'"))
      if (casa.length) q = q.where((w: any) => w.whereNull("email").orWhereRaw(`lower(email) not in (${casa.map(() => "?").join(",")})`, casa))
      if (extra) q = extra(q)
      return Number((await q.count({ n: "*" }).first())?.n || 0)
    } catch {
      return null
    }
  }
  return {
    clientes: await contar("customer", (q) => q.where("has_account", true)),
    talleres: await contar("seller"),
  }
}

/** Texto del resumen semanal (también sirve para el panel). */
export async function resumenSemanal(knex: any) {
  await asegurarSocial(knex)
  const m = await metricas(knex, 7)
  const tot = m.por_red.reduce((a: any, r: any) => ({ clics: a.clics + n(r.clics), cli: a.cli + n(r.registro_cliente), tal: a.tal + n(r.registro_taller), sol: a.sol + n(r.solicitud), ven: a.ven + n(r.venta) }), { clics: 0, cli: 0, tal: 0, sol: 0, ven: 0 })
  const publicadas = Number((await knex(T_POST).where("estado", "publicada").where("publicada_en", ">=", knex.raw("now() - interval '7 days'")).count({ n: "*" }).first())?.n || 0)
  const err = await erroresSemana(knex).catch(() => ({ ninguna: 0, parciales: 0, total: 0, redes: [] as any[] }))
  const altas = await altasSemana(knex)
  const programadas = Number((await knex(T_POST).where("estado", "programada").where("programada_para", "<=", knex.raw("now() + interval '7 days'")).count({ n: "*" }).first())?.n || 0)
  const borradores = Number((await knex(T_POST).where("estado", "borrador").where((q: any) => q.whereNull("programada_para").orWhere("programada_para", "<=", knex.raw("now() + interval '7 days'"))).count({ n: "*" }).first())?.n || 0)
  const ap = await aprendizaje(knex, 30).catch(() => null)
  const top = ap?.mejores?.[0]
  const porRed = m.por_red.filter((r: any) => r.clics).sort((a: any, b: any) => b.clics - a.clics).slice(0, 4).map((r: any) => `${r.nombre}: ${r.clics}`).join(" · ")
  return [
    "📊 HETNA · resumen de la semana",
    "",
    `Publicadas: ${publicadas}`,
    err.total
      ? `⚠ Con fallas: ${err.total}${err.ninguna ? ` (${err.ninguna} no salieron en ninguna red` : " ("}${err.ninguna && err.parciales ? "; " : ""}${err.parciales ? `${err.parciales} salieron en unas redes y en otras no` : ""})` +
        err.redes.slice(0, 4).map((r: any) => `\n• ${r.nombre}: ${r.n} — ${r.motivo}`).join("")
      : "",
    `Clics en ligas: ${tot.clics}${porRed ? ` (${porRed})` : ""}`,
    `Desde tus redes: ${tot.cli} clientes · ${tot.tal} talleres · ${tot.sol} solicitudes · ${tot.ven} ventas`,
    altas.clientes !== null || altas.talleres !== null
      ? `En toda la página (7 días): ${altas.clientes ?? "?"} clientes nuevos · ${altas.talleres ?? "?"} talleres nuevos`
      : "",
    top ? `\n🏆 Lo mejor: "${top.titulo}" en ${REDES[top.red]?.nombre || top.red} (❤ ${top.me_gusta} · 💬 ${top.comentarios} · ↗ ${top.compartidos})` : "",
    ap?.resumen?.length ? `\n🧠 Aprendido:\n• ${ap.resumen.slice(0, 3).join("\n• ")}` : "",
    "",
    `Esta semana: ${programadas} programadas · ${borradores} borradores por revisar${borradores ? " (/pendientes)" : ""}`,
  ].filter((l) => l !== "").join("\n")
}

/** Job de cada lunes: recicla y manda el resumen. */
export async function lunesSocial(knex: any, logger?: any) {
  await reciclar(knex, logger).catch((e) => logger?.warn?.(`[social] reciclar: ${e.message}`))
  const texto = await resumenSemanal(knex)
  await mandarPrivado(knex, { texto }).catch(() => {})
  if (process.env.HETNA_LEADS_EMAIL) await sendEmail({ to: process.env.HETNA_LEADS_EMAIL, subject: "HETNA · resumen semanal de redes", html: `<pre style="font-family:inherit;white-space:pre-wrap">${texto.replace(/</g, "&lt;")}</pre>` }).catch(() => {})
  logger?.info?.("[social] resumen semanal enviado")
}
