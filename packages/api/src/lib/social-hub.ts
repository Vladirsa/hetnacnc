// @ts-nocheck
// Licitaciones 3.0 — Fase 5A: HETNA Social Hub.
// (docs/licitaciones-especificacion-maestra.md, sección 3)
//
// Central de publicaciones en redes desde el Admin:
//   - Borradores automáticos: licitación (sólo con autorización del cliente y
//     resumen sin datos sensibles), taller aprobado, producto nuevo y tema del
//     foro. Cada tipo puede salir solo o esperar visto bueno (configuración).
//   - Publicaciones manuales con fotos.
//   - La IA (si hay llave) adapta el texto a cada red; si no, plantillas.
//   - Calendario: se programan y un job publica a su hora, dentro del horario
//     configurado (por omisión 9:00 a 20:00, hora del centro de México).
//   - Publica n8n (flujo "Social Hub - Publicar"): ahí viven las conexiones a
//     Facebook, Instagram, Telegram, LinkedIn y Discord. Las redes que no se
//     pueden automatizar (grupos de Facebook, WhatsApp, Reddit) quedan como
//     "copiar y pegar" con su liga medida.
//   - Medición: cada publicación y red lleva su liga corta hetnacnc.com/r/xxxx.
//     Se cuentan clics y lo que esa persona hace después (registro de cliente
//     o taller, solicitud y venta) durante 30 días.
import { randomBytes } from "crypto"
import Anthropic from "@anthropic-ai/sdk"

import { STORE_URL, nuevoId } from "./licitacion"
import { sendEmail } from "./resend"

export const T_POST = "hetna_social_post"
export const T_LIGA = "hetna_social_liga"
export const T_EVENTO_S = "hetna_social_evento"
export const T_CONFIG_S = "hetna_social_config"

export type Red = "facebook" | "instagram" | "telegram" | "linkedin" | "discord" | "grupos_facebook" | "whatsapp" | "reddit" | "pinterest" | "tiktok" | "youtube"
export const REDES: Record<Red, { nombre: string; auto: boolean; max: number; imagen?: "requerida" | "opcional"; estilo: string }> = {
  facebook: { nombre: "Facebook (página)", auto: true, max: 1500, imagen: "opcional", estilo: "cercano, 2-4 líneas, 1-2 emojis, pregunta o llamada a la acción" },
  instagram: { nombre: "Instagram", auto: true, max: 2000, imagen: "requerida", estilo: "visual, emojis, 3-5 hashtags específicos al final en el idioma del mercado (#CNC #CorteLaser y el país). La liga no es clicable: di 'liga en la bio'" },
  telegram: { nombre: "Telegram (canal)", auto: true, max: 900, imagen: "opcional", estilo: "directo, informativo, con la liga" },
  linkedin: { nombre: "LinkedIn (empresa)", auto: true, max: 2500, imagen: "opcional", estilo: "profesional B2B, enfocado en compradores industriales y empresas; sin muchos emojis" },
  discord: { nombre: "Discord", auto: true, max: 1500, imagen: "opcional", estilo: "comunidad técnica, breve" },
  grupos_facebook: { nombre: "Grupos de Facebook", auto: false, max: 1500, estilo: "como miembro de la comunidad, útil y no vendedor; invita a opinar" },
  whatsapp: { nombre: "WhatsApp (compartir)", auto: false, max: 700, estilo: "muy breve, para reenviar a contactos o estados" },
  reddit: { nombre: "Reddit", auto: false, max: 1500, estilo: "técnico y honesto, sin tono de anuncio; aporta valor primero" },
  pinterest: { nombre: "Pinterest", auto: false, max: 450, imagen: "requerida", estilo: "descriptivo con palabras clave" },
  // Video: por ahora se suben a mano (servicio aprobado en la etapa 5B)
  tiktok: { nombre: "TikTok", auto: false, max: 2200, imagen: "requerida", estilo: "muy corto y directo; palabras clave del tema dichas en el texto (TikTok funciona como buscador); 3 a 5 hashtags; la liga va en el perfil" },
  youtube: { nombre: "YouTube (Shorts)", auto: false, max: 3000, imagen: "requerida", estilo: "título con la palabra clave al inicio; descripción con la liga en la primera línea; 2 o 3 hashtags" },
}
export const ORIGENES = ["manual", "licitacion", "taller", "producto", "foro", "taller_video"] as const
export type Origen = (typeof ORIGENES)[number]

export type ConfigSocial = {
  redes: Red[] // redes activas para los automáticos
  automatico: Record<Exclude<Origen, "manual" | "taller_video">, boolean>
  horario: { desde: number; hasta: number } // horas, hora del centro de México
  retraso_min: number
}
const CONFIG_INICIAL: ConfigSocial = {
  redes: ["facebook", "telegram"],
  // promociones: imagen y video diarios de productos, blog y herramientas (lib/fabrica/promociones)
  automatico: { licitacion: true, taller: true, producto: true, foro: true, promociones: false },
  horario: { desde: 9, hasta: 20 },
  retraso_min: 10,
}

let listo = false
export async function asegurarSocial(knex: any) {
  if (listo) return
  const crear = async (t: string, fn: (tb: any) => void) => {
    if (!(await knex.schema.hasTable(t))) await knex.schema.createTable(t, fn)
  }
  await crear(T_POST, (t) => {
    t.text("id").primary()
    t.text("origen").notNullable()
    t.text("origen_id")
    t.text("titulo").notNullable()
    t.text("texto_base").notNullable()
    t.jsonb("textos").notNullable() // { red: texto }
    t.jsonb("redes").notNullable() // [red]
    t.jsonb("medios") // [{ url, tipo: "imagen" | "video" }]
    t.text("url_destino")
    t.text("estado").notNullable() // borrador | programada | publicando | publicada | parcial | error | descartada
    t.timestamp("programada_para", { useTz: true })
    t.timestamp("publicada_en", { useTz: true })
    t.jsonb("resultado") // { red: { ok, url, error, en } }
    t.boolean("adaptada_ia")
    t.timestamps(true, true)
    t.unique(["origen", "origen_id"])
  })
  await knex.raw(`alter table ?? add column if not exists mercado text`, [T_POST]).catch(() => {})
  await knex.raw(`alter table ?? add column if not exists notas text`, [T_POST]).catch(() => {})
  // Estadísticas de cada red (alcance, me gusta, comentarios, compartidos, guardados, vistas)
  await knex.raw(`alter table ?? add column if not exists estadisticas jsonb`, [T_POST]).catch(() => {})
  await crear(T_LIGA, (t) => {
    t.text("codigo").primary()
    t.text("post_id").index()
    t.text("red").notNullable()
    t.text("grupo") // p. ej. el nombre del grupo de Facebook donde se pegó
    t.text("destino").notNullable()
    t.integer("clics").notNullable().defaultTo(0)
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
  })
  await crear(T_EVENTO_S, (t) => {
    t.text("id").primary()
    t.text("codigo").notNullable().index()
    t.text("tipo").notNullable() // clic | registro_cliente | registro_taller | solicitud | venta
    t.decimal("valor", 14, 2)
    t.text("ref")
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
    t.unique(["codigo", "tipo", "ref"])
  })
  await crear(T_CONFIG_S, (t) => {
    t.text("clave").primary()
    t.jsonb("valor").notNullable()
  })
  listo = true
}

// ---------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------

export async function leerConfig(knex: any): Promise<ConfigSocial> {
  await asegurarSocial(knex)
  const r = await knex(T_CONFIG_S).where({ clave: "general" }).first()
  const v = r?.valor || {}
  return {
    redes: Array.isArray(v.redes) ? v.redes.filter((x: string) => x in REDES) : CONFIG_INICIAL.redes,
    automatico: { ...CONFIG_INICIAL.automatico, ...(v.automatico || {}) },
    horario: { ...CONFIG_INICIAL.horario, ...(v.horario || {}) },
    retraso_min: Number.isFinite(Number(v.retraso_min)) ? Math.max(0, Math.min(1440, Number(v.retraso_min))) : CONFIG_INICIAL.retraso_min,
  }
}

export async function guardarConfig(knex: any, c: Partial<ConfigSocial>) {
  const actual = await leerConfig(knex)
  const nueva: ConfigSocial = {
    redes: Array.isArray(c.redes) ? (c.redes.filter((x) => x in REDES) as Red[]) : actual.redes,
    automatico: { ...actual.automatico, ...Object.fromEntries(Object.entries(c.automatico || {}).filter(([k]) => k in actual.automatico).map(([k, v]) => [k, !!v])) },
    horario: {
      desde: Math.max(0, Math.min(23, Math.round(Number(c.horario?.desde ?? actual.horario.desde)))),
      hasta: Math.max(1, Math.min(24, Math.round(Number(c.horario?.hasta ?? actual.horario.hasta)))),
    },
    retraso_min: c.retraso_min != null ? Math.max(0, Math.min(1440, Math.round(Number(c.retraso_min)))) : actual.retraso_min,
  }
  if (nueva.horario.hasta <= nueva.horario.desde) nueva.horario = actual.horario
  await knex.raw(`insert into ?? (clave, valor) values ('general', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(nueva)])
  return nueva
}

// ---------------------------------------------------------------------
// Horario: mueve una fecha a la siguiente hora permitida (centro de México)
// ---------------------------------------------------------------------

const ZONA = "America/Mexico_City"
export const horaEn = (d: Date, zona = ZONA) => Number(new Intl.DateTimeFormat("en-US", { timeZone: zona, hour: "numeric", hourCycle: "h23" }).format(d))

// Mercados (Marketing HETNA): zona horaria, idioma y cómo escribirle a cada país.
// Todos los mercados publican desde las mismas cuentas de HETNA (decisión del
// dueño): cada publicación sale en el idioma de su mercado y a sus horas.
export const MERCADOS: Record<string, { nombre: string; zona: string; idioma: string; nota: string }> = {
  mx: { nombre: "México", zona: "America/Mexico_City", idioma: "es-MX", nota: "español de México, pesos (MXN), milímetros" },
  us: { nombre: "Estados Unidos", zona: "America/Chicago", idioma: "en-US", nota: "inglés de EE.UU., dólares (USD), pulgadas; enfoque en talleres mexicanos verificados (nearshoring, T-MEC)" },
  co: { nombre: "Colombia", zona: "America/Bogota", idioma: "es-CO", nota: "español de Colombia, pesos colombianos (COP), milímetros" },
  cl: { nombre: "Chile", zona: "America/Santiago", idioma: "es-CL", nota: "español de Chile, pesos chilenos (CLP), milímetros" },
  pe: { nombre: "Perú", zona: "America/Lima", idioma: "es-PE", nota: "español de Perú, soles (PEN), milímetros" },
  ar: { nombre: "Argentina", zona: "America/Argentina/Buenos_Aires", idioma: "es-AR", nota: "español rioplatense (voseo), pesos argentinos (ARS), milímetros" },
  br: { nombre: "Brasil", zona: "America/Sao_Paulo", idioma: "pt-BR", nota: "portugués de Brasil, reales (BRL), milímetros" },
}
export const zonaDe = (mercado?: string | null) => MERCADOS[mercado || "mx"]?.zona || ZONA

/** Si `d` cae fuera del horario (en la zona del mercado), la recorre a la siguiente apertura (+15 min). */
export function dentroDeHorario(d: Date, h: { desde: number; hasta: number }, zona = ZONA): Date {
  let x = new Date(d)
  for (let i = 0; i < 48; i++) {
    const hh = horaEn(x, zona)
    if (hh >= h.desde && hh < h.hasta) return x
    // Avanza a la siguiente hora en punto y vuelve a probar
    x = new Date(Math.floor(x.getTime() / 3_600_000 + 1) * 3_600_000 + 15 * 60_000)
  }
  return x
}

// ---------------------------------------------------------------------
// Textos por red
// ---------------------------------------------------------------------

const corta = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…")
const LIGA_MARCA = "{{liga}}"

/** Texto base según de dónde viene la publicación. Siempre con {{liga}}. */
export function textoBase(origen: Origen, d: { titulo: string; resumen?: string; lugar?: string; precio?: string }) {
  const r = d.resumen ? `\n\n${d.resumen}` : ""
  const l = d.lugar ? `\n📍 ${d.lugar}` : ""
  if (origen === "licitacion") return `🔧 Nueva solicitud de cotización en HETNA CNC\n\n${d.titulo}${l}${r}\n\n¿Tienes taller? Envía tu propuesta sin comisión: ${LIGA_MARCA}`
  if (origen === "taller") return `🏭 Nuevo taller en HETNA CNC: ${d.titulo}${l}${r}\n\nConoce sus trabajos y pídele cotización: ${LIGA_MARCA}`
  if (origen === "producto") return `🛒 Nuevo en la tienda HETNA: ${d.titulo}${d.precio ? ` — ${d.precio}` : ""}${r}\n\nVelo aquí: ${LIGA_MARCA}`
  if (origen === "taller_video") return `🔧 ${d.titulo}${r}\n\nCotiza con este taller: ${LIGA_MARCA}`
  if (origen === "foro") return `💬 Nuevo en el Foro CNC México: ${d.titulo}${r}\n\nParticipa: ${LIGA_MARCA}`
  return `${d.titulo}${r}\n\n${LIGA_MARCA}`
}

/** Adaptación sin IA: recorta y agrega lo propio de cada red. */
export function adaptarSinIa(base: string, red: Red) {
  const cfg = REDES[red]
  let t = base
  if (red === "instagram") t = t.replace(LIGA_MARCA, "liga en la bio 👆") + "\n\n#CNC #Mexico #HETNACNC #Manufactura #Taller"
  if (red === "linkedin") t = t.replace(/[🔧🏭🛒💬📍👆]/gu, "").replace(/\n{3,}/g, "\n\n").trim()
  return corta(t, cfg.max)
}

let ia: Anthropic | null = null
const MODELO = "claude-opus-5-5"
export const iaSocial = () => !!process.env.ANTHROPIC_API_KEY && (process.env.SOCIAL_IA || "").toLowerCase() !== "off"

/** Pide a Claude un texto por red. Devuelve null si no hay IA o falla. */
export async function adaptarConIa(base: string, redes: Red[], logger?: any, mercado = "mx"): Promise<Record<string, string> | null> {
  if (!iaSocial() || !redes.length) return null
  try {
    ia ??= new Anthropic()
    const guia = redes.map((r) => `- ${r}: máximo ${REDES[r].max} caracteres; estilo: ${REDES[r].estilo}`).join("\n")
    const resp = await ia.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object", properties: Object.fromEntries(redes.map((r) => [r, { type: "string" }])), required: redes, additionalProperties: false } } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "Eres el community manager de HETNA CNC, marketplace mexicano de fabricación CNC (talleres, clientes industriales y proveedores). " +
        `Adapta la publicación a cada red para el mercado ${MERCADOS[mercado]?.nombre || "México"}: escribe en ${MERCADOS[mercado]?.nota || "español de México"}. Si el texto original está en otro idioma, tradúcelo y adáptalo (no traduzcas literal). Reglas: usa SOLO los datos del texto original; no inventes precios, capacidades, ` +
        "clientes, cifras ni promociones. Conserva exactamente la marca {{liga}} donde va la liga (en Instagram reemplázala por 'liga en la bio'). " +
        "Nunca incluyas teléfonos, correos ni nombres de clientes.",
      messages: [{ role: "user", content: `Texto original:\n${base}\n\nRedes:\n${guia}` }],
    } as any)
    if (resp.stop_reason === "refusal") return null
    const txt = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
    const json = JSON.parse(txt)
    const out: Record<string, string> = {}
    for (const r of redes) if (typeof json[r] === "string" && json[r].trim()) out[r] = corta(json[r].trim(), REDES[r].max)
    return Object.keys(out).length ? out : null
  } catch (e) {
    logger?.warn?.(`[social] IA no disponible: ${(e as Error).message}`)
    return null
  }
}

export async function adaptar(base: string, redes: Red[], logger?: any, mercado = "mx") {
  const conIa = await adaptarConIa(base, redes, logger, mercado)
  const textos: Record<string, string> = {}
  for (const r of redes) textos[r] = conIa?.[r] || adaptarSinIa(base, r)
  return { textos, ia: !!conIa }
}

// ---------------------------------------------------------------------
// Ligas medidas
// ---------------------------------------------------------------------

const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789"
const nuevoCodigo = () => Array.from(randomBytes(7), (b) => ALFABETO[b % ALFABETO.length]).join("")
export const urlCorta = (codigo: string) => `${STORE_URL}/r/${codigo}`

export async function ligaPara(knex: any, postId: string | null, red: string, destino: string, grupo?: string | null) {
  await asegurarSocial(knex)
  const previa = await knex(T_LIGA).where({ post_id: postId, red, grupo: grupo || null }).first()
  if (previa) return previa.codigo
  for (let i = 0; i < 5; i++) {
    const codigo = nuevoCodigo()
    try {
      await knex(T_LIGA).insert({ codigo, post_id: postId, red, grupo: grupo || null, destino })
      return codigo
    } catch {}
  }
  throw new Error("No se pudo crear la liga")
}

/** Clic en hetnacnc.com/r/:codigo -> destino con UTM. */
export async function registrarClic(knex: any, codigo: string) {
  await asegurarSocial(knex)
  const l = await knex(T_LIGA).where({ codigo }).first()
  if (!l) return null
  await knex(T_LIGA).where({ codigo }).increment("clics", 1)
  await knex(T_EVENTO_S).insert({ id: nuevoId("sev"), codigo, tipo: "clic", ref: nuevoId("c") }).catch(() => {})
  const u = new URL(l.destino, STORE_URL)
  if (u.origin === new URL(STORE_URL).origin) {
    u.searchParams.set("utm_source", l.red)
    u.searchParams.set("utm_medium", "social")
    u.searchParams.set("utm_campaign", l.post_id || "hetna")
    if (l.grupo) u.searchParams.set("utm_content", l.grupo.slice(0, 60))
  }
  return { destino: u.toString(), red: l.red }
}

export const TIPOS_EVENTO = ["registro_cliente", "registro_taller", "solicitud", "venta"] as const

/** Conversión atribuida a una liga (desde la tienda, con la cookie hetna_ref). */
export async function registrarEvento(knex: any, codigo: string, tipo: string, valor?: number | null, ref?: string | null) {
  await asegurarSocial(knex)
  if (!(TIPOS_EVENTO as readonly string[]).includes(tipo)) return false
  if (!/^[a-z0-9]{7}$/.test(codigo) || !(await knex(T_LIGA).where({ codigo }).first("codigo"))) return false
  await knex(T_EVENTO_S)
    .insert({ id: nuevoId("sev"), codigo, tipo, valor: valor != null && Number.isFinite(Number(valor)) ? Number(valor) : null, ref: ref ? String(ref).slice(0, 80) : null })
    .onConflict(["codigo", "tipo", "ref"])
    .ignore()
  return true
}

// ---------------------------------------------------------------------
// Publicaciones
// ---------------------------------------------------------------------

type NuevaPub = {
  origen: Origen
  origen_id?: string | null
  titulo: string
  resumen?: string
  lugar?: string
  precio?: string
  texto_base?: string
  url: string
  medios?: { url: string; tipo?: string }[]
  redes?: Red[]
  programada_para?: Date | string | null
  estado?: "borrador" | "programada"
  mercado?: string
  textos?: Record<string, string> // textos ya escritos por red (no se vuelve a llamar a la IA)
  notas?: string // p. ej. el guion del video (no se publica)
}

/** Crea una publicación con sus textos por red (IA o plantillas). */
export async function crearPublicacion(knex: any, d: NuevaPub, logger?: any) {
  await asegurarSocial(knex)
  const cfg = await leerConfig(knex)
  const redes = (d.redes?.length ? d.redes : cfg.redes).filter((r) => r in REDES) as Red[]
  const base = d.texto_base?.trim() || textoBase(d.origen, d)
  const mercado = d.mercado && MERCADOS[d.mercado] ? d.mercado : "mx"
  const conLiga = base.includes(LIGA_MARCA) ? base : `${base}\n\n${LIGA_MARCA}`
  const { textos, ia: conIa } = d.textos
    ? { textos: Object.fromEntries(redes.map((r) => [r, d.textos![r] || adaptarSinIa(conLiga, r)])), ia: true }
    : await adaptar(conLiga, redes, logger, mercado)
  const id = nuevoId("spost")
  const prog = d.programada_para ? new Date(d.programada_para) : null
  await knex(T_POST).insert({
    id, origen: d.origen, origen_id: d.origen_id || null, titulo: corta(d.titulo, 160), texto_base: base,
    textos: JSON.stringify(textos), redes: JSON.stringify(redes), medios: JSON.stringify((d.medios || []).filter((m) => /^https:\/\//.test(m.url)).slice(0, 10)),
    url_destino: d.url, estado: d.estado || "borrador", programada_para: prog, adaptada_ia: conIa, mercado, notas: d.notas || null,
  })
  return id
}

/**
 * Publicación automática desde un evento del sitio. No repite (origen + id).
 * Según la configuración sale sola (programada dentro del horario) o queda
 * como borrador esperando visto bueno.
 */
export async function publicacionAutomatica(knex: any, d: NuevaPub & { origen: Exclude<Origen, "manual" | "taller_video">; origen_id: string }, logger?: any) {
  try {
    await asegurarSocial(knex)
    if (await knex(T_POST).where({ origen: d.origen, origen_id: d.origen_id }).first("id")) return null
    const cfg = await leerConfig(knex)
    const auto = !!cfg.automatico[d.origen]
    const cuando = auto ? dentroDeHorario(new Date(Date.now() + cfg.retraso_min * 60_000), cfg.horario) : null
    return await crearPublicacion(knex, { ...d, estado: auto ? "programada" : "borrador", programada_para: d.programada_para || cuando }, logger)
  } catch (e) {
    logger?.warn?.(`[social] no se creó la publicación automática (${d.origen}): ${(e as Error).message}`)
    return null
  }
}

/** URL del flujo de n8n que publica. Por omisión, junto al de avisos actual. */
export function urlN8nSocial() {
  if (process.env.N8N_SOCIAL_URL) return process.env.N8N_SOCIAL_URL
  const u = process.env.N8N_REDES_URL
  return u ? u.replace(/redes-contenido-nuevo\/?$/, "social-hub-publicar") : null
}

export async function enviarAN8n(cuerpo: any) {
  const url = urlN8nSocial()
  if (!url) return { ok: false, error: "Falta N8N_REDES_URL o N8N_SOCIAL_URL en el servidor." }
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": process.env.N8N_REDES_TOKEN || "" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(45_000),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, error: d?.error || d?.message || `n8n respondió ${r.status}` }
    if (d?.pendiente) return { ok: false, pendiente: true, contenedor: String(d.contenedor || ""), error: null }
    return { ok: d?.ok !== false, url: d?.url || null, id: d?.id ? String(d.id) : null, datos: d?.datos || null, usuario: d?.usuario || null, error: d?.ok === false ? d?.error || "La red rechazó la publicación" : null }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Publica en las redes automáticas; las manuales quedan listas para copiar. */
export async function publicar(knex: any, postId: string, logger?: any, soloRedes?: Red[]) {
  await asegurarSocial(knex)
  const n = await knex(T_POST).where({ id: postId }).whereIn("estado", ["programada", "borrador", "error", "parcial"]).update({ estado: "publicando", updated_at: knex.fn.now() })
  if (!n) return null
  const p = await knex(T_POST).where({ id: postId }).first()
  const resultado = { ...(p.resultado || {}) }
  const medio = (p.medios || [])[0] || null
  const esVideo = medio?.tipo === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(String(medio?.url || ""))
  const imagen = medio && !esVideo ? medio.url : ""
  const video = medio && esVideo ? medio.url : ""
  // Varias imágenes: carrusel en Instagram (hasta 10)
  const imagenes = esVideo ? [] : (p.medios || []).filter((m: any) => m?.url && m.tipo !== "video" && !/\.(mp4|mov|webm)(\?|$)/i.test(String(m.url))).map((m: any) => m.url).slice(0, 10)
  for (const red of (p.redes as Red[]).filter((r) => !soloRedes || soloRedes.includes(r))) {
    if (resultado[red]?.ok) continue
    const codigo = await ligaPara(knex, p.id, red, p.url_destino)
    const liga = urlCorta(codigo)
    const texto = String(p.textos?.[red] || adaptarSinIa(p.texto_base, red)).replace(LIGA_MARCA, liga)
    if (!REDES[red]?.auto) {
      resultado[red] = { ok: true, manual: true, en: new Date().toISOString() }
      continue
    }
    if (REDES[red].imagen === "requerida" && !imagen && !video) {
      resultado[red] = { ok: false, error: "Esta red necesita una imagen.", en: new Date().toISOString() }
      continue
    }
    // Instagram: si ya hay contenedor en proceso, sólo se intenta terminarlo
    if (red === "instagram" && resultado.instagram?.pendiente && resultado.instagram?.contenedor) {
      resultado.instagram = { ...(await terminarContenedorIg(resultado.instagram.contenedor, resultado.instagram.creado)), en: new Date().toISOString() }
      continue
    }
    let r: any = await enviarAN8n({ red, texto, imagen, video, imagenes, url: liga, titulo: p.titulo, post_id: p.id })
    if (red === "instagram" && r.pendiente && r.contenedor) {
      // Instagram procesa el archivo: fotos en segundos, reels hasta unos minutos.
      // Se espera un poco aquí; si no termina, el job lo publica después.
      const creado = new Date().toISOString()
      r = { ...r, creado }
      for (let i = 0; i < (video ? 4 : 3); i++) {
        await new Promise((ok) => setTimeout(ok, video ? 15_000 : 5_000))
        const t = await terminarContenedorIg(r.contenedor, creado)
        r = t
        if (!t.pendiente) break
      }
    }
    resultado[red] = { ...r, en: new Date().toISOString() }
    if (!r.ok && !r.pendiente) logger?.warn?.(`[social] ${p.id} ${red}: ${r.error}`)
  }
  const autos = (p.redes as Red[]).filter((r) => REDES[r]?.auto)
  const oks = autos.filter((r) => resultado[r]?.ok).length
  const enProceso = autos.some((r) => resultado[r]?.pendiente)
  const estado = !autos.length || oks === autos.length ? "publicada" : oks || enProceso ? "parcial" : "error"
  await knex(T_POST).where({ id: p.id }).update({ estado, resultado: JSON.stringify(resultado), publicada_en: oks || !autos.length ? knex.fn.now() : null, updated_at: knex.fn.now() })
  return { estado, resultado }
}

/** Pregunta a Instagram si ya procesó el contenedor y, si sí, lo publica. Caduca a las 24 h. */
export async function terminarContenedorIg(contenedor: string, creado?: string) {
  const r: any = await enviarAN8n({ red: "instagram_publicar", contenedor, texto: "" })
  if (r.pendiente) {
    const viejo = creado && Date.now() - new Date(creado).getTime() > 23 * 3600_000
    if (viejo) return { ok: false, error: "Instagram no terminó de procesar el archivo en 24 horas." }
    return { ok: false, pendiente: true, contenedor, creado: creado || new Date().toISOString(), error: null }
  }
  return r
}

/** Termina las publicaciones de Instagram que quedaron procesándose. */
export async function terminarPendientesIg(knex: any, logger?: any) {
  const filas = await knex(T_POST).whereIn("estado", ["parcial", "error"]).whereRaw(`resultado->'instagram'->>'pendiente' = 'true'`).where("updated_at", ">=", knex.raw("now() - interval '2 days'")).limit(10).select("id")
  let n = 0
  for (const { id } of filas) {
    const r = await publicar(knex, id, logger, ["instagram"])
    if (r?.resultado?.instagram?.ok) n++
  }
  return n
}

/** Job: publica las programadas que ya tocan. */
export async function publicarPendientes(knex: any, logger?: any) {
  await asegurarSocial(knex)
  const cfg = await leerConfig(knex)
  // Las que se quedaron "publicando" más de 30 min (reinicio del servidor) vuelven a la cola
  await knex(T_POST).where({ estado: "publicando" }).where("updated_at", "<", knex.raw("now() - interval '30 minutes'")).update({ estado: "programada" })
  const listas = await knex(T_POST).where({ estado: "programada" }).where("programada_para", "<=", knex.fn.now()).orderBy("programada_para").limit(10).select("id", "mercado")
  let n = 0
  for (const { id, mercado } of listas) {
    // Cada mercado publica dentro de su propio horario
    const zona = zonaDe(mercado)
    const hh = horaEn(new Date(), zona)
    if (hh < cfg.horario.desde || hh >= cfg.horario.hasta) {
      await knex(T_POST).where({ id }).update({ programada_para: dentroDeHorario(new Date(), cfg.horario, zona) })
      continue
    }
    await publicar(knex, id, logger)
    if (++n >= 5) break
  }
  await terminarPendientesIg(knex, logger).catch((e: Error) => logger?.warn?.(`[social] Instagram pendientes: ${e.message}`))
  return n
}

/** Vista de una publicación para el panel (con textos ya con su liga). */
export async function vistaPublicacion(knex: any, p: any) {
  const ligas = await knex(T_LIGA).where({ post_id: p.id }).select("codigo", "red", "grupo", "clics")
  const eventos = ligas.length
    ? await knex(T_EVENTO_S).whereIn("codigo", ligas.map((l: any) => l.codigo)).groupBy("codigo", "tipo").select("codigo", "tipo").count({ n: "*" }).sum({ valor: "valor" })
    : []
  return {
    ...p,
    ligas: ligas.map((l: any) => ({
      ...l,
      url: urlCorta(l.codigo),
      eventos: Object.fromEntries(eventos.filter((e: any) => e.codigo === l.codigo).map((e: any) => [e.tipo, Number(e.n)])),
    })),
  }
}

// ---------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------

export async function metricas(knex: any, dias = 30) {
  await asegurarSocial(knex)
  const desde = knex.raw(`now() - (? || ' days')::interval`, [String(Math.max(1, Math.min(365, dias)))])
  const ev = await knex(`${T_EVENTO_S} as e`)
    .join(`${T_LIGA} as l`, "l.codigo", "e.codigo")
    .where("e.created_at", ">=", desde)
    .groupBy("l.red", "e.tipo")
    .select("l.red", "e.tipo")
    .count({ n: "*" })
    .sum({ valor: "e.valor" })
  const clics = await knex(`${T_EVENTO_S} as e`).join(`${T_LIGA} as l`, "l.codigo", "e.codigo").where("e.tipo", "clic").where("e.created_at", ">=", desde).groupBy("l.red").select("l.red").count({ n: "*" })
  const porRed: Record<string, any> = {}
  for (const r of [...Object.keys(REDES), "talleres"]) porRed[r] = { red: r, nombre: REDES[r as Red]?.nombre || "Difusión de los talleres", clics: 0, registro_cliente: 0, registro_taller: 0, solicitud: 0, venta: 0, ventas_mxn: 0 }
  for (const c of clics) if (porRed[c.red]) porRed[c.red].clics = Number(c.n)
  for (const e of ev) {
    if (!porRed[e.red] || e.tipo === "clic") continue
    porRed[e.red][e.tipo] = Number(e.n)
    if (e.tipo === "venta") porRed[e.red].ventas_mxn = Number(e.valor || 0)
  }
  // Comunidades (ligas con grupo) y publicaciones que más traen
  const grupos = await knex(`${T_LIGA} as l`)
    .leftJoin(`${T_EVENTO_S} as e`, function () {
      this.on("e.codigo", "=", "l.codigo").andOn("e.created_at", ">=", desde)
    })
    .whereNotNull("l.grupo")
    .groupBy("l.codigo", "l.grupo", "l.red")
    .select("l.codigo", "l.grupo", "l.red")
    .select(knex.raw(`count(*) filter (where e.tipo = 'clic') as clics`))
    .select(knex.raw(`count(*) filter (where e.tipo in ('registro_cliente','registro_taller','solicitud','venta')) as conversiones`))
    .orderBy("conversiones", "desc")
    .limit(30)
  const posts = await knex(`${T_POST} as p`)
    .join(`${T_LIGA} as l`, "l.post_id", "p.id")
    .leftJoin(`${T_EVENTO_S} as e`, function () {
      this.on("e.codigo", "=", "l.codigo").andOn("e.created_at", ">=", desde)
    })
    .groupBy("p.id", "p.titulo", "p.origen")
    .select("p.id", "p.titulo", "p.origen")
    .select(knex.raw(`count(*) filter (where e.tipo = 'clic') as clics`))
    .select(knex.raw(`count(*) filter (where e.tipo in ('registro_cliente','registro_taller','solicitud','venta')) as conversiones`))
    .orderBy("conversiones", "desc")
    .orderBy("clics", "desc")
    .limit(15)
  return {
    dias,
    por_red: Object.values(porRed).filter((r: any) => r.clics || r.registro_cliente || r.registro_taller || r.solicitud || r.venta),
    grupos: grupos.map((g: any) => ({ ...g, clics: Number(g.clics), conversiones: Number(g.conversiones), url: urlCorta(g.codigo) })),
    publicaciones: posts.map((p: any) => ({ ...p, clics: Number(p.clics), conversiones: Number(p.conversiones) })),
  }
}

/** Revisión semanal de integraciones: errores recientes y conexión con n8n. */
export async function revisarIntegraciones(knex: any, logger?: any) {
  await asegurarSocial(knex)
  const errores = await knex(T_POST).whereIn("estado", ["error", "parcial"]).where("updated_at", ">=", knex.raw("now() - interval '7 days'")).select("id", "titulo", "resultado")
  const prueba = await enviarAN8n({ red: "salud", texto: "", url: "" })
  const conN8n = prueba.ok || /desconocida|unknown/i.test(String(prueba.error || ""))
  const porRed: Record<string, string> = {}
  for (const e of errores) for (const [red, r] of Object.entries(e.resultado || {})) if (!(r as any).ok) porRed[red] = (r as any).error || "error"
  if ((!conN8n || Object.keys(porRed).length) && process.env.HETNA_LEADS_EMAIL) {
    await sendEmail({
      to: process.env.HETNA_LEADS_EMAIL,
      subject: "Social Hub: revisa las conexiones con redes",
      html:
        `<p>Revisión semanal del Social Hub.</p>` +
        (!conN8n ? `<p><b>No hay conexión con n8n</b>: ${String(prueba.error || "")}</p>` : "") +
        (Object.keys(porRed).length
          ? `<p>Redes con errores esta semana:</p><ul>${Object.entries(porRed).map(([r, e]) => `<li>${REDES[r as Red]?.nombre || r}: ${String(e).slice(0, 200)}</li>`).join("")}</ul><p>Suele ser un permiso vencido: reconéctalo en n8n.</p>`
          : ""),
    }).catch(() => {})
  }
  logger?.info?.(`[social] revisión: n8n ${conN8n ? "ok" : "sin conexión"}, ${errores.length} con errores`)
  return { n8n: conN8n, errores: porRed }
}
