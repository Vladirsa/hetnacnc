// @ts-nocheck
// WhatsApp de HETNA (Evolution API en whatsapp.hetnacnc.com) como canal con
// talleres y clientes — SÓLO con números verificados que aceptaron mensajes.
//
// Verificación (la persona escribe primero = WhatsApp no lo ve como spam):
//   1. En su cuenta o su panel pone su número y toca "Verificar mi WhatsApp":
//      se abre WhatsApp con "Hola HETNA, mi código de verificación es 123456".
//      Al llegar ese mensaje, el número queda verificado y se le contesta.
//   2. Respaldo: se le manda el código por WhatsApp (porque él lo pidió) y lo
//      escribe en la página. Máximo 1 cada 5 minutos y 3 al día por número.
//   3. A los talleres se les pide en seguida 3 fotos (fachada, máquinas y un
//      trabajo): llegan por WhatsApp y se guardan en su verificación PRIVADA.
//   4. Escribiendo BAJA dejan de recibir avisos; ALTA para volver.
//
// Envíos: uno a la vez, con pausa entre mensajes y tope diario, para cuidar el
// número. Llaves en el .env del backend: EVOLUTION_API_KEY y EVOLUTION_INSTANCE
// (las mismas de n8n); WHATSAPP_API_URL (por omisión https://whatsapp.hetnacnc.com).
import { randomInt } from "crypto"

import { STORE_URL } from "./licitacion"
import { asegurarSocial } from "./social-hub"
import { expedienteOCrear, guardarExpediente } from "./verificacion"
import { guardarArchivo, TIPOS } from "./verificacion-archivos"

export const T_WA = "hetna_whatsapp"
const URL_API = () => (process.env.WHATSAPP_API_URL || process.env.EVOLUTION_API_URL_PUBLICA || "https://whatsapp.hetnacnc.com").replace(/\/$/, "")
const LLAVE = () => process.env.EVOLUTION_API_KEY || ""
const INSTANCIA = () => process.env.EVOLUTION_INSTANCE || ""
export const whatsappListo = () => !!(LLAVE() && INSTANCIA())
/** Número de WhatsApp de HETNA (al que escriben para verificarse), sólo dígitos con lada. */
export const numeroHetna = () => String(process.env.WHATSAPP_HETNA || process.env.OWNER_WHATSAPP_NUMBER || process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "")
export const TOPE_DIA = () => Number(process.env.WHATSAPP_TOPE_DIA || 250)

export async function asegurarWhatsapp(knex: any) {
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_WA))) {
    await knex.schema.createTable(T_WA, (t: any) => {
      t.text("numero").primary() // 52 + 10 dígitos
      t.text("quien") // taller | cliente
      t.text("seller_id").index()
      t.text("customer_id").index()
      t.text("codigo")
      t.timestamp("codigo_hasta", { useTz: true })
      t.integer("codigos_hoy").defaultTo(0)
      t.text("codigos_dia")
      t.timestamp("ultimo_codigo", { useTz: true })
      t.timestamp("verificado_en", { useTz: true })
      t.boolean("avisos").defaultTo(true) // false = escribió BAJA
      t.boolean("esperando_fotos").defaultTo(false)
      t.integer("fotos").defaultTo(0)
      // Cuenta que pidió la verificación: sólo se liga al número cuando se confirma
      t.text("pend_quien")
      t.text("pend_seller_id")
      t.text("pend_customer_id")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
}

/** "33 1234 5678", "+52 1 33…", "5213312345678" → "523312345678". null si no es un celular de México válido. */
export function normalizarNumero(n: string) {
  let d = String(n || "").replace(/\D/g, "")
  if (d.length === 13 && d.startsWith("521")) d = "52" + d.slice(3)
  if (d.length === 10) d = "52" + d
  return /^52\d{10}$/.test(d) ? d : null
}

// ---------------------------------------------------------------------
// Enviar (con pausa y tope diario)
// ---------------------------------------------------------------------

let cola: Promise<any> = Promise.resolve()
let ultimo = 0
let enviadosHoy = { dia: "", n: 0 }
const PAUSA_MS = 4000

async function llamar(ruta: string, cuerpo: any) {
  const r = await fetch(`${URL_API()}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: LLAVE() },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(60_000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`WhatsApp: ${d?.response?.message || d?.message || r.status}`.slice(0, 200))
  return d
}

function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const turno = cola.then(async () => {
    const hoy = new Date().toISOString().slice(0, 10)
    if (enviadosHoy.dia !== hoy) enviadosHoy = { dia: hoy, n: 0 }
    if (enviadosHoy.n >= TOPE_DIA()) throw new Error("Tope diario de WhatsApp alcanzado (se cuida el número)")
    const espera = ultimo + PAUSA_MS - Date.now()
    if (espera > 0) await new Promise((ok) => setTimeout(ok, espera))
    try {
      return await fn()
    } finally {
      ultimo = Date.now()
      enviadosHoy.n++
    }
  })
  cola = turno.catch(() => null)
  return turno
}

export async function enviarTexto(numero: string, texto: string) {
  if (!whatsappListo()) throw new Error("WhatsApp no está configurado en el servidor")
  return enCola(() => llamar(`/message/sendText/${INSTANCIA()}`, { number: numero, text: String(texto).slice(0, 3500) }))
}

export async function enviarMedia(numero: string, url: string, tipo: "image" | "video", caption = "") {
  if (!whatsappListo()) throw new Error("WhatsApp no está configurado en el servidor")
  return enCola(() => llamar(`/message/sendMedia/${INSTANCIA()}`, { number: numero, mediatype: tipo, media: url, caption: String(caption).slice(0, 1000) }))
}

// ---------------------------------------------------------------------
// Verificación
// ---------------------------------------------------------------------

const codigoNuevo = () => String(randomInt(100000, 1000000))
export const textoVerificacion = (codigo: string) => `Hola HETNA, mi código de verificación es ${codigo}`

/** Empieza la verificación: guarda un código y regresa la liga de WhatsApp con el mensaje ya escrito. */
export async function iniciarVerificacion(knex: any, d: { numero: string; quien: "taller" | "cliente"; seller_id?: string | null; customer_id?: string | null }) {
  await asegurarWhatsapp(knex)
  const numero = normalizarNumero(d.numero)
  if (!numero) throw new Error("Escribe un celular de México a 10 dígitos.")
  const previo = await knex(T_WA).where({ numero }).first()
  // La cuenta que lo pide queda "pendiente": el número no se le liga hasta que
  // demuestre que es suyo (así nadie puede apuntar avisos al WhatsApp de otro)
  const codigo = codigoNuevo()
  const fila = {
    numero, pend_quien: d.quien, pend_seller_id: d.seller_id || null, pend_customer_id: d.customer_id || null,
    codigo, codigo_hasta: new Date(Date.now() + 30 * 60_000), updated_at: new Date(),
  }
  if (previo) await knex(T_WA).where({ numero }).update(fila)
  else await knex(T_WA).insert({ ...fila, created_at: new Date() })
  const hetna = numeroHetna()
  return {
    numero, codigo,
    liga: hetna ? `https://wa.me/${hetna}?text=${encodeURIComponent(textoVerificacion(codigo))}` : null,
  }
}

/** Respaldo: se le manda el código por WhatsApp (él lo pidió). 1 cada 5 minutos y 3 al día por número. */
export async function mandarCodigo(knex: any, numeroCrudo: string) {
  await asegurarWhatsapp(knex)
  const numero = normalizarNumero(numeroCrudo)
  const f = numero ? await knex(T_WA).where({ numero }).first() : null
  if (!f?.codigo) throw new Error("Primero toca 'Verificar mi WhatsApp'.")
  const hoy = new Date().toISOString().slice(0, 10)
  const n = f.codigos_dia === hoy ? Number(f.codigos_hoy || 0) : 0
  if (n >= 3) throw new Error("Ya se mandaron 3 códigos hoy a este número. Intenta mañana o escríbenos tú por WhatsApp.")
  if (f.ultimo_codigo && Date.now() - new Date(f.ultimo_codigo).getTime() < 5 * 60_000) throw new Error("Espera 5 minutos para pedir otro código.")
  await enviarTexto(numero, `Tu código de HETNA CNC es *${f.codigo}*. Escríbelo en la página para verificar tu WhatsApp.\n\nSi no lo pediste, ignora este mensaje.`)
  await knex(T_WA).where({ numero }).update({ codigos_hoy: n + 1, codigos_dia: hoy, ultimo_codigo: new Date() })
  return { ok: true }
}

async function marcarVerificado(knex: any, f0: any) {
  // Ahora sí: el número queda ligado a la cuenta que lo pidió
  const f = { ...f0, quien: f0.pend_quien || f0.quien, seller_id: f0.pend_seller_id || f0.seller_id, customer_id: f0.pend_customer_id || f0.customer_id }
  await knex(T_WA).where({ numero: f.numero }).update({
    quien: f.quien, seller_id: f.seller_id || null, customer_id: f.customer_id || null, pend_quien: null, pend_seller_id: null, pend_customer_id: null,
    verificado_en: new Date(), codigo: null, codigo_hasta: null, avisos: true, esperando_fotos: f.quien === "taller" && !!f.seller_id, updated_at: new Date(),
  })
  const bienvenida =
    f.quien === "taller"
      ? "✓ Tu WhatsApp quedó verificado. Por aquí te avisaremos de solicitudes de trabajo en tu zona.\n\n" +
        (f.seller_id ? "Para que tu taller salga como *verificado*, mándanos 3 fotos: 1) el frente del taller, 2) tus máquinas y 3) un trabajo terminado. Las guardamos en privado para revisarlas.\n\n" : "") +
        "Si algún día ya no quieres avisos, escribe BAJA."
      : "✓ Tu WhatsApp quedó verificado. Por aquí te avisaremos de tus cotizaciones y pedidos en HETNA CNC.\n\nSi ya no quieres avisos, escribe BAJA."
  await enviarTexto(f.numero, bienvenida).catch(() => null)
}

/** El código escrito en la página. */
export async function confirmarCodigo(knex: any, numeroCrudo: string, codigo: string) {
  await asegurarWhatsapp(knex)
  const numero = normalizarNumero(numeroCrudo)
  const f = numero ? await knex(T_WA).where({ numero }).first() : null
  if (!f?.codigo || String(codigo).trim() !== f.codigo) throw new Error("El código no coincide.")
  if (new Date(f.codigo_hasta).getTime() < Date.now()) throw new Error("El código venció. Pide uno nuevo.")
  await marcarVerificado(knex, f)
  return { ok: true }
}

/** Estado del WhatsApp de una cuenta (taller o cliente). */
export async function estadoDe(knex: any, d: { seller_id?: string | null; customer_id?: string | null }) {
  await asegurarWhatsapp(knex)
  const q = knex(T_WA)
  if (d.seller_id) q.where({ seller_id: d.seller_id })
  else if (d.customer_id) q.where({ customer_id: d.customer_id })
  else return { verificado: false }
  const f = await q.whereNotNull("verificado_en").orderBy("verificado_en", "desc").first()
  return f ? { verificado: true, numero: f.numero, avisos: f.avisos !== false, fotos: f.fotos || 0 } : { verificado: false, numero_hetna: numeroHetna() || null }
}

// ---------------------------------------------------------------------
// Mensajes que llegan (n8n los pasa aquí antes del respondedor de catálogo)
// ---------------------------------------------------------------------

/**
 * Regresa { manejado: true } si el mensaje era de verificación, BAJA/ALTA o
 * fotos del taller (y ya se contestó); si no, n8n sigue con su flujo normal.
 */
export async function mensajeEntrante(scope: any, m: { numero: string; texto?: string; tipo?: string; mensaje_id?: string; base64?: string | null }, logger?: any) {
  const { ContainerRegistrationKeys } = await import("@medusajs/framework/utils")
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarWhatsapp(knex)
  const numero = normalizarNumero(m.numero)
  if (!numero) return { manejado: false }
  const texto = String(m.texto || "").trim()
  const f = await knex(T_WA).where({ numero }).first()

  // 1) Código de verificación
  const cod = texto.match(/\b(\d{6})\b/)?.[1]
  if (cod && f?.codigo === cod && new Date(f.codigo_hasta).getTime() > Date.now() && /verificaci/i.test(texto)) {
    await marcarVerificado(knex, f)
    return { manejado: true, accion: "verificado" }
  }
  // 2) BAJA / ALTA
  if (/^\s*(baja|stop|ya no)\s*$/i.test(texto) && f) {
    await knex(T_WA).where({ numero }).update({ avisos: false, updated_at: new Date() })
    await enviarTexto(numero, "Listo, ya no te mandaremos avisos por WhatsApp. Si quieres volver, escribe ALTA.").catch(() => null)
    return { manejado: true, accion: "baja" }
  }
  if (/^\s*alta\s*$/i.test(texto) && f?.verificado_en) {
    await knex(T_WA).where({ numero }).update({ avisos: true, updated_at: new Date() })
    await enviarTexto(numero, "Listo, volverás a recibir avisos de HETNA CNC por WhatsApp.").catch(() => null)
    return { manejado: true, accion: "alta" }
  }
  // 3) Fotos del taller para su verificación
  if (m.tipo === "imagen" && f?.esperando_fotos && f.seller_id) {
    try {
      const b64 = m.base64 || (m.mensaje_id ? await bajarMedia(m.mensaje_id) : null)
      if (!b64) throw new Error("no se pudo bajar la foto")
      const exp = await expedienteOCrear(scope, f.seller_id)
      if (exp.estado === "verificado" || exp.estado === "en_revision") {
        await knex(T_WA).where({ numero }).update({ esperando_fotos: false })
        await enviarTexto(numero, exp.estado === "verificado" ? "Tu taller ya está verificado ✓" : "Tus documentos ya están en revisión; te avisamos en cuanto quede.").catch(() => null)
        return { manejado: true, accion: "fotos_no_necesarias" }
      }
      const fachadas = exp.archivos.filter((a: any) => a.tipo === "fachada").length
      const tipo = fachadas < 1 ? "fachada" : "taller"
      if (exp.archivos.filter((a: any) => a.tipo === tipo).length >= TIPOS[tipo].max) {
        await enviarTexto(numero, "Ya tenemos suficientes fotos, ¡gracias! Las revisamos y te avisamos.").catch(() => null)
        await knex(T_WA).where({ numero }).update({ esperando_fotos: false })
        return { manejado: true, accion: "fotos_completas" }
      }
      const nuevo = await guardarArchivo(f.seller_id, tipo, Buffer.from(String(b64).replace(/^data:[^,]+,/, ""), "base64"))
      await guardarExpediente(scope, exp.id, { archivos: [...exp.archivos, nuevo], estado: exp.estado === "rechazado" ? "borrador" : exp.estado })
      const total = Number(f.fotos || 0) + 1
      await knex(T_WA).where({ numero }).update({ fotos: total, esperando_fotos: total < 3, updated_at: new Date() })
      await enviarTexto(numero, total < 3 ? `📸 Foto ${total} recibida. Te faltan ${3 - total}.` : "📸 ¡Listo, recibimos tus 3 fotos! Las revisamos y te avisamos. Para completar la verificación, sube tu identificación en tu panel de HETNA → Verificación.").catch(() => null)
      logger?.info?.(`[whatsapp] foto ${total} de verificación del taller ${f.seller_id}`)
      return { manejado: true, accion: "foto" }
    } catch (e) {
      logger?.warn?.(`[whatsapp] foto: ${(e as Error).message}`)
      await enviarTexto(numero, "No pudimos guardar esa foto. ¿Nos la mandas otra vez como foto (no como documento)?").catch(() => null)
      return { manejado: true, accion: "foto_error" }
    }
  }
  return { manejado: false }
}

/** Foto que llegó por WhatsApp (Evolution la entrega en base64 a partir del id del mensaje). */
async function bajarMedia(mensajeId: string) {
  const d = await llamar(`/chat/getBase64FromMediaMessage/${INSTANCIA()}`, { message: { key: { id: mensajeId } }, convertToMp4: false })
  return d?.base64 || null
}

// ---------------------------------------------------------------------
// Avisos (los mismos de las notificaciones al celular)
// ---------------------------------------------------------------------

/** Aviso a talleres / clientes con WhatsApp verificado y avisos activos. Nunca truena el flujo que lo llama. */
export async function avisarWhatsapp(knex: any, a: { sellerIds?: string[]; customerIds?: string[] }, aviso: { titulo: string; cuerpo: string; url?: string }, logger?: any) {
  try {
    if (!whatsappListo()) return 0
    await asegurarWhatsapp(knex)
    const filas = await knex(T_WA)
      .whereNotNull("verificado_en")
      .where("avisos", true)
      .where((w: any) => {
        if (a.sellerIds?.length) w.orWhereIn("seller_id", a.sellerIds)
        if (a.customerIds?.length) w.orWhereIn("customer_id", a.customerIds)
      })
      .select("numero")
    if (!filas.length) return 0
    const liga = aviso.url ? (/^https?:\/\//.test(aviso.url) ? aviso.url : `${STORE_URL}${aviso.url.startsWith("/") ? "" : "/"}${aviso.url}`) : ""
    const texto = `*${aviso.titulo}*\n${aviso.cuerpo}${liga ? `\n\n${liga}` : ""}\n\n_Escribe BAJA para no recibir avisos._`
    let n = 0
    for (const f of filas) {
      try {
        await enviarTexto(f.numero, texto)
        n++
      } catch (e) {
        logger?.warn?.(`[whatsapp] aviso: ${(e as Error).message}`)
        if (/tope diario/i.test((e as Error).message)) break
      }
    }
    return n
  } catch (e) {
    logger?.warn?.(`[whatsapp] avisos: ${(e as Error).message}`)
    return 0
  }
}

export async function resumenWhatsapp(knex: any) {
  await asegurarWhatsapp(knex)
  const [r] = await knex(T_WA).select(
    knex.raw("count(*) filter (where verificado_en is not null) as verificados"),
    knex.raw("count(*) filter (where verificado_en is not null and quien = 'taller') as talleres"),
    knex.raw("count(*) filter (where verificado_en is not null and quien = 'cliente') as clientes"),
    knex.raw("count(*) filter (where avisos = false) as bajas"),
  )
  let conexion: any = null
  if (whatsappListo()) {
    try {
      const rr = await fetch(`${URL_API()}/instance/connectionState/${INSTANCIA()}`, { headers: { apikey: LLAVE() }, signal: AbortSignal.timeout(15_000) })
      const d = await rr.json().catch(() => ({}))
      conexion = d?.instance?.state || d?.state || (rr.ok ? "desconocido" : `error ${rr.status}`)
    } catch (e) {
      conexion = `sin respuesta (${(e as Error).message.slice(0, 60)})`
    }
  }
  return { configurado: whatsappListo(), numero_hetna: numeroHetna() || null, conexion, verificados: Number(r.verificados), talleres: Number(r.talleres), clientes: Number(r.clientes), bajas: Number(r.bajas), tope_dia: TOPE_DIA() }
}

// ---------------------------------------------------------------------
// Conexión (desde el panel: QR y recepción de mensajes)
// ---------------------------------------------------------------------

/** QR para volver a conectar el WhatsApp de HETNA (se escanea desde WhatsApp → Dispositivos vinculados). */
export async function qrConexion() {
  if (!whatsappListo()) throw new Error("Faltan EVOLUTION_API_KEY y EVOLUTION_INSTANCE en el .env del backend")
  let r = await fetch(`${URL_API()}/instance/connect/${INSTANCIA()}`, { headers: { apikey: LLAVE() }, signal: AbortSignal.timeout(30_000) })
  let d = await r.json().catch(() => ({}))
  // Si la instancia no existe (se borró o nunca se creó), se crea aquí y Evolution regresa su QR
  if (r.status === 404 || /does not exist|not found/i.test(JSON.stringify(d?.response || d?.message || ""))) {
    r = await fetch(`${URL_API()}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: LLAVE() },
      body: JSON.stringify({ instanceName: INSTANCIA(), integration: "WHATSAPP-BAILEYS", qrcode: true, ...(numeroHetna() ? { number: numeroHetna() } : {}) }),
      signal: AbortSignal.timeout(30_000),
    })
    d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`WhatsApp no pudo crear la instancia "${INSTANCIA()}": ${JSON.stringify(d?.response?.message || d?.message || r.status).slice(0, 160)}`)
    d = { base64: d?.qrcode?.base64 || d?.base64 || null, pairingCode: d?.qrcode?.pairingCode || null }
  } else if (!r.ok) throw new Error(`WhatsApp: ${d?.response?.message || d?.message || r.status}`)
  const base64 = d?.base64 || d?.qrcode?.base64 || null
  if (!base64 && d?.instance?.state === "open") return { conectado: true }
  return { conectado: false, qr: base64, codigo: d?.pairingCode || d?.code || null }
}

/**
 * Le dice a Evolution que mande los mensajes que llegan a la tienda
 * (hetnacnc.com/r/wa/<token>), que los pasa al backend. El token va en la liga
 * porque Evolution no manda encabezados propios; nunca se muestra.
 */
export async function configurarWebhook() {
  if (!whatsappListo()) throw new Error("Faltan EVOLUTION_API_KEY y EVOLUTION_INSTANCE en el .env del backend")
  const token = process.env.N8N_REDES_TOKEN || ""
  if (!token) throw new Error("Falta N8N_REDES_TOKEN en el .env del backend")
  const url = `${STORE_URL}/r/wa/${token}`
  // Evolution v2 (y respaldo con el formato de v1)
  const intentos = [
    { webhook: { enabled: true, url, byEvents: false, base64: true, events: ["MESSAGES_UPSERT"] } },
    { enabled: true, url, webhook_by_events: false, webhook_base64: true, events: ["MESSAGES_UPSERT"] },
  ]
  let ultimoError = ""
  for (const cuerpo of intentos) {
    const r = await fetch(`${URL_API()}/webhook/set/${INSTANCIA()}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: LLAVE() }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(20_000) })
    if (r.ok) return { ok: true }
    const d = await r.json().catch(() => ({}))
    ultimoError = String(d?.response?.message || d?.message || r.status)
  }
  throw new Error(`WhatsApp no aceptó el webhook: ${ultimoError}`.slice(0, 200))
}
