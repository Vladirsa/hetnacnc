// Buzón de opiniones: qué opinan talleres y clientes registrados de HETNA y qué
// mejorarían. Tres entradas:
//   - Mi cuenta > «¿Qué mejorarías?» (cliente con sesión)
//   - Tarjeta en el tablero del panel del taller (taller con sesión)
//   - Encuesta por correo a los 7 días del registro: botones 0 a 10 que abren
//     /opinion con la liga firmada (sin iniciar sesión). Se manda una sola vez
//     (metadata.encuesta_nps) y lleva liga de baja.
// Cada opinión llega a Telegram y queda en el panel de administración
// (Dashboard > Opiniones) con el NPS calculado.
//
// Variables:
//   OPINIONES_ENCUESTA_APAGADA=1   no manda la encuesta por correo
//   OPINIONES_ENCUESTA_TOPE=30     correos de encuesta por corrida
import { createHmac, timingSafeEqual } from "crypto"

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

import { ALTA_DESDE } from "./alta-taller"
import { estaDeBaja, ligaBaja } from "./baja"
import { correosDeLaCasa } from "./cuentas-casa"
import { STORE_URL, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"
import { secretoLigas } from "./secreto-ligas"
import { mandarPrivado } from "./social-telegram"

export const T_OPINION = "hetna_opinion"
export type Quien = "taller" | "cliente"
const DIA = 86_400_000
/** Días después del registro en que sale la encuesta (y hasta cuándo se intenta). */
export const DIAS_ENCUESTA = 7
const DIAS_ENCUESTA_MAX = 45
const VIGENCIA_LIGA_DIAS = 30
const MAX_POR_DIA = 5
const MAX_COMENTARIO = 2000

let listo = false
export async function asegurarTablaOpinion(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_OPINION))) {
    await knex.schema.createTable(T_OPINION, (t: any) => {
      t.increments("id").primary()
      t.text("quien").notNullable()
      t.text("actor_id").notNullable().index()
      t.text("nombre").nullable()
      t.text("email").nullable()
      t.integer("puntaje").nullable()
      t.text("comentario").nullable()
      t.text("origen").notNullable().defaultTo("buzon")
      t.text("pagina").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

// ---------- Liga firmada de la encuesta ----------

const firma = (quien: Quien, id: string, exp: number) => {
  const s = secretoLigas()
  return s ? createHmac("sha256", s).update(`opinion:${quien}:${id}:${exp}`).digest("base64url").slice(0, 32) : ""
}

/** Token de la encuesta: quien.id.exp.firma (todo seguro para URL). */
export function tokenEncuesta(quien: Quien, id: string, ahora = Date.now()): string {
  const exp = Math.floor(ahora / 1000) + VIGENCIA_LIGA_DIAS * 86400
  const f = firma(quien, id, exp)
  return f ? `${quien === "taller" ? "t" : "c"}.${id}.${exp}.${f}` : ""
}

export function leerTokenEncuesta(token: unknown, ahora = Date.now()): { quien: Quien; id: string } | null {
  const partes = String(token || "").split(".")
  if (partes.length !== 4) return null
  const [q, id, expTxt, f] = partes
  const quien: Quien | null = q === "t" ? "taller" : q === "c" ? "cliente" : null
  const exp = Number(expTxt)
  if (!quien || !id || !Number.isFinite(exp) || exp * 1000 < ahora) return null
  const esperada = firma(quien, id, exp)
  if (!esperada || esperada.length !== f.length) return null
  return timingSafeEqual(Buffer.from(esperada), Buffer.from(f)) ? { quien, id } : null
}

// ---------- Guardar ----------

export type NuevaOpinion = {
  quien: Quien
  actor_id: string
  nombre?: string | null
  email?: string | null
  puntaje?: unknown
  comentario?: unknown
  origen?: "buzon" | "encuesta"
  pagina?: unknown
}

export const limpiarPuntaje = (p: unknown): number | null => {
  if (p === null || p === undefined || p === "") return null
  const n = Number(p)
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null
}

export const tipoNps = (p: number | null) => (p === null ? null : p >= 9 ? "promotor" : p >= 7 ? "pasivo" : "detractor")

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function guardarOpinion(scope: MedusaContainer, o: NuevaOpinion): Promise<{ ok: boolean; message?: string }> {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaOpinion(knex)
  const puntaje = limpiarPuntaje(o.puntaje)
  const comentario = String(o.comentario ?? "").trim().slice(0, MAX_COMENTARIO)
  if (puntaje === null && comentario.length < 3) return { ok: false, message: "Escribe qué mejorarías o elige una calificación." }

  const hoy = await knex(T_OPINION)
    .where({ actor_id: o.actor_id })
    .where("created_at", ">", knex.raw("now() - interval '1 day'"))
    .count({ n: "*" })
    .first()
  if (Number(hoy?.n || 0) >= MAX_POR_DIA) return { ok: false, message: "Ya recibimos varias opiniones tuyas hoy. ¡Gracias! Intenta mañana." }

  const origen = o.origen === "encuesta" ? "encuesta" : "buzon"
  // La encuesta de correo se contesta una vez: si ya calificó por ahí, se actualiza.
  const previa =
    origen === "encuesta"
      ? await knex(T_OPINION).where({ actor_id: o.actor_id, origen: "encuesta" }).first("id", "comentario")
      : null
  const fila = {
    quien: o.quien,
    actor_id: o.actor_id,
    nombre: o.nombre ? String(o.nombre).slice(0, 200) : null,
    email: o.email ? String(o.email).slice(0, 200) : null,
    puntaje,
    comentario: comentario || null,
    origen,
    pagina: o.pagina ? String(o.pagina).slice(0, 300) : null,
  }
  if (previa) {
    await knex(T_OPINION)
      .where({ id: previa.id })
      .update({ ...fila, comentario: comentario || previa.comentario || null })
  } else {
    await knex(T_OPINION).insert(fila)
  }

  // Aviso al dueño: el comentario es lo importante; una calificación sola sin
  // texto que repite la misma de antes no se vuelve a avisar.
  if (!previa || comentario) {
    const tipo = tipoNps(puntaje)
    const icono = tipo === "detractor" ? "🔴" : tipo === "pasivo" ? "🟡" : tipo === "promotor" ? "🟢" : "💬"
    const texto =
      `${icono} Opinión de ${o.quien === "taller" ? "taller" : "cliente"}${origen === "encuesta" ? " (encuesta 7 días)" : ""}\n` +
      `<b>${escHtml(String(o.nombre || o.email || o.actor_id))}</b>${o.email && o.nombre ? ` · ${escHtml(String(o.email))}` : ""}\n` +
      (puntaje !== null ? `Recomendaría HETNA: <b>${puntaje}/10</b>\n` : "") +
      (comentario ? `\n«${escHtml(comentario.slice(0, 1500))}»` : "") +
      (fila.pagina ? `\n\n📍 ${escHtml(fila.pagina)}` : "")
    await mandarPrivado(knex, { texto }).catch(() => undefined)
  }
  return { ok: true }
}

// ---------- Panel de administración ----------

export function calcularNps(puntajes: number[]) {
  if (!puntajes.length) return { nps: null as number | null, promotores: 0, pasivos: 0, detractores: 0, total: 0 }
  const promotores = puntajes.filter((p) => p >= 9).length
  const detractores = puntajes.filter((p) => p <= 6).length
  return {
    nps: Math.round(((promotores - detractores) / puntajes.length) * 100),
    promotores,
    pasivos: puntajes.length - promotores - detractores,
    detractores,
    total: puntajes.length,
  }
}

export async function listarOpiniones(scope: MedusaContainer, o: { quien?: string; limite?: number } = {}) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaOpinion(knex)
  const q = knex(T_OPINION).orderBy("created_at", "desc").limit(Math.min(500, Math.max(1, o.limite || 200)))
  if (o.quien === "taller" || o.quien === "cliente") q.where({ quien: o.quien })
  const filas = await q
  // NPS de los últimos 90 días, la última calificación de cada quien
  const recientes = await knex(T_OPINION)
    .whereNotNull("puntaje")
    .where("created_at", ">", knex.raw("now() - interval '90 days'"))
    .orderBy("created_at", "desc")
    .select("actor_id", "quien", "puntaje")
  const vistos = new Set<string>()
  const porQuien: Record<string, number[]> = { taller: [], cliente: [], todos: [] }
  for (const r of recientes) {
    if (vistos.has(r.actor_id)) continue
    vistos.add(r.actor_id)
    porQuien.todos.push(r.puntaje)
    porQuien[r.quien]?.push(r.puntaje)
  }
  return {
    opiniones: filas,
    nps: { todos: calcularNps(porQuien.todos), taller: calcularNps(porQuien.taller), cliente: calcularNps(porQuien.cliente) },
  }
}

// ---------- Encuesta por correo a los 7 días ----------

export const encuestaApagada = () =>
  ["1", "true", "si"].includes(String(process.env.OPINIONES_ENCUESTA_APAGADA || "").toLowerCase())

/** ¿Le toca la encuesta? Registrado hace 7 a 45 días y nunca se le mandó. */
export function tocaEncuesta(c: { email?: string | null; created_at?: string | Date | null; metadata?: any }, ahora = new Date()) {
  if (!c.email || c.metadata?.encuesta_nps) return false
  if (!c.created_at) return false
  const dias = (ahora.getTime() - new Date(c.created_at).getTime()) / DIA
  return dias >= DIAS_ENCUESTA && dias <= DIAS_ENCUESTA_MAX
}

export function ligaEncuesta(quien: Quien, id: string, puntaje?: number) {
  const t = tokenEncuesta(quien, id)
  if (!t) return ""
  return `${STORE_URL}/mx/opinion?t=${encodeURIComponent(t)}${puntaje !== undefined ? `&p=${puntaje}` : ""}`
}

export function correoEncuesta(quien: Quien, id: string, nombre: string) {
  const color = (n: number) => (n <= 6 ? "#F3E1DA" : n <= 8 ? "#F6EDD3" : "#DDEEDD")
  const celdas = Array.from({ length: 11 }, (_, n) => {
    const url = ligaEncuesta(quien, id, n)
    return `<td style="padding:2px"><a href="${esc(url)}" style="display:block;width:34px;line-height:34px;text-align:center;background:${color(n)};color:#142033;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px">${n}</a></td>`
  }).join("")
  const p = (x: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.55">${x}</p>`
  const queEs = quien === "taller" ? "tu panel de taller, las solicitudes, la publicación de productos" : "buscar talleres, cotizar, comprar"
  return marco(
    "¿Qué tal te ha ido con HETNA CNC?",
    p(`Hola${nombre ? ` ${esc(nombre)}` : ""}, hace una semana te registraste en HETNA CNC. Queremos mejorar la plataforma con lo que nos digas: ${queEs}.`) +
      p("<b>Del 0 al 10, ¿qué tanto recomendarías HETNA CNC a un colega o amigo?</b>") +
      `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 6px;border-collapse:collapse"><tr>${celdas}</tr></table>` +
      `<table role="presentation" width="100%" style="max-width:420px;margin:0 0 16px;font-size:12px;color:#6B675C"><tr><td>Nada probable</td><td style="text-align:right">Muy probable</td></tr></table>` +
      p("Al elegir un número te preguntamos, si quieres, qué te falta o qué mejorarías. Lo leemos todo y nos toma 30 segundos.") +
      `<p style="margin:16px 0 0;color:#6B675C;font-size:13px">Gracias, Vladimir · HETNA CNC</p>`
  )
}

export async function correrEncuestaNps(container: MedusaContainer, o: { probar?: boolean; ahora?: Date } = {}) {
  const ahora = o.ahora || new Date()
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const tope = Math.max(1, Number(process.env.OPINIONES_ENCUESTA_TOPE) || 30)
  const casa = new Set(correosDeLaCasa().map((c) => c.toLowerCase()))
  const desde = new Date(ahora.getTime() - DIAS_ENCUESTA_MAX * DIA)
  const r = { talleres: 0, clientes: 0, fallidos: 0 }
  let enviados = 0

  const { data: talleres } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "email", "status", "created_at", "metadata"],
    filters: { created_at: { $gte: desde } } as any,
  })
  const { data: clientes } = await query.graph({
    entity: "customer",
    fields: ["id", "first_name", "email", "has_account", "created_at", "metadata"],
    filters: { created_at: { $gte: desde }, has_account: true } as any,
  })

  const lista = [
    ...((talleres || []) as any[])
      .filter((t) => t.status === "open" && (!t.created_at || new Date(t.created_at) >= ALTA_DESDE()))
      .map((t) => ({ quien: "taller" as Quien, id: t.id, nombre: t.name || "", email: t.email, created_at: t.created_at, metadata: t.metadata })),
    ...((clientes || []) as any[]).map((c) => ({ quien: "cliente" as Quien, id: c.id, nombre: c.first_name || "", email: c.email, created_at: c.created_at, metadata: c.metadata })),
  ].filter((x) => tocaEncuesta(x, ahora) && !casa.has(String(x.email).toLowerCase()))

  const sellers = container.resolve(MercurModules.SELLER) as any
  const customers = container.resolve(Modules.CUSTOMER) as any
  const marcar = (x: (typeof lista)[number], valor: string) =>
    x.quien === "taller"
      ? sellers.updateSellers({ id: x.id, metadata: { ...(x.metadata || {}), encuesta_nps: valor } })
      : customers.updateCustomers(x.id, { metadata: { ...(x.metadata || {}), encuesta_nps: valor } })

  for (const x of lista) {
    if (enviados >= tope) break
    if (o.probar) {
      x.quien === "taller" ? r.talleres++ : r.clientes++
      continue
    }
    if (await estaDeBaja(knex, String(x.email))) {
      await marcar(x, "baja")
      continue
    }
    if (!tokenEncuesta(x.quien, x.id)) break // sin secreto no hay ligas válidas
    const envio = await sendEmail({
      to: String(x.email),
      subject: "¿Del 0 al 10, qué tal HETNA CNC? (30 segundos)",
      html: correoEncuesta(x.quien, x.id, String(x.nombre).split(" ")[0]),
      bajaUrl: ligaBaja(String(x.email)),
    })
    if (!envio.sent) {
      r.fallidos++
      if (envio.configuracion) break
      continue
    }
    await marcar(x, ahora.toISOString())
    x.quien === "taller" ? r.talleres++ : r.clientes++
    enviados++
  }
  return r
}

/** Nombre y correo de quien contesta la encuesta (para el aviso y el panel). */
export async function datosDe(scope: MedusaContainer, quien: Quien, id: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: quien === "taller" ? "seller" : "customer",
    fields: quien === "taller" ? ["id", "name", "email"] : ["id", "first_name", "last_name", "email"],
    filters: { id } as any,
  })
  const d: any = data?.[0]
  if (!d) return null
  return { nombre: quien === "taller" ? d.name : [d.first_name, d.last_name].filter(Boolean).join(" "), email: d.email as string | null }
}
