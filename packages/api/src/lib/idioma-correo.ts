// Correos en el idioma del cliente (fase 4 del inglés).
//
// Cada correo de HETNA sale por lib/resend.ts > sendEmail. Si el destinatario
// tiene guardado el inglés, sendEmail traduce el asunto y el HTML con la IA del
// sistema antes de mandarlo, sin tocar las ligas ni el diseño. Si algo falla,
// el correo sale en español, como antes: nunca se pierde un correo por esto.
//
// De dónde sale el idioma de cada correo (tabla hetna_idioma_correo):
//   - el cliente entra o compra desde /us (POST /store/hetna-idioma),
//   - un pedido con dirección de envío en Estados Unidos (subscribers/correo-pedido.ts).
// Con INGLES_CORREOS=off no se traduce nada.
import Anthropic from "@anthropic-ai/sdk"
import { createHash } from "crypto"
import { Pool } from "pg"

import { IA_MODELO, modeloIA } from "./ia-modelo"

export type IdiomaCorreo = "es" | "en"

export const T_IDIOMA_CORREO = "hetna_idioma_correo"
export const T_CORREO_TRADUCIDO = "hetna_correo_traducido"

let pool: Pool | null = null
let tablas: Promise<void> | null = null

function db(): Pool | null {
  if (process.env.JEST_WORKER_ID || !process.env.DATABASE_URL) return null
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 30_000 })
  return pool
}

async function asegurar(p: Pool) {
  tablas ??= p
    .query(
      `create table if not exists ${T_IDIOMA_CORREO} (
         email text primary key, idioma text not null, actualizado_en timestamptz not null default now());
       create table if not exists ${T_CORREO_TRADUCIDO} (
         huella text primary key, asunto text not null, html text not null, creado_en timestamptz not null default now());`
    )
    .then(() => undefined)
    .catch((e) => {
      tablas = null
      throw e
    })
  return tablas
}

const normal = (email: string) => String(email || "").trim().toLowerCase()
export const correoValido = (email: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normal(email))

// Caché corta en memoria: un mismo cliente recibe varios correos seguidos
const cache = new Map<string, { idioma: IdiomaCorreo; hasta: number }>()

/** Guarda el idioma en que quiere sus correos una dirección. */
export async function guardarIdiomaCorreo(email: string, idioma: IdiomaCorreo): Promise<void> {
  const e = normal(email)
  if (!correoValido(e) || (idioma !== "es" && idioma !== "en")) return
  cache.set(e, { idioma, hasta: Date.now() + 5 * 60_000 })
  const p = db()
  if (!p) return
  await asegurar(p)
  await p.query(
    `insert into ${T_IDIOMA_CORREO} (email, idioma) values ($1, $2)
     on conflict (email) do update set idioma = excluded.idioma, actualizado_en = now()`,
    [e, idioma]
  )
}

/** Idioma de los correos de una dirección (español si no se sabe). */
export async function idiomaCorreo(email: string): Promise<IdiomaCorreo> {
  const e = normal(email)
  if (!correoValido(e)) return "es"
  const c = cache.get(e)
  if (c && c.hasta > Date.now()) return c.idioma
  const p = db()
  if (!p) return "es"
  await asegurar(p)
  const r = await p.query(`select idioma from ${T_IDIOMA_CORREO} where email = $1`, [e])
  const idioma: IdiomaCorreo = r.rows[0]?.idioma === "en" ? "en" : "es"
  cache.set(e, { idioma, hasta: Date.now() + 5 * 60_000 })
  return idioma
}

export const correosEnInglesEncendido = () =>
  !!process.env.ANTHROPIC_API_KEY && (process.env.INGLES_CORREOS || "").toLowerCase() !== "off"

// ------------------------------------------------------------------ traducción

/** Ligas, imágenes y códigos del HTML: la traducción debe conservarlos todos. */
export function huellasFijas(html: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/gi)) out.push(m[1])
  return out.sort()
}

/** Comprueba que la traducción conserva ligas, imágenes y la estructura. */
export function traduccionValida(original: string, traducido: string): boolean {
  if (!traducido || traducido.length < original.length * 0.4) return false
  const a = huellasFijas(original)
  const b = huellasFijas(traducido)
  if (a.length !== b.length || a.some((x, i) => x !== b[i])) return false
  const etiquetas = (h: string) => (h.match(/<(a|table|tr|td|img|p|div)\b/gi) || []).length
  return Math.abs(etiquetas(original) - etiquetas(traducido)) <= 2
}

let ia: Anthropic | null = null

/** Traduce asunto y HTML al inglés con la IA (con caché por contenido). */
export async function traducirCorreo(asunto: string, html: string): Promise<{ asunto: string; html: string }> {
  const huella = createHash("sha256").update(`${asunto}\n${html}`).digest("hex").slice(0, 40)
  const p = db()
  if (p) {
    await asegurar(p)
    const r = await p.query(`select asunto, html from ${T_CORREO_TRADUCIDO} where huella = $1`, [huella])
    if (r.rows[0]) return { asunto: r.rows[0].asunto, html: r.rows[0].html }
  }
  ia ??= new Anthropic()
  const resp: any = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO()),
    max_tokens: 16000,
    system:
      "Translate a transactional email from HETNA CNC (a Mexican CNC marketplace) from Mexican Spanish to natural US English. " +
      "The email body is HTML: keep every tag, attribute, style, URL, number, price, order number, code, and name exactly as is; translate only the visible text. " +
      "Keep the same tone (friendly, short). Translate 'taller' as 'shop', 'cotización' as 'quote', 'pedido' as 'order', 'envío' as 'shipping'. " +
      'Reply ONLY with JSON: {"asunto": "<subject in English>", "html": "<full HTML in English>"}',
    messages: [{ role: "user", content: JSON.stringify({ asunto, html }) }],
  } as any)
  const texto = (resp.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim()
  const d = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1))
  const nuevo = { asunto: String(d.asunto || "").trim(), html: String(d.html || "") }
  if (!nuevo.asunto || !traduccionValida(html, nuevo.html)) throw new Error("la traducción no conservó el correo")
  if (p) {
    await p
      .query(`insert into ${T_CORREO_TRADUCIDO} (huella, asunto, html) values ($1, $2, $3) on conflict (huella) do nothing`, [huella, nuevo.asunto, nuevo.html])
      .catch(() => {})
  }
  return nuevo
}

/**
 * Lo que usa sendEmail: si el destinatario va en inglés, devuelve el correo
 * traducido; si no (o si algo falla), el mismo correo en español.
 */
export async function correoEnSuIdioma(
  to: string,
  asunto: string,
  html: string,
  idioma?: IdiomaCorreo
): Promise<{ asunto: string; html: string; idioma: IdiomaCorreo }> {
  try {
    const i = idioma ?? (await idiomaCorreo(to))
    if (i !== "en" || !correosEnInglesEncendido()) return { asunto, html, idioma: "es" }
    const t = await traducirCorreo(asunto, html)
    return { ...t, idioma: "en" }
  } catch (e) {
    console.warn(`[correo-ingles] sale en español (${(e as Error).message})`)
    return { asunto, html, idioma: "es" }
  }
}
