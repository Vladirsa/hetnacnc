// @ts-nocheck
// Marketing HETNA — aprobar publicaciones desde Telegram y piloto automático.
//
// Telegram: el bot de HETNA (el mismo de n8n) le manda al dueño, en privado,
// los borradores del día con botones: ✅ Aprobar (sale a su hora), 🚀 Publicar
// ya, ✏️ Cambiar (escribe qué cambiar y la IA lo reescribe) y 🗑 Descartar.
// El chat se vincula una sola vez con un código que da el panel (/vincular).
// n8n recibe los mensajes y botones y los pasa a /hooks/social-hub/telegram.
//
// Piloto automático: los borradores generados (plan, promociones, Fábrica) que
// ya tienen imagen o video y pasan el puntaje mínimo se programan solos.
import { randomInt } from "crypto"
import Anthropic from "@anthropic-ai/sdk"

import { MERCADOS, REDES, T_CONFIG_S, T_POST, adaptar, asegurarSocial, dentroDeHorario, enviarAN8n, horaEn, iaSocial, leerConfig, publicar, zonaDe } from "./social-hub"
import { puntuar } from "./estrategia"
import { revisarPublicacion } from "./social-revisor"

type EstadoTg = { chat_id?: string; codigo?: string; codigo_expira?: string; editando?: string | null; ultimo_aviso?: string }

export async function leerTg(knex: any): Promise<EstadoTg> {
  await asegurarSocial(knex)
  return (await knex(T_CONFIG_S).where({ clave: "telegram" }).first())?.valor || {}
}
async function guardarTg(knex: any, cambios: Partial<EstadoTg>) {
  const v = { ...(await leerTg(knex)), ...cambios }
  await knex.raw(`insert into ?? (clave, valor) values ('telegram', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(v)])
  return v
}

/** Código de 6 dígitos (15 min) para vincular el chat del dueño. */
export async function nuevoCodigo(knex: any) {
  const codigo = String(randomInt(100000, 1000000))
  await guardarTg(knex, { codigo, codigo_expira: new Date(Date.now() + 15 * 60_000).toISOString() })
  return codigo
}
export async function desvincular(knex: any) {
  await guardarTg(knex, { chat_id: undefined, editando: null })
}

/** Mensaje privado al dueño (con botones si lleva `post`). Si la foto o el video fallan, va sólo el texto. */
export async function mandarPrivado(knex: any, m: { texto: string; imagen?: string; video?: string; post?: string }) {
  const { chat_id } = await leerTg(knex)
  if (!chat_id) return { ok: false, error: "Telegram no está vinculado." }
  const base = { red: "telegram_privado", chat: chat_id, texto: m.texto.slice(0, 3800), post: m.post || "" }
  let r: any = await enviarAN8n({ ...base, imagen: m.imagen || "", video: m.video || "" })
  if (!r.ok && (m.imagen || m.video)) r = await enviarAN8n({ ...base, texto: `${base.texto}\n\n${m.video ? "🎬" : "🖼"} ${m.video || m.imagen}`.slice(0, 4000) })
  return r
}

const esVideo = (m: any) => m && (m.tipo === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(String(m.url)))
const fechaLocal = (d: any, mercado?: string) => (d ? new Date(d).toLocaleString("es-MX", { timeZone: zonaDe(mercado), weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "sin fecha")

export function puntajeDe(p: any) {
  const ps = (p.redes || []).filter((r: string) => r !== "instagram_historia").map((red: string) => puntuar(p.textos?.[red] || "", red, { medios: p.medios, programada_para: p.programada_para, mercado: p.mercado }).puntaje)
  return ps.length ? Math.min(...ps) : 0
}

/** Texto de la vista previa que llega a Telegram. */
export function vistaPrevia(p: any) {
  const red = (p.redes || [])[0]
  const texto = String(p.textos?.[red] || p.texto_base || "").replace(/\{\{liga\}\}/g, "[liga medida]")
  const medios = p.medios || []
  const material = !medios.length ? "⚠ sin imagen ni video" : esVideo(medios[0]) ? "🎬 video" : medios.length > 1 ? `🖼 carrusel de ${medios.length}` : "🖼 imagen"
  return (
    `📝 ${p.titulo}\n🗓 ${fechaLocal(p.programada_para, p.mercado)} · ${MERCADOS[p.mercado || "mx"]?.nombre || "México"}\n` +
    `📣 ${(p.redes || []).map((r: string) => REDES[r]?.nombre || r).join(", ")}\n${material} · puntaje ${puntajeDe(p)}\n\n${texto}`
  ).slice(0, 950)
}

async function mandarVista(knex: any, p: any) {
  const m = (p.medios || [])[0]
  return mandarPrivado(knex, { texto: vistaPrevia(p), post: p.id, ...(m ? (esVideo(m) ? { video: m.url } : { imagen: m.url }) : {}) })
}

/** Manda los borradores que tocan en las próximas `horas` (máx. `max`). */
export async function mandarBorradores(knex: any, o: { horas?: number; max?: number } = {}) {
  const { chat_id } = await leerTg(knex)
  if (!chat_id) return { enviados: 0, vinculado: false }
  const hasta = new Date(Date.now() + (o.horas || 24) * 3600_000)
  const q = () => knex(T_POST).where({ estado: "borrador" }).where((x: any) => x.whereNull("programada_para").orWhere("programada_para", "<=", hasta))
  const total = Number((await q().count({ n: "*" }).first())?.n || 0)
  const lista = await q().orderByRaw("programada_para asc nulls last").limit(o.max || 12)
  const programadas = Number((await knex(T_POST).where({ estado: "programada" }).where("programada_para", "<=", hasta).count({ n: "*" }).first())?.n || 0)
  await mandarPrivado(knex, {
    texto: total
      ? `☀️ HETNA Social Hub\n${total} borrador${total === 1 ? "" : "es"} por revisar para las próximas ${o.horas || 24} h${total > lista.length ? ` (te mando ${lista.length})` : ""}. Ya programadas: ${programadas}.\n\n✅ Aprobar = sale a su hora · 🚀 = sale ahora · ✏️ = dime qué cambiar · 🗑 = descartar`
      : `☀️ HETNA Social Hub\nNada por revisar. Programadas para las próximas ${o.horas || 24} h: ${programadas}.`,
  })
  let enviados = 0
  for (const p of lista) if ((await mandarVista(knex, p)).ok) enviados++
  return { enviados, total, vinculado: true }
}

/** Job de cada hora: manda el aviso diario a la hora configurada (una vez al día). */
export async function avisoDiario(knex: any, logger?: any) {
  const cfg = await leerConfig(knex)
  const tg = await leerTg(knex)
  if (!tg.chat_id) return
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })
  if (horaEn(new Date()) !== cfg.aviso_hora || tg.ultimo_aviso === hoy) return
  await guardarTg(knex, { ultimo_aviso: hoy })
  const r = await mandarBorradores(knex)
  logger?.info?.(`[social] aviso diario por Telegram: ${r.enviados} borradores`)
}

let ia: Anthropic | null = null
/** Reescribe el texto base con la instrucción del dueño (sin inventar datos). */
async function aplicarCambio(p: any, instruccion: string, logger?: any) {
  if (!iaSocial()) return instruccion.includes("{{liga}}") ? instruccion : `${instruccion}\n\n{{liga}}`
  try {
    ia ??= new Anthropic()
    const resp = await ia.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1500,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "Eres el editor de redes de HETNA CNC. Recibes una publicación y la instrucción del dueño. Devuelve SÓLO el texto de la publicación corregido, sin comentarios. " +
        "Aplica la instrucción; si el dueño mandó un texto completo nuevo, úsalo tal cual. No inventes precios, cifras, clientes ni promociones. Conserva la marca {{liga}} donde va la liga.",
      messages: [{ role: "user", content: `Mercado: ${MERCADOS[p.mercado || "mx"]?.nota}\n\nPUBLICACIÓN:\n${p.texto_base}\n\nINSTRUCCIÓN DEL DUEÑO:\n${instruccion}` }],
    } as any)
    if (resp.stop_reason === "refusal") return null
    const t = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim()
    return t ? (t.includes("{{liga}}") ? t : `${t}\n\n{{liga}}`) : null
  } catch (e) {
    logger?.warn?.(`[social] cambio por Telegram: ${(e as Error).message}`)
    return null
  }
}

const AYUDA = "Comandos:\n/pendientes — te mando los borradores de las próximas 24 h\n/semana — los de los próximos 7 días\n/cancelar — salir de ✏️ Cambiar\n\nEn cada borrador: ✅ Aprobar (sale a su hora), 🚀 Publicar ya, ✏️ Cambiar y 🗑 Descartar."

/** Atiende un mensaje o botón que llega de Telegram (vía n8n). Regresa el texto de respuesta. */
export async function atender(knex: any, b: { tipo: string; chat_id: string; texto?: string; data?: string }, logger?: any): Promise<string> {
  const chat = String(b.chat_id || "")
  const texto = String(b.texto || "").trim()
  const tg = await leerTg(knex)

  // Vincular: /vincular 123456 (el código sale del panel y dura 15 minutos)
  const v = texto.match(/^\/vincular(?:@\w+)?\s+(\d{6})$/i)
  if (v) {
    const vigente = tg.codigo && tg.codigo_expira && new Date(tg.codigo_expira).getTime() > Date.now()
    if (!vigente || v[1] !== tg.codigo) return "Código incorrecto o vencido. Genera uno nuevo en Admin → Social Hub → Configuración."
    await guardarTg(knex, { chat_id: chat, codigo: undefined, codigo_expira: undefined, editando: null })
    return `✅ Listo: este chat quedó vinculado al Social Hub de HETNA.\n\n${AYUDA}`
  }
  if (!tg.chat_id || chat !== String(tg.chat_id)) return /^\//.test(texto) || b.tipo === "boton" ? "Este bot es privado de HETNA CNC." : ""

  if (b.tipo === "boton") {
    const [accion, id] = String(b.data || "").split(":")
    const p = id ? await knex(T_POST).where({ id }).first() : null
    if (!p) return "No encontré esa publicación."
    if (["publicada", "publicando"].includes(p.estado)) return `Ya ${p.estado === "publicada" ? "está publicada" : "se está publicando"}: ${p.titulo}`
    if (p.estado === "descartada" && accion !== "a") return `Ya estaba descartada: ${p.titulo}`
    const cfg = await leerConfig(knex)
    switch (accion) {
      case "a": {
        const min = new Date(Date.now() + 3 * 60_000)
        const cuando = dentroDeHorario(p.programada_para && new Date(p.programada_para) > min ? new Date(p.programada_para) : min, cfg.horario, zonaDe(p.mercado))
        await knex(T_POST).where({ id }).update({ estado: "programada", programada_para: cuando, updated_at: knex.fn.now() })
        return `✅ Aprobada: sale el ${fechaLocal(cuando, p.mercado)}.\n${p.titulo}`
      }
      case "y":
        // Publicar tarda (Instagram procesa el archivo): se hace aparte y se avisa el resultado
        setImmediate(async () => {
          try {
            const r = await publicar(knex, id, logger)
            const lineas = Object.entries(r?.resultado || {}).map(([red, x]: any) => `${x.ok ? (x.manual ? "✋" : "✓") : x.pendiente ? "⏳" : "✗"} ${REDES[red]?.nombre || red}${x.url ? ` ${x.url}` : x.error ? `: ${x.error}` : x.manual ? " (copiar y pegar)" : ""}`)
            await mandarPrivado(knex, { texto: `🚀 ${p.titulo}\n${lineas.join("\n") || "No se pudo publicar (¿se estaba publicando ya?)."}` })
          } catch (e) {
            await mandarPrivado(knex, { texto: `✗ No se pudo publicar "${p.titulo}": ${(e as Error).message}` })
          }
        })
        return `🚀 Publicando ahora: ${p.titulo}. Te aviso el resultado.`
      case "c":
        await guardarTg(knex, { editando: id })
        return `✏️ ¿Qué le cambio a "${p.titulo}"?\nEscríbeme la instrucción (ej. "más corto y con pregunta al inicio") o el texto nuevo completo. /cancelar para salir.`
      case "d":
        await knex(T_POST).where({ id }).whereNot({ estado: "publicando" }).update({ estado: "descartada", updated_at: knex.fn.now() })
        return `🗑 Descartada: ${p.titulo}`
      default:
        return "Botón no reconocido."
    }
  }

  if (/^\/cancelar/i.test(texto)) {
    await guardarTg(knex, { editando: null })
    return "Listo, no cambié nada."
  }
  if (/^\/(pendientes|semana)/i.test(texto)) {
    const semana = /^\/semana/i.test(texto)
    setImmediate(() => mandarBorradores(knex, { horas: semana ? 168 : 24, max: semana ? 25 : 12 }).catch((e) => logger?.warn?.(`[social] /pendientes: ${e.message}`)))
    return "Va, te los mando…"
  }
  if (/^\/(start|ayuda|help)/i.test(texto)) return AYUDA

  if (tg.editando && texto) {
    const p = await knex(T_POST).where({ id: tg.editando }).first()
    await guardarTg(knex, { editando: null })
    if (!p || !["borrador", "programada", "error"].includes(p.estado)) return "Esa publicación ya no se puede cambiar."
    const base = await aplicarCambio(p, texto.slice(0, 3000), logger)
    if (!base) return "No pude aplicar el cambio. Inténtalo de nuevo o cámbiala en el panel."
    const { textos, ia: conIa } = await adaptar(base, p.redes || [], logger, p.mercado || "mx")
    await knex(T_POST).where({ id: p.id }).update({ texto_base: base, textos: JSON.stringify(textos), adaptada_ia: conIa, updated_at: knex.fn.now() })
    const nueva = await knex(T_POST).where({ id: p.id }).first()
    setImmediate(() => mandarVista(knex, nueva).catch(() => {}))
    return "✏️ Cambiada. Te mando cómo quedó…"
  }
  return texto ? `No entendí.\n\n${AYUDA}` : ""
}

/** Piloto automático: programa solos los borradores generados que ya están listos. */
export async function pilotoAutomatico(knex: any, logger?: any) {
  const cfg = await leerConfig(knex)
  if (!cfg.piloto.activo) return { programadas: 0 }
  // Borradores anteriores a la columna "fuente": se reconocen por el plan o el título
  await knex.raw(`update ?? set fuente = 'plan' where fuente is null and estado = 'borrador' and id in (select post_id from hetna_social_plan where post_id is not null)`, [T_POST]).catch(() => {})
  await knex.raw(`update ?? set fuente = case when titulo like 'Promo%' then 'promo' else 'fabrica' end where fuente is null and estado = 'borrador' and (titulo like 'Promo%' or titulo like 'Fábrica ·%')`, [T_POST]).catch(() => {})
  const lista = await knex(T_POST)
    .where({ estado: "borrador" })
    .whereIn("fuente", ["plan", "promo", "fabrica"])
    .whereNotNull("programada_para")
    .where("programada_para", "<=", knex.raw("now() + interval '36 hours'"))
    .whereRaw(`coalesce(jsonb_array_length(medios), 0) > 0`)
    .orderBy("programada_para")
    .limit(30)
  let n = 0
  for (const p of lista) {
    const redes = p.redes || []
    if (cfg.piloto.redes.length && !redes.every((r: string) => cfg.piloto.redes.includes(r))) continue
    if (puntajeDe(p) < cfg.piloto.minimo) {
      // Una oportunidad: el revisor con IA corrige lo que falta y se vuelve a medir
      if (p.revisada_ia) continue
      await revisarPublicacion(knex, p.id, logger)
      const otra = await knex(T_POST).where({ id: p.id }).first()
      if (!otra || otra.estado !== "borrador" || puntajeDe(otra) < cfg.piloto.minimo) continue
    }
    const min = new Date(Date.now() + 10 * 60_000)
    const cuando = dentroDeHorario(new Date(p.programada_para) > min ? new Date(p.programada_para) : min, cfg.horario, zonaDe(p.mercado))
    await knex(T_POST).where({ id: p.id, estado: "borrador" }).update({ estado: "programada", programada_para: cuando, piloto: true, updated_at: knex.fn.now() })
    n++
  }
  if (n) logger?.info?.(`[social] piloto automático: ${n} programadas`)
  return { programadas: n }
}
