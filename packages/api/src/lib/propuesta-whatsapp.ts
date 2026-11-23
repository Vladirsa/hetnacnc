// Propuesta por WhatsApp: el taller contesta el aviso con "1500, 3 días" (o
// "HET-00123 1500 3 días") y, tras confirmar con SÍ, queda su propuesta sin
// abrir el panel. Para que el cliente compare igual que con las del panel:
//   - garantía, condiciones de pago, vigencia, envío, anticipo y moneda salen
//     de la ÚLTIMA propuesta que ese taller mandó (si nunca ha mandado una, se le
//     manda la liga al panel para la primera);
//   - material: el que pidió el cliente; fecha de entrega: hoy + días hábiles.
// Sólo números de taller verificados. Sólo propuestas nuevas (corregir, en el
// panel). Mismas reglas que el panel: abierta, privada/NDA, verificados, cupo.
import { servicioTalleres } from "./alta-taller"
import { T_AVISO } from "./difusion"
import { T_PROPUESTA, T_SOLICITUD, VENDOR_URL, folioTexto, nuevoId, recibePropuestas } from "./licitacion"
import { cupoLicitacion, mensajeSinCupo } from "./licitacion-plan"
import { faltaNda, relacionTaller, tallerPuedeVer } from "./licitacion-privacidad"
import { avisarPropuestaNueva } from "./propuesta-aviso"
import { cambiarEtapa, etapaDe } from "./seguimiento"
import { T_WA, enviarTexto, normalizarNumero } from "./whatsapp"

export const T_WA_PROPUESTA = "hetna_wa_propuesta"
const MIN_CONFIRMAR = 30
const HORAS_AVISO = 72

const numero = (s: string) => Number(s.replace(/[$,\s]/g, ""))

/** "1500, 3 días" · "$1,500 en 3 dias" · "HET-00123 900 2 días" → { precio, dias, folio }. Pura. */
export function parsearCotizacion(texto: string): { precio: number; dias: number; folio: number | null } | null {
  const t = String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (t.length > 160) return null
  const fm = t.match(/\bhet-?\s?(\d{1,7})\b/)
  const folio = fm ? Number(fm[1]) : null
  const sinFolio = fm ? t.replace(fm[0], " ") : t
  const dm = sinFolio.match(/(\d{1,3})\s*(?:dias?|d)\b/)
  if (!dm) return null
  const dias = Number(dm[1])
  const resto = sinFolio.replace(dm[0], " ")
  const pm = resto.match(/\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/)
  if (!pm) return null
  const precio = numero(pm[0])
  // Estricto: aparte de precio, días y folio sólo palabras de relleno. Así una
  // pregunta ("¿cuánto cuesta el plan de 300 por 30 días?") no se toma como propuesta.
  const sobra = resto
    .replace(pm[0], " ")
    .replace(/\b(precio|costo|total|entrega|entregamos|tiempo|en|de|a|y|con|sin|iva|incluido|mas|mxn|pesos|habiles|aprox|cotizo|propuesta|son|serian|seria|por|pieza|piezas|lote|todo)\b/g, " ")
    .replace(/[\s,.:;\-$+()!¡]/g, "")
  if (sobra.length) return null
  if (!(precio >= 10 && precio <= 50_000_000) || !(dias >= 1 && dias <= 365)) return null
  return { precio, dias, folio }
}

export const esConfirmacion = (t: string) => /^\s*(si|sí|confirmo|confirmar|ok|va|dale)\s*[.!]*\s*$/i.test(String(t || ""))
export const esCancelacion = (t: string) => /^\s*(no|cancelar|cancela)\s*[.!]*\s*$/i.test(String(t || ""))

/** Fecha de entrega: hoy + días hábiles (sin sábado ni domingo). Pura. */
export function fechaHabil(dias: number, desde = new Date()): string {
  const d = new Date(desde)
  let quedan = dias
  while (quedan > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) quedan--
  }
  return d.toISOString().slice(0, 10)
}

let listo = false
async function asegurar(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_WA_PROPUESTA))) {
    await knex.schema.createTable(T_WA_PROPUESTA, (t: any) => {
      t.text("numero").primary()
      t.text("seller_id").notNullable()
      t.text("solicitud_id").notNullable()
      t.jsonb("datos").notNullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const pesos = (n: number, moneda = "MXN") => `$${n.toLocaleString("es-MX")} ${moneda}`
const ligaPanel = (solId: string) => `${VENDOR_URL}/solicitudes?cotizar=${encodeURIComponent(solId)}`

/** Solicitudes abiertas que le llegaron a este taller en las últimas 72 h y que todavía no cotiza. */
async function candidatas(knex: any, sellerId: string) {
  const desde = new Date(Date.now() - HORAS_AVISO * 3_600_000)
  return (await knex(`${T_AVISO} as a`)
    .join(`${T_SOLICITUD} as s`, "s.id", "a.solicitud_id")
    .where("a.seller_id", sellerId)
    .where("a.created_at", ">=", desde)
    .where("s.estado", "abierta")
    .whereNotExists(knex(T_PROPUESTA).whereRaw(`${T_PROPUESTA}.solicitud_id = s.id`).where(`${T_PROPUESTA}.seller_id`, sellerId).select(knex.raw("1")))
    .groupBy("s.id")
    .orderByRaw("max(a.created_at) desc")
    .limit(5)
    .select("s.id")
    .catch(() => [])) as { id: string }[]
}

/** Revisa que el taller pueda proponer en la solicitud. Devuelve el motivo si no. */
async function puedeProponer(scope: any, knex: any, s: any, sellerId: string): Promise<string | null> {
  if (!s || s.estado !== "abierta" || !recibePropuestas(s)) return "Esa solicitud ya cerró a propuestas nuevas."
  if (s.modo === "directa" && s.taller_id !== sellerId) return "Esa solicitud es para otro taller."
  if (await knex(T_PROPUESTA).where({ solicitud_id: s.id, seller_id: sellerId }).first("id")) return "Ya mandaste propuesta a esa solicitud. Para cambiarla, entra a tu panel."
  if (s.solo_verificados) {
    const yo = await knex("seller").where({ id: sellerId }).first("metadata")
    if (!(yo?.metadata?.verificado === true || yo?.metadata?.verificado === "true")) return "El cliente pidió sólo talleres verificados. Verifica tu taller desde tu panel → Verificación."
  }
  const rel = await relacionTaller(knex, s, sellerId)
  if (!tallerPuedeVer(s, rel)) return "Esa licitación es privada: sólo participan los talleres invitados."
  if (faltaNda(s, rel)) return "Ese cliente pide acuerdo de confidencialidad: acéptalo en tu panel y cotiza ahí."
  if (s.modo !== "directa") {
    const seller = await servicioTalleres(scope).retrieveSeller(sellerId).catch(() => null)
    const cupo = seller ? await cupoLicitacion(knex, sellerId, seller as any).catch(() => null) : null
    if (cupo && cupo.quedan === 0) return mensajeSinCupo(cupo)
  }
  return null
}

/**
 * Atiende un mensaje de WhatsApp si es una propuesta (o su confirmación) de un
 * taller verificado. Devuelve true si lo manejó.
 */
export async function atenderPropuestaWhatsapp(scope: any, knex: any, logger: any, m: { numero: string; texto?: string }): Promise<boolean> {
  if (process.env.PROPUESTA_WHATSAPP === "0") return false
  const num = normalizarNumero(m.numero)
  const texto = String(m.texto || "").trim()
  if (!num || !texto) return false
  const wa = await knex(T_WA).where({ numero: num }).first().catch(() => null)
  if (!wa?.seller_id || !wa.verificado_en) return false
  await asegurar(knex)
  const sellerId = String(wa.seller_id)

  // 1) Confirmación o cancelación de una propuesta pendiente
  const pend = await knex(T_WA_PROPUESTA).where({ numero: num }).first()
  const vigente = pend && Date.now() - new Date(pend.created_at).getTime() < MIN_CONFIRMAR * 60_000
  if (pend && (esConfirmacion(texto) || esCancelacion(texto))) {
    await knex(T_WA_PROPUESTA).where({ numero: num }).del()
    if (esCancelacion(texto)) {
      await enviarTexto(num, "Listo, no se mandó la propuesta.").catch(() => null)
      return true
    }
    if (!vigente) {
      await enviarTexto(num, "Esa propuesta ya venció (30 min). Vuelve a mandar precio y días, por ejemplo: 1500, 3 días.").catch(() => null)
      return true
    }
    const s = await knex(T_SOLICITUD).where({ id: pend.solicitud_id }).first()
    const motivo = await puedeProponer(scope, knex, s, sellerId)
    if (motivo) {
      await enviarTexto(num, motivo).catch(() => null)
      return true
    }
    const d = pend.datos
    await knex(T_PROPUESTA).insert({ id: nuevoId("prop"), solicitud_id: s.id, seller_id: sellerId, ...d, updated_at: knex.fn.now() })
    if (etapaDe(s) === "enviada_talleres") {
      await cambiarEtapa(knex, s, "cotizada", { actor: "taller", correo: false }).catch(() => null)
    }
    await avisarPropuestaNueva(knex, logger, s, { precio: Number(d.precio), moneda: d.moneda || "MXN", dias: Number(d.dias) })
    await enviarTexto(num, `✅ Propuesta enviada para ${folioTexto(s.folio)}. Le avisamos al cliente. Si quieres corregirla: ${ligaPanel(s.id)}`).catch(() => null)
    logger?.info?.(`[propuesta-whatsapp] ${folioTexto(s.folio)}: propuesta del taller ${sellerId}`)
    return true
  }

  // 2) ¿Es una cotización? ("1500, 3 días")
  const c = parsearCotizacion(texto)
  if (!c) return false

  // ¿A cuál solicitud?
  let s: any = null
  if (c.folio) {
    s = await knex(T_SOLICITUD).where({ folio: c.folio }).first()
    if (!s) {
      await enviarTexto(num, `No encontré la solicitud ${folioTexto(c.folio)}. Revisa el folio.`).catch(() => null)
      return true
    }
  } else {
    const cands = await candidatas(knex, sellerId)
    if (!cands.length) {
      await enviarTexto(num, "No tienes solicitudes recientes sin cotizar. Escribe el folio con tu precio, por ejemplo: HET-00123 1500, 3 días.").catch(() => null)
      return true
    }
    if (cands.length > 1) {
      const sols = (await knex(T_SOLICITUD).whereIn("id", cands.map((x) => x.id)).select("folio", "trabajo")) as any[]
      const lista = sols.map((x) => `• ${folioTexto(x.folio)}${x.trabajo?.servicio ? ` (${x.trabajo.servicio})` : ""}`).join("\n")
      await enviarTexto(num, `Tienes varias solicitudes sin cotizar. ¿Para cuál es? Escribe el folio con tu precio, por ejemplo: HET-00123 ${c.precio}, ${c.dias} días\n${lista}`).catch(() => null)
      return true
    }
    s = await knex(T_SOLICITUD).where({ id: cands[0].id }).first()
  }
  const motivo = await puedeProponer(scope, knex, s, sellerId)
  if (motivo) {
    await enviarTexto(num, motivo).catch(() => null)
    return true
  }

  // Datos de siempre: de su última propuesta
  const ultima = await knex(T_PROPUESTA).where({ seller_id: sellerId }).whereNotNull("garantia").whereNotNull("condiciones_pago").orderBy("created_at", "desc").first()
  if (!ultima) {
    await enviarTexto(num, `Tu primera propuesta mándala desde el panel (ahí pones tu garantía y condiciones de pago una vez). Ya va abierta la solicitud: ${ligaPanel(s.id)}\nDespués podrás cotizar contestando aquí con precio y días.`).catch(() => null)
    return true
  }
  const t = s.trabajo || {}
  const datos = {
    precio: c.precio,
    dias: c.dias,
    vigencia_dias: Number(ultima.vigencia_dias) || 15,
    incluye_envio: ultima.incluye_envio || "no",
    condiciones: "",
    // Si cobra HETNA el anticipo es 100 %; se respeta lo de su última propuesta
    anticipo_pct: Number(ultima.anticipo_pct) || 100,
    moneda: ultima.moneda || "MXN",
    materiales: t.material ? `${String(t.material).slice(0, 200)} (el que pidió el cliente)` : String(ultima.materiales || "Según la solicitud").slice(0, 600),
    operaciones: t.servicio ? String(t.servicio).slice(0, 200) : null,
    fecha_entrega: fechaHabil(c.dias),
    condiciones_pago: ultima.condiciones_pago,
    garantia: ultima.garantia,
    observaciones: null,
  }
  await knex(T_WA_PROPUESTA)
    .insert({ numero: num, seller_id: sellerId, solicitud_id: s.id, datos, created_at: new Date() })
    .onConflict("numero")
    .merge()
  await enviarTexto(
    num,
    `¿Mando esta propuesta?\n\n${folioTexto(s.folio)}${t.servicio ? ` · ${t.servicio}` : ""}${t.material ? ` · ${t.material}` : ""}\n` +
      `💲 ${pesos(c.precio, datos.moneda)} (total con IVA)\n📅 ${c.dias} días hábiles · entrega ${datos.fecha_entrega}\n` +
      `🛡 Garantía: ${String(datos.garantia).slice(0, 120)}\n💳 Pago: ${String(datos.condiciones_pago).slice(0, 120)}\n\n` +
      `Responde SÍ para enviarla o NO para cancelar (vale 30 min).`
  ).catch(() => null)
  return true
}
