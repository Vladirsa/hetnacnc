// @ts-nocheck
// Conversación por WhatsApp con el cliente que pidió cotización (decidido por
// Vlado el 27 nov 2026). Después del primer mensaje (lib/solicitud-whatsapp),
// HETNA platica con él en tono formal y técnico (de usted) para completar lo
// que le falta a su solicitud: medidas, material y espesor, cantidad, archivo,
// fecha, lugar de entrega y acabado. Una o dos preguntas por mensaje, sin ligas.
//
// - Lo que contesta se guarda en la solicitud (trabajo) y queda en su historial:
//   los talleres cotizan con datos completos.
// - La IA sólo entiende y redacta las preguntas; el cierre (agradecimiento,
//   invitación a dejar su opinión y el cupón) lo arma este código, para que
//   nunca invente descuentos.
// - Opinión: se invita a dejar una opinión HONESTA. El cupón es un
//   agradecimiento por completar su solicitud y no depende de la reseña
//   (Google y Facebook prohíben dar algo a cambio de reseñas).
// - Queja, pago, precio a negociar o algo que no sepa contestar: pasa a una
//   persona (aviso por Telegram) y deja de contestar en ese chat.
//
// .env: SOLICITUD_RESENA_GOOGLE (liga para opinar en Google), SOLICITUD_RESENA_FACEBOOK,
// SOLICITUD_CUPON (código), SOLICITUD_CUPON_TEXTO («10 % en fresas y brocas
// seleccionadas») y SOLICITUD_SEGUIR («Facebook: liga|Telegram: liga»). Sin
// cupón, el cierre no menciona descuento.
import Anthropic from "@anthropic-ai/sdk"

import { T_SOLICITUD, folioTexto } from "./licitacion"
import { anotar } from "./seguimiento"
import { iaSocial } from "./social-hub"
import { mandarPrivado } from "./social-telegram"
import { enviarTexto, normalizarNumero, whatsappListo } from "./whatsapp"
import { IA_MODELO_WHATSAPP, modeloIA } from "./ia-modelo"
import { T_CHAT, T_MSG, asegurar as asegurarChat, guardarMsg } from "./whatsapp-bot"

const ESPERA_MS = 8000 // junta los mensajes seguidos
const MAX_RONDAS = 8 // preguntas máximas antes de cerrar con lo que haya
const ESTADOS_ABIERTA = ["abierta", "revision", "por_aprobar"]

// ---------------------------------------------------------------------
// Qué le falta a una solicitud
// ---------------------------------------------------------------------

export type Dato = "medidas" | "material" | "cantidad" | "archivo" | "fecha" | "lugar" | "acabado"
const vacio = (v: unknown) => !String(v ?? "").trim() || /^(no s[eé]|n\/a|-|ninguno)$/i.test(String(v).trim())

export const PREGUNTA: Record<Dato, string> = {
  medidas: "medidas de la pieza (largo × ancho o diámetro, en mm o cm)",
  material: "material y espesor (por ejemplo MDF 6 mm, acrílico 3 mm, acero cal. 14)",
  cantidad: "cantidad de piezas",
  archivo: "si cuenta con archivo (DXF, DWG, SVG, PDF o STL), un boceto o una foto de referencia; puede enviarlo por este chat",
  fecha: "fecha en que necesita las piezas",
  lugar: "ciudad y código postal de entrega",
  acabado: "acabado que requiere (tal como sale de la máquina, lijado, pintado, etc.)",
}

/** Datos que faltan, en el orden en que conviene pedirlos. */
export function faltantes(t: any = {}, ya: { archivo_pedido?: boolean } = {}): Dato[] {
  const f: Dato[] = []
  if (vacio(t.medidas) && vacio(t.medidas_archivo)) f.push("medidas")
  if (vacio(t.material) && t.servicio !== "Diseño CAD/CAM") f.push("material")
  if (vacio(t.cantidad)) f.push("cantidad")
  const tieneArchivo = (t.archivos || []).length > 0 || /^https?:\/\//i.test(String(t.archivo || "")) || /profesional|boceto|foto|no tengo|dise/i.test(String(t.tiene_archivo || ""))
  if (!tieneArchivo && !ya.archivo_pedido) f.push("archivo")
  if (vacio(t.fecha)) f.push("fecha")
  if (vacio(t.ciudad) && vacio(t.cp)) f.push("lugar")
  if (vacio(t.acabado)) f.push("acabado")
  return f
}

// ---------------------------------------------------------------------
// Columnas de la conversación en la solicitud
// ---------------------------------------------------------------------

let columnasListas = false
async function asegurarColumnas(knex: any) {
  if (columnasListas) return
  for (const [col, tipo] of [["wa_confirmada_en", "ts"], ["wa_cierre_en", "ts"], ["wa_rondas", "int"]] as const) {
    if (!(await knex.schema.hasColumn(T_SOLICITUD, col)))
      await knex.schema.alterTable(T_SOLICITUD, (t: any) => (tipo === "ts" ? t.timestamp(col, { useTz: true }).nullable() : t.integer(col).defaultTo(0)))
  }
  columnasListas = true
}

/** La solicitud abierta más reciente de este número que está en plática (últimos 30 días). */
export async function solicitudEnPlatica(knex: any, numero: string) {
  await asegurarColumnas(knex)
  const filas = (await knex(T_SOLICITUD)
    .whereNotNull("wa_confirmada_en")
    .whereNull("wa_cierre_en")
    .whereIn("estado", ESTADOS_ABIERTA)
    .where("created_at", ">=", knex.raw("now() - interval '30 days'"))
    .orderBy("created_at", "desc")
    .limit(100)
    .select("*")) as any[]
  return filas.find((s) => normalizarNumero(s.contacto?.whatsapp || s.contacto?.telefono || "") === numero) || null
}

// ---------------------------------------------------------------------
// Mensajes armados por el código
// ---------------------------------------------------------------------

const primerNombre = (n?: string | null) => {
  const x = String(n || "").trim().split(/\s+/)[0] || ""
  return x ? x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() : ""
}

/** Primer mensaje: formal, sin ligas, y ya con la primera pregunta. */
export function textoInicio(s: { folio: number | string; trabajo?: any; contacto?: any; tipo?: string }) {
  const t = s.trabajo || {}
  const nombre = primerNombre(s.contacto?.nombre)
  const que = [t.servicio && t.servicio !== "Otro" ? t.servicio.toLowerCase() : "", t.material ? `en ${t.material}` : ""].filter(Boolean).join(" ")
  const quien = s.tipo === "suministro" ? "proveedor" : "taller"
  const f = faltantes(t)
  const preguntas = f.slice(0, 2).map((d) => PREGUNTA[d])
  return [
    `Buen día${nombre ? `, ${nombre}` : ""}. Le escribe el equipo de HETNA CNC.`,
    "",
    `Recibimos su solicitud *${folioTexto(s.folio)}*${que ? ` de ${que}` : ""}. Revisaremos y actualizaremos sus datos para publicarla y encontrarle el ${quien} indicado con los mejores precios.`,
    "",
    preguntas.length
      ? `Para que las cotizaciones sean precisas, ¿nos podría indicar ${preguntas.join(" y ")}?`
      : "En cuanto recibamos propuestas se las haremos saber por este medio.",
    "",
    "_Si prefiere no recibir mensajes por WhatsApp, responda BAJA._",
  ].join("\n")
}

/** Cierre: agradecimiento, invitación a opinar (honesto) y cupón si está configurado. */
export function textoCierre(s: { folio: number | string; contacto?: any }) {
  const nombre = primerNombre(s.contacto?.nombre)
  const google = (process.env.SOLICITUD_RESENA_GOOGLE || "").trim()
  const facebook = (process.env.SOLICITUD_RESENA_FACEBOOK || "").trim()
  const cupon = (process.env.SOLICITUD_CUPON || "").trim()
  const cuponTexto = (process.env.SOLICITUD_CUPON_TEXTO || "productos seleccionados de la tienda").trim()
  const opinar = [google && `Google: ${google}`, facebook && `Facebook: ${facebook}`].filter(Boolean)
  const seguir = String(process.env.SOLICITUD_SEGUIR || "").split("|").map((x) => x.trim()).filter(Boolean)
  return [
    `Muchas gracias${nombre ? `, ${nombre}` : ""}. Con esta información actualizaremos los datos de su solicitud *${folioTexto(s.folio)}* para publicarla y encontrarle el taller indicado con los mejores precios. En cuanto recibamos propuestas se las haremos saber por este medio.`,
    ...(cupon ? ["", `Como agradecimiento, tiene el código *${cupon}* con descuento en ${cuponTexto} de hetnacnc.com.`] : []),
    ...(opinar.length
      ? ["", "Si la atención le fue útil, nos ayudaría mucho que compartiera su opinión, con toda sinceridad:", ...opinar]
      : []),
    ...(seguir.length ? ["", "Síganos para enterarse de ofertas, planos gratis y novedades:", ...seguir] : []),
  ].join("\n")
}

// ---------------------------------------------------------------------
// La IA: entiende lo que contestó y redacta la siguiente pregunta
// ---------------------------------------------------------------------

const ESQUEMA = {
  type: "object", additionalProperties: false,
  required: ["tipo", "datos", "respuesta", "resumen_para_equipo"],
  properties: {
    tipo: { type: "string", enum: ["seguir", "pasar_a_persona", "ignorar"] },
    // Lo que el cliente dio en ESTA conversación (vacío si no lo dio)
    datos: {
      type: "object", additionalProperties: false,
      required: ["medidas", "material", "cantidad", "tiene_archivo", "fecha", "ciudad", "cp", "acabado", "notas"],
      properties: {
        medidas: { type: "string" }, material: { type: "string" }, cantidad: { type: "string" },
        tiene_archivo: { type: "string" }, fecha: { type: "string" }, ciudad: { type: "string" },
        cp: { type: "string" }, acabado: { type: "string" }, notas: { type: "string" },
      },
    },
    respuesta: { type: "string" },
    resumen_para_equipo: { type: "string" },
  },
}

const SISTEMA = (s: any, falta: Dato[]) =>
  "Eres del equipo de HETNA CNC, marketplace mexicano de fabricación CNC, y platicas por WhatsApp con un cliente que pidió cotización. " +
  "Tu tarea es completar los datos que le faltan a su solicitud para que los talleres coticen con precisión.\n\n" +
  "Tono: formal y técnico, de usted, español de México. Mensajes breves (2 a 4 oraciones), sin emojis, sin listas largas y SIN ligas.\n" +
  "- Agradece o confirma brevemente lo que acaba de decir y pide el siguiente dato que falta (uno, o dos si van juntos, como material y espesor).\n" +
  "- Si un dato es ambiguo, pide la precisión técnica (unidades, espesor, tolerancia), sin interrogar de más.\n" +
  "- Si dice que no sabe o no tiene un dato, acéptalo, anota «no sabe» en ese campo y sigue con el siguiente.\n" +
  "- Si envía archivo o foto, agradécelo (en tiene_archivo pon «Envió archivo o foto por WhatsApp»).\n" +
  "- Nunca des precios, plazos ni descuentos: los talleres cotizan y HETNA le avisará. No prometas nada que no esté aquí.\n" +
  "- Cuando ya no falte nada, deja respuesta vacía: el sistema manda el agradecimiento.\n" +
  "- Nunca digas que la solicitud ya está completa o lista para publicar: HETNA revisa y actualiza los datos antes de publicarla.\n" +
  "- tipo = pasar_a_persona si hay queja, quiere negociar, pregunta por pagos o facturas, pide hablar con alguien o no puedes contestar; en respuesta dile que una persona del equipo le atenderá en breve.\n" +
  "- Si el cliente sólo agradece o dice «ok», no lo ignores: contesta breve y con algo útil (confirma lo que tenemos y pide el siguiente dato que falta, o dile qué sigue). Nunca contestes sólo «gracias».\n" +
  "- Sé versátil: varía la redacción, no empieces dos mensajes igual ni repitas frases de la conversación; adapta el tono a cómo escribe el cliente.\n" +
  "- tipo = ignorar sólo para stickers o mensajes vacíos (respuesta vacía).\n" +
  "- datos: SÓLO lo que el cliente dijo en esta conversación, en sus términos (vacío lo que no dio). notas: otros detalles técnicos útiles para el taller.\n" +
  "- resumen_para_equipo: una línea con lo que se completó o por qué pasa a una persona.\n\n" +
  `Solicitud ${folioTexto(s.folio)}. Lo que ya tiene: ${JSON.stringify({
    servicio: s.trabajo?.servicio, descripcion: String(s.trabajo?.descripcion || "").slice(0, 600), material: s.trabajo?.material, medidas: s.trabajo?.medidas,
    cantidad: s.trabajo?.cantidad, fecha: s.trabajo?.fecha, ciudad: s.trabajo?.ciudad, cp: s.trabajo?.cp, acabado: s.trabajo?.acabado, archivo: s.trabajo?.tiene_archivo,
  })}\n` +
  `Le falta (en este orden): ${falta.length ? falta.map((d) => PREGUNTA[d]).join("; ") : "nada"}.`

let ia: Anthropic | null = null
async function entender(s: any, falta: Dato[], historia: { rol: string; texto: string }[]) {
  ia ??= new Anthropic()
  const turnos: any[] = []
  for (const m of historia) {
    const role = m.rol === "cliente" ? "user" : "assistant"
    if (turnos.length && turnos[turnos.length - 1].role === role) turnos[turnos.length - 1].content += `\n${m.texto}`
    else turnos.push({ role, content: m.texto })
  }
  while (turnos.length && turnos[0].role !== "user") turnos.shift()
  if (!turnos.length || turnos[turnos.length - 1].role !== "user") return null
  const r = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO_WHATSAPP()),
    max_tokens: 800,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    system: SISTEMA(s, falta),
    messages: turnos,
  } as any)
  if (r.stop_reason === "refusal") return { tipo: "pasar_a_persona", datos: {}, respuesta: "", resumen_para_equipo: "La IA no pudo contestar." }
  return JSON.parse(r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

/** Junta lo nuevo con lo que ya tenía: no borra nada; las notas se agregan a la descripción. */
export function combinar(t: any, d: any = {}) {
  const nuevo = { ...t }
  const cambios: string[] = []
  for (const k of ["medidas", "material", "cantidad", "tiene_archivo", "fecha", "ciudad", "cp", "acabado"]) {
    const v = String(d[k] || "").trim().slice(0, 300)
    if (v && v !== String(t[k] || "").trim()) {
      nuevo[k] = v
      cambios.push(`${k}: ${v}`)
    }
  }
  const notas = String(d.notas || "").trim().slice(0, 600)
  if (notas && !String(t.descripcion || "").includes(notas)) {
    nuevo.descripcion = `${String(t.descripcion || "").trim()}\n\nPrecisado por WhatsApp: ${notas}`.trim().slice(0, 3500)
    cambios.push(`notas: ${notas}`)
  }
  return { trabajo: nuevo, cambios }
}

// ---------------------------------------------------------------------
// Entrada desde el webhook de WhatsApp
// ---------------------------------------------------------------------

const turnos = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * ¿Este mensaje es de un cliente con una solicitud en plática? Si sí, lo guarda,
 * regresa true y contesta unos segundos después.
 */
export async function atenderSolicitud(knex: any, m: { numero: string; texto?: string; tipo?: string }, logger?: any) {
  const numero = normalizarNumero(m.numero)
  if (!numero || !whatsappListo() || !iaSocial() || process.env.SOLICITUD_WHATSAPP === "0") return false
  const s = await solicitudEnPlatica(knex, numero)
  if (!s) return false
  await asegurarChat(knex)
  const chat = await knex(T_CHAT).where({ numero }).first()
  if (chat?.pausa_hasta && new Date(chat.pausa_hasta).getTime() > Date.now()) return false // lo atiende una persona
  const texto = String(m.texto || "").trim() || (m.tipo === "imagen" ? "(Envió una imagen)" : m.tipo && m.tipo !== "texto" ? `(Envió un archivo: ${m.tipo})` : "")
  if (!texto) return true
  if (!chat) await knex(T_CHAT).insert({ numero, created_at: new Date(), updated_at: new Date() }).onConflict("numero").ignore()
  await guardarMsg(knex, numero, "cliente", texto)
  const previo = turnos.get(numero)
  if (previo) clearTimeout(previo)
  turnos.set(numero, setTimeout(() => {
    turnos.delete(numero)
    void contestar(knex, numero, s.id, logger)
  }, ESPERA_MS))
  return true
}

async function contestar(knex: any, numero: string, solicitudId: string, logger?: any) {
  try {
    const s = await knex(T_SOLICITUD).where({ id: solicitudId }).first()
    if (!s || s.wa_cierre_en) return
    const desde = new Date(s.wa_confirmada_en || s.created_at)
    const historia = (await knex(T_MSG).where({ numero }).where("created_at", ">=", desde).orderBy("id", "desc").limit(20)).reverse()
    if (!historia.length || historia[historia.length - 1].rol !== "cliente") return
    const yaPidioArchivo = historia.some((h: any) => h.rol === "agente" && /archivo|boceto|foto/i.test(h.texto))
    const falta = faltantes(s.trabajo, { archivo_pedido: yaPidioArchivo })
    const r = await entender(s, falta, historia)
    if (!r || r.tipo === "ignorar") return

    // Guardar lo que dio
    const { trabajo, cambios } = combinar(s.trabajo || {}, r.datos)
    const rondas = Number(s.wa_rondas || 0) + 1
    await knex(T_SOLICITUD).where({ id: s.id }).update({ trabajo: JSON.stringify(trabajo), wa_rondas: rondas, updated_at: knex.fn.now() })
    if (cambios.length) await anotar(knex, s.id, "cliente", `Completó por WhatsApp: ${cambios.join(" · ")}`, false).catch(() => null)

    if (r.tipo === "pasar_a_persona") {
      const resp = String(r.respuesta || "").trim() || "Con gusto. Una persona del equipo de HETNA le atenderá en breve por este medio."
      await enviarTexto(numero, resp.slice(0, 1200))
      await guardarMsg(knex, numero, "agente", resp)
      // Se calla en este chat: lo toma una persona
      await knex(T_CHAT).where({ numero }).update({ pausa_hasta: new Date(Date.now() + 12 * 3_600_000) })
      await mandarPrivado(knex, {
        texto: `🙋 WhatsApp de cliente con solicitud ${folioTexto(s.folio)}: necesita a una persona\n+${numero}${s.contacto?.nombre ? ` · ${s.contacto.nombre}` : ""}\n${r.resumen_para_equipo || ""}\n\nÚltimo mensaje: «${historia[historia.length - 1].texto.slice(0, 300)}»\nEscríbele: https://wa.me/${numero}`,
      }).catch(() => null)
      return
    }

    const quedan = faltantes(trabajo, { archivo_pedido: yaPidioArchivo })
    let resp = String(r.respuesta || "").trim()
    if (!quedan.length || rondas >= MAX_RONDAS) {
      // Completa (o ya se preguntó bastante): agradecimiento y cierre
      const cierre = textoCierre(s)
      resp = cierre
      await knex(T_SOLICITUD).where({ id: s.id }).update({ wa_cierre_en: knex.fn.now() })
      await anotar(knex, s.id, "sistema", "Datos completados con el cliente por WhatsApp.", false).catch(() => null)
      if (cambios.length)
        await mandarPrivado(knex, { texto: `✅ ${folioTexto(s.folio)}: el cliente completó su solicitud por WhatsApp\n${cambios.join("\n")}` }).catch(() => null)
    }
    if (!resp) return
    await enviarTexto(numero, resp.slice(0, 1500))
    await guardarMsg(knex, numero, "agente", resp)
  } catch (e) {
    logger?.warn?.(`[solicitud-conversacion] ${numero}: ${(e as Error).message}`)
  }
}
