// Agente «Reactivador de estimados»: quien pidió un precio al instante en
// /cotizar (POST /store/quote-leads) recibe su estimado por correo; antes no
// se guardaba ni se le daba seguimiento. Ahora:
//
//   - Cada estimado se guarda (hetna_estimado). Si la misma persona pide otro
//     el mismo día, se actualiza el de ese día.
//   - Día 2: correo «¿Te ayudamos a fabricarla?» con la solicitud ya llena para
//     que varios talleres le manden propuesta.
//   - Día 7: último correo, con WhatsApp.
//   - Se detiene si ya mandó una solicitud de fabricación con ese correo, si se
//     dio de baja o si ya recibió los dos correos.
//   - A ti te llega a Telegram, una vez al día, la lista de estimados grandes
//     (monto alto o volumen mensual alto) con liga de WhatsApp para atenderlos
//     tú, sólo si la persona dejó su teléfono.
//
// Variables:
//   ESTIMADOS_SEGUIMIENTO_APAGADO=1   apaga los correos (se siguen guardando)
//   ESTIMADOS_MONTO_ALTO=5000         MXN: desde aquí avisa a Telegram
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "./baja"
import { correosDeLaCasa } from "./cuentas-casa"
import { STORE_URL, T_SOLICITUD, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"
import { mandarPrivado } from "./social-telegram"

export const T_ESTIMADO = "hetna_estimado"
const DIA = 86_400_000
/** Días después del estimado en que sale cada correo de seguimiento. */
export const DIAS_SEGUIMIENTO = [2, 7]
const WHATSAPP = (process.env.HETNA_WHATSAPP || "522217076014").replace(/\D/g, "")

let listo = false
export async function asegurarTablaEstimado(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_ESTIMADO))) {
    await knex.schema.createTable(T_ESTIMADO, (t: any) => {
      t.increments("id").primary()
      t.text("email").notNullable().index()
      t.text("nombre").nullable()
      t.text("telefono").nullable()
      t.text("ciudad").nullable()
      t.text("servicio").notNullable()
      t.text("material").nullable()
      t.decimal("ancho", 10, 2).nullable()
      t.decimal("largo", 10, 2).nullable()
      t.integer("cantidad").nullable()
      t.integer("piezas_mes").nullable()
      t.decimal("estimado_min", 12, 2).nullable()
      t.decimal("estimado_max", 12, 2).nullable()
      t.integer("toques").notNullable().defaultTo(0)
      t.timestamp("ultimo_toque", { useTz: true }).nullable()
      t.text("cerrado").nullable() // solicitud | baja | completo
      t.boolean("avisado").notNullable().defaultTo(false)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

export type NuevoEstimado = {
  email: string
  nombre?: string | null
  telefono?: string | null
  ciudad?: string | null
  servicio: string
  material?: string | null
  ancho?: number
  largo?: number
  cantidad?: number
  piezas_mes?: number | null
  estimado_min?: number
  estimado_max?: number
}

/** Guarda el estimado (o actualiza el de hoy de ese correo). Nunca lanza. */
export async function guardarEstimado(knex: any, e: NuevoEstimado) {
  try {
    await asegurarTablaEstimado(knex)
    const email = String(e.email || "").trim().toLowerCase()
    if (!email.includes("@")) return
    const fila = {
      email,
      nombre: e.nombre ? String(e.nombre).slice(0, 120) : null,
      telefono: e.telefono ? String(e.telefono).slice(0, 40) : null,
      ciudad: e.ciudad ? String(e.ciudad).slice(0, 80) : null,
      servicio: String(e.servicio).slice(0, 80),
      material: e.material ? String(e.material).slice(0, 120) : null,
      ancho: Number(e.ancho) || null,
      largo: Number(e.largo) || null,
      cantidad: Number(e.cantidad) || null,
      piezas_mes: Number(e.piezas_mes) || null,
      estimado_min: Number(e.estimado_min) || null,
      estimado_max: Number(e.estimado_max) || null,
    }
    const hoy = await knex(T_ESTIMADO).where({ email }).where("created_at", ">", knex.raw("now() - interval '1 day'")).first("id")
    if (hoy) await knex(T_ESTIMADO).where({ id: hoy.id }).update(fila)
    else await knex(T_ESTIMADO).insert(fila)
  } catch {
    /* el estimado ya se mandó por correo; guardarlo es secundario */
  }
}

/** ¿Le toca un correo de seguimiento hoy? Devuelve el número de toque (0 o 1) o null. */
export function tocaSeguimiento(e: { toques: number; created_at: string | Date; cerrado?: string | null }, ahora = new Date()) {
  if (e.cerrado || e.toques >= DIAS_SEGUIMIENTO.length) return null
  const dias = (ahora.getTime() - new Date(e.created_at).getTime()) / DIA
  if (dias < DIAS_SEGUIMIENTO[e.toques]) return null
  if (dias > DIAS_SEGUIMIENTO[DIAS_SEGUIMIENTO.length - 1] + 7) return null // demasiado viejo: ya no
  return e.toques
}

const pesos = (n: unknown) => `$${Math.round(Number(n) || 0).toLocaleString("es-MX")}`

export function ligaSolicitud(e: any, toque: number) {
  const q = new URLSearchParams({
    desde: "estimado",
    pieza: `${e.servicio}${e.material ? ` en ${e.material}` : ""}`,
    medidas: [e.largo && e.ancho ? `${Number(e.largo)} x ${Number(e.ancho)} cm` : "", e.cantidad ? `Cantidad: ${e.cantidad}` : ""].filter(Boolean).join(". "),
    ...(e.material ? { material: String(e.material) } : {}),
    utm_source: "correo",
    utm_medium: "seguimiento_estimado",
    utm_campaign: `estimado_t${toque + 1}`,
  })
  return `${STORE_URL}/mx/cotizar?${q.toString()}`
}

export function correoSeguimiento(e: any, toque: number) {
  const p = (x: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.55">${x}</p>`
  const hola = e.nombre ? `Hola ${esc(String(e.nombre).split(" ")[0])},` : "Hola,"
  const pieza = `${esc(e.servicio)}${e.material ? ` en ${esc(e.material)}` : ""}${e.cantidad ? `, ${e.cantidad} pieza(s)` : ""}`
  const rango = e.estimado_min ? ` (te dimos un estimado de ${pesos(e.estimado_min)} a ${pesos(e.estimado_max)})` : ""
  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola HETNA, pedí un estimado de ${e.servicio}${e.material ? ` en ${e.material}` : ""} y quiero ayuda para fabricarlo.`)}`
  if (toque === 0) {
    return {
      asunto: "¿Te ayudamos a fabricar tu pieza?",
      html: marco(
        "¿Te ayudamos a fabricarla?",
        p(hola) +
          p(`Hace un par de días calculaste el precio de <b>${pieza}</b>${rango}.`) +
          p("Si quieres el precio exacto, publica tu solicitud: talleres verificados de tu zona te mandan su propuesta <b>sin costo</b> y tú eliges. Ya te la dejamos capturada, sólo revisa los datos y, si tienes, sube tu archivo o una foto.") +
          boton("Recibir propuestas de talleres", ligaSolicitud(e, 0)) +
          `<p style="margin:16px 0 0;color:#6B675C;font-size:13px">Pagas dentro de HETNA y el taller empieza cuando el pago está confirmado; cada taller te factura.</p>`
      ),
    }
  }
  return {
    asunto: "Último aviso sobre tu estimado de HETNA CNC",
    html: marco(
      "¿Todavía necesitas tu pieza?",
      p(hola) +
        p(`Te escribo por última vez sobre tu estimado de <b>${pieza}</b>. Si todavía lo necesitas, mándanos las medidas o una foto por WhatsApp y te ayudamos a encontrar el taller adecuado.`) +
        boton("Escribir por WhatsApp", wa) +
        `<p style="margin:16px 0 0"><a href="${esc(ligaSolicitud(e, 1))}" style="color:#C2560A;font-weight:700">O publica tu solicitud aquí →</a></p>`
    ),
  }
}

export const seguimientoApagado = () =>
  ["1", "true", "si"].includes(String(process.env.ESTIMADOS_SEGUIMIENTO_APAGADO || "").toLowerCase())

/** ¿Ya mandó una solicitud de fabricación con ese correo después del estimado? */
async function yaPidio(knex: any, email: string, desde: Date) {
  try {
    const r = await knex(T_SOLICITUD)
      .whereRaw("lower(contacto->>'email') = ?", [email])
      .where("created_at", ">=", desde)
      .first("id")
    return !!r
  } catch {
    return false
  }
}

function ligaWhatsappCliente(telefono: string, e: any) {
  let n = String(telefono || "").replace(/\D/g, "")
  if (n.length === 10) n = `52${n}`
  if (n.length < 11 || n.length > 13) return ""
  const texto = `Hola${e.nombre ? ` ${String(e.nombre).split(" ")[0]}` : ""}, soy Vladimir de HETNA CNC. Vi tu estimado de ${e.servicio}${e.material ? ` en ${e.material}` : ""}. ¿Te ayudo a conseguir el taller para fabricarlo?`
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function correrReactivador(container: MedusaContainer, o: { probar?: boolean; ahora?: Date } = {}) {
  const ahora = o.ahora || new Date()
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaEstimado(knex)
  const r = { correos: 0, cerrados: 0, fallidos: 0, avisados: 0 }
  const casa = new Set(correosDeLaCasa().map((c) => c.toLowerCase()))
  const abiertos = await knex(T_ESTIMADO)
    .whereNull("cerrado")
    .where("created_at", ">", new Date(ahora.getTime() - 21 * DIA))
    .orderBy("created_at", "asc")
    .limit(300)

  // Un correo por persona: si pidió varios estimados, se sigue el más reciente
  const porCorreo = new Map<string, any>()
  for (const e of abiertos) porCorreo.set(e.email, e)
  const viejos = abiertos.filter((e: any) => porCorreo.get(e.email)?.id !== e.id)
  if (viejos.length && !o.probar) await knex(T_ESTIMADO).whereIn("id", viejos.map((e: any) => e.id)).update({ cerrado: "reemplazado" })

  for (const e of porCorreo.values()) {
    if (casa.has(e.email)) continue
    if (await yaPidio(knex, e.email, new Date(e.created_at))) {
      if (!o.probar) await knex(T_ESTIMADO).where({ email: e.email }).whereNull("cerrado").update({ cerrado: "solicitud" })
      r.cerrados++
      continue
    }
    const toque = tocaSeguimiento(e, ahora)
    if (toque === null || seguimientoApagado()) continue
    if (o.probar) { r.correos++; continue }
    if (await estaDeBaja(knex, e.email)) {
      await knex(T_ESTIMADO).where({ id: e.id }).update({ cerrado: "baja" })
      r.cerrados++
      continue
    }
    const c = correoSeguimiento(e, toque)
    const envio = await sendEmail({ to: e.email, subject: c.asunto, html: c.html, bajaUrl: ligaBaja(e.email) })
    if (!envio.sent) {
      r.fallidos++
      if (envio.configuracion) break
      continue
    }
    const toques = toque + 1
    await knex(T_ESTIMADO).where({ id: e.id }).update({ toques, ultimo_toque: ahora, cerrado: toques >= DIAS_SEGUIMIENTO.length ? "completo" : null })
    r.correos++
  }

  // Aviso a Telegram de los estimados grandes que todavía no se avisaron
  const montoAlto = Number(process.env.ESTIMADOS_MONTO_ALTO) || 5000
  const grandes = (await knex(T_ESTIMADO)
    .where({ avisado: false })
    .where("created_at", ">", new Date(ahora.getTime() - 3 * DIA))
    .where((q: any) => q.where("estimado_max", ">=", montoAlto).orWhere("piezas_mes", ">=", 100))
    .orderBy("estimado_max", "desc")
    .limit(15)) as any[]
  if (grandes.length && !o.probar) {
    const lineas = grandes.map((e) => {
      const wa = e.telefono ? ligaWhatsappCliente(e.telefono, e) : ""
      return `• <b>${escHtml(String(e.nombre || e.email))}</b>${e.ciudad ? ` · ${escHtml(e.ciudad)}` : ""}\n  ${escHtml(e.servicio)}${e.material ? ` en ${escHtml(e.material)}` : ""}, ${e.cantidad || "?"} pza · ${pesos(e.estimado_min)} a ${pesos(e.estimado_max)}${e.piezas_mes ? ` · ${e.piezas_mes} piezas/mes` : ""}${wa ? `\n  <a href="${escHtml(wa)}">Escribirle por WhatsApp</a>` : ""}`
    })
    await mandarPrivado(knex, {
      texto: `💸 Estimados grandes en /cotizar (${grandes.length})\n\n${lineas.join("\n")}\n\nLes llegan solos los correos de seguimiento; el WhatsApp es por si quieres atenderlos tú (dejaron su teléfono).`,
    }).catch(() => undefined)
    await knex(T_ESTIMADO).whereIn("id", grandes.map((e) => e.id)).update({ avisado: true })
    r.avisados = grandes.length
  }
  return r
}
