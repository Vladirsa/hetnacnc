// @ts-nocheck
// Licitaciones 2.0 — lo que hace la licitación más justa y confiable:
//
//   · Preguntas sobre la solicitud: el taller pregunta antes de proponer, el
//     cliente contesta y la respuesta la ven TODOS los talleres (y el tablero
//     público /trabajos). Nunca pasan datos de contacto (ocultarContacto).
//   · Aviso a los talleres que no ganaron: rango del precio elegido (±10 %) y
//     días de entrega, sin nombre del ganador. Nadie más lo hace.
//   · Reseña del cliente al cerrar: calidad, tiempo y trato (1–5) + comentario.
//     Sólo de trabajos pagados en HETNA. Alimenta la calificación del taller
//     (seller.metadata.perfil.calificacion y .resenas).
//   · Cuenta del cliente: la solicitud se liga al cliente (cliente_id) cuando
//     la manda con sesión o cuando abre su liga con sesión iniciada.
import { sendEmail } from "./resend"
import { pushACliente, pushATalleres } from "./push"
import {
  T_PROPUESTA,
  T_SOLICITUD,
  VENDOR_URL,
  boton,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
  nuevoId,
  ocultarContacto,
} from "./licitacion"

export const T_PREGUNTA = "hetna_solicitud_pregunta"
export const T_RESENA = "hetna_resena_taller"
export const MAX_PREGUNTAS_POR_TALLER = 3

let listo = false
export const asegurarExtra = async (knex: any) => {
  if (listo) return
  if (!(await knex.schema.hasTable(T_PREGUNTA))) {
    await knex.schema.createTable(T_PREGUNTA, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().index()
      t.text("seller_id").notNullable()
      t.text("pregunta").notNullable()
      t.text("respuesta").nullable()
      t.timestamp("respondida_en", { useTz: true }).nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_RESENA))) {
    await knex.schema.createTable(T_RESENA, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().unique()
      t.text("seller_id").notNullable().index()
      t.integer("calidad").notNullable()
      t.integer("tiempo").notNullable()
      t.integer("trato").notNullable()
      t.decimal("promedio", 3, 2).notNullable()
      t.text("comentario").nullable()
      t.text("autor").nullable() // nombre de pila del cliente
      t.text("respuesta_taller").nullable()
      t.boolean("visible").notNullable().defaultTo(true)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasColumn(T_SOLICITUD, "cliente_id"))) {
    await knex.schema.alterTable(T_SOLICITUD, (t: any) => {
      t.text("cliente_id").nullable().index()
    })
  }
  listo = true
}

// ── Cuenta del cliente ────────────────────────────────────────────────
export async function ligarCliente(knex: any, solicitudId: string, clienteId: string | null | undefined) {
  if (!clienteId || !/^cus_[A-Za-z0-9]{10,40}$/.test(clienteId)) return
  await asegurarExtra(knex)
  await knex(T_SOLICITUD).where({ id: solicitudId }).whereNull("cliente_id").update({ cliente_id: clienteId })
}

// ── Preguntas ─────────────────────────────────────────────────────────
export async function preguntasDe(knex: any, solicitudId: string, opciones: { sellerId?: string; soloRespondidas?: boolean } = {}) {
  await asegurarExtra(knex)
  const filas = await knex(T_PREGUNTA)
    .where({ solicitud_id: solicitudId })
    .modify((q: any) => {
      if (opciones.soloRespondidas) q.whereNotNull("respuesta")
    })
    .orderBy("created_at", "asc")
    .select("id", "seller_id", "pregunta", "respuesta", "respondida_en", "created_at")
  return filas.map((p: any) => ({
    id: p.id,
    pregunta: p.pregunta,
    respuesta: p.respuesta || null,
    respondida_en: p.respondida_en,
    fecha: p.created_at,
    mia: opciones.sellerId ? p.seller_id === opciones.sellerId : undefined,
  }))
}

export async function preguntar(knex: any, s: any, sellerId: string, texto: string, logger?: any) {
  await asegurarExtra(knex)
  const pregunta = ocultarContacto(String(texto || "").trim()).slice(0, 600)
  if (pregunta.length < 8) throw Object.assign(new Error("Escribe tu pregunta (mínimo 8 letras)."), { status: 400 })
  const n = await knex(T_PREGUNTA).where({ solicitud_id: s.id, seller_id: sellerId }).count("* as n").first()
  if (Number(n?.n || 0) >= MAX_PREGUNTAS_POR_TALLER)
    throw Object.assign(new Error(`Puedes hacer hasta ${MAX_PREGUNTAS_POR_TALLER} preguntas por solicitud.`), { status: 429 })
  const id = nuevoId("prg")
  await knex(T_PREGUNTA).insert({ id, solicitud_id: s.id, seller_id: sellerId, pregunta })
  const folio = folioTexto(s.folio)
  await pushACliente(
    knex,
    { customerId: s.cliente_id, email: s.contacto?.email },
    { titulo: "Un taller te hizo una pregunta", cuerpo: `${folio}: ${pregunta}`, url: `${ligaPropuestas(s.token)}#preguntas`, etiqueta: `sol-${s.id}` },
    logger
  )
  if (s.contacto?.email) {
    const r = await sendEmail({
      to: s.contacto.email,
      subject: `[${folio}] Un taller tiene una pregunta sobre tu solicitud`,
      html: marco(
        "Un taller quiere darte un precio exacto",
        `<p style="color:#40403A">Antes de mandarte su propuesta, un taller pregunta:</p>` +
          `<p style="margin:0 0 12px;color:#142033;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(pregunta)}</p>` +
          `<p style="color:#40403A">Tu respuesta la verán todos los talleres que cotizan tu trabajo, así todos te dan un precio con la misma información.</p>` +
          boton("Responder", `${ligaPropuestas(s.token)}#preguntas`)
      ),
    })
    if (!r.sent) logger?.info?.(`[licitacion] aviso de pregunta no enviado: ${r.reason}`)
  }
  return id
}

export async function responder(knex: any, s: any, preguntaId: string, texto: string, logger?: any) {
  await asegurarExtra(knex)
  const respuesta = ocultarContacto(String(texto || "").trim()).slice(0, 1200)
  if (respuesta.length < 2) throw Object.assign(new Error("Escribe tu respuesta."), { status: 400 })
  const p = await knex(T_PREGUNTA).where({ id: preguntaId, solicitud_id: s.id }).first()
  if (!p) throw Object.assign(new Error("Pregunta no encontrada."), { status: 404 })
  await knex(T_PREGUNTA).where({ id: p.id }).update({ respuesta, respondida_en: knex.fn.now() })

  // Avisa al taller que preguntó y a los que ya propusieron (por si cambia su precio)
  const folio = folioTexto(s.folio)
  const ids = new Set<string>([p.seller_id])
  for (const x of await knex(T_PROPUESTA).where({ solicitud_id: s.id }).select("seller_id")) ids.add(x.seller_id)
  const talleres = await knex("seller").whereIn("id", [...ids]).select("id", "email")
  await pushATalleres(
    knex,
    [...ids],
    { titulo: "El cliente respondió", cuerpo: `${folio}: ${respuesta}`, url: "/seller/solicitudes", etiqueta: `sol-${s.id}` },
    logger
  )
  for (const t of talleres) {
    if (!t.email) continue
    const r = await sendEmail({
      to: t.email,
      subject: `[${folio}] El cliente respondió una pregunta`,
      html: marco(
        "Nueva respuesta del cliente",
        `<table style="border-collapse:collapse;font-size:14px">` + fila("Folio", folio) + fila("Pregunta", p.pregunta) + fila("Respuesta", respuesta) + `</table>` +
          (t.id !== p.seller_id ? `<p style="color:#40403A">Ya mandaste propuesta: si esto cambia tu precio o tus días, puedes corregirla mientras el cliente no elija.</p>` : "") +
          boton("Ver la solicitud", `${VENDOR_URL}/solicitudes`)
      ),
    })
    if (!r.sent) logger?.info?.(`[licitacion] aviso de respuesta no enviado: ${r.reason}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

// ── Aviso a los que no ganaron ────────────────────────────────────────
/** Rango redondeado (±10 %) del precio elegido: orienta sin exponer al ganador. */
export const rangoGanador = (precio: number) => {
  const redondo = (n: number) => (n >= 10_000 ? Math.round(n / 500) * 500 : n >= 1_000 ? Math.round(n / 50) * 50 : Math.round(n / 10) * 10)
  return { desde: redondo(precio * 0.9), hasta: redondo(precio * 1.1) }
}

export async function avisarNoElegidos(knex: any, s: any, ganadora: any, logger?: any) {
  const otras = await knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where("p.solicitud_id", s.id)
    .whereNot("p.id", ganadora.id)
    .select("p.precio", "p.dias", "v.email")
  if (!otras.length) return
  const folio = folioTexto(s.folio)
  const r = rangoGanador(Number(ganadora.precio))
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`
  for (const o of otras) {
    if (!o.email) continue
    const mio = Number(o.precio)
    const comparacion =
      mio > r.hasta ? "Tu precio quedó arriba del elegido." : mio < r.desde ? "Tu precio quedó abajo del elegido: pesó más otra cosa (tiempo, calificación o condiciones)." : "Tu precio estuvo muy cerca del elegido."
    const res = await sendEmail({
      to: o.email,
      subject: `[${folio}] El cliente eligió otra propuesta`,
      html: marco(
        "Esta vez eligieron otra propuesta",
        `<p style="color:#40403A">Gracias por cotizar. Para que te sirva en la próxima, esto fue lo que eligió el cliente:</p>` +
          `<table style="border-collapse:collapse;font-size:14px">` +
          fila("Folio", folio) +
          fila("Precio elegido", `entre ${fmt(r.desde)} y ${fmt(r.hasta)} MXN`) +
          fila("Entrega elegida", `${ganadora.dias} días`) +
          fila("Tu propuesta", `${fmt(mio)} MXN · ${o.dias} días`) +
          `</table><p style="color:#40403A">${esc(comparacion)} Los clientes también ven tu calificación y si tu taller está verificado.</p>` +
          boton("Ver más solicitudes", `${VENDOR_URL}/solicitudes`)
      ),
    })
    if (!res.sent) logger?.info?.(`[licitacion] aviso a no elegido no enviado: ${res.reason}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

// ── Reseñas ───────────────────────────────────────────────────────────
const nota = (v: unknown) => {
  const n = Math.round(Number(v))
  return n >= 1 && n <= 5 ? n : null
}

export async function resenaDe(knex: any, solicitudId: string) {
  await asegurarExtra(knex)
  return knex(T_RESENA).where({ solicitud_id: solicitudId }).first()
}

// guardarResena y recalcularCalificacion se movieron a lib/trust.ts (Fase 4: 7 indicadores y publicación simultánea).

/** Reseñas públicas de un taller (para su perfil). */
export async function resenasPublicas(knex: any, sellerId: string, limite = 20) {
  await asegurarExtra(knex)
  const filas = await knex(`${T_RESENA} as r`)
    .join(`${T_SOLICITUD} as s`, "s.id", "r.solicitud_id")
    .where({ "r.seller_id": sellerId, "r.visible": true })
    // Fase 4: las simultáneas sólo cuando ya se publicaron (ambos evaluaron o pasaron 14 días)
    .andWhere((w: any) => w.whereNot("r.simultanea", true).orWhereNull("r.simultanea").orWhereNotNull("r.publicada_en"))
    .orderBy("r.created_at", "desc")
    .limit(limite)
    .select("r.calidad", "r.tiempo", "r.trato", "r.comunicacion", "r.precio", "r.capacidad", "r.profesionalismo", "r.posventa", "r.promedio", "r.comentario", "r.autor", "r.respuesta_taller", "r.created_at", "s.trabajo")
  return filas.map((x: any) => ({
    calidad: x.calidad,
    tiempo: x.tiempo,
    trato: x.trato,
    comunicacion: x.comunicacion ?? null,
    precio: x.precio ?? null,
    capacidad: x.capacidad ?? null,
    profesionalismo: x.profesionalismo ?? null,
    posventa: x.posventa ?? null,
    promedio: Number(x.promedio),
    comentario: x.comentario,
    autor: x.autor,
    respuesta_taller: x.respuesta_taller,
    fecha: x.created_at,
    trabajo: [x.trabajo?.servicio, x.trabajo?.material].filter(Boolean).join(" · "),
  }))
}
