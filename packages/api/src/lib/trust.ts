// @ts-nocheck
// Licitaciones 3.0 — Fase 4B: HETNA Trust & Ranking (evaluación bilateral).
// (docs/licitaciones-especificacion-maestra.md, sección 8)
//
// - El cliente evalúa al taller con 7 indicadores y el taller al cliente con 7.
// - Sólo en trabajos con relación comercial comprobable: pagados en HETNA y
//   entregados (8.D-1).
// - Nadie ve la evaluación del otro antes de dar la suya: se publican cuando
//   los dos evaluaron o a los 14 días (8.D-3).
// - Pagar plan, verificación o membresía NO cambia la puntuación (8.D-4/5):
//   aquí sólo entran evaluaciones; el posicionamiento vive en confianza.ts.
// - Respuestas, reclamaciones y detección de autoevaluaciones (8.D-6/7/8).
// - Con menos de 3 evaluaciones se muestra "historial insuficiente" (8.D-9).
// - Reputación comercial y capacidad técnica por separado (8.F).
import { T_PROPUESTA, T_SOLICITUD, VENDOR_URL, boton, esc, fila, folioTexto, ligaPropuestas, marco, nuevoId, ocultarContacto } from "./licitacion"
import { T_RESENA, asegurarExtra } from "./licitacion-extra"
import { sendEmail } from "./resend"

export const T_RESENA_CLIENTE = "hetna_resena_cliente"
export const T_RECLAMO = "hetna_resena_reclamo"
export const DIAS_PUBLICACION = 14
export const MIN_HISTORIAL = 3

// [clave, nombre, dimensión] — "tecnica" o "comercial" (8.F)
export const INDICADORES_TALLER: [string, string, "tecnica" | "comercial"][] = [
  ["calidad", "Calidad de fabricación", "tecnica"],
  ["tiempo", "Cumplimiento de entregas", "comercial"],
  ["comunicacion", "Comunicación", "comercial"],
  ["precio", "Precio (cotizado vs. cobrado)", "comercial"],
  ["capacidad", "Capacidad técnica", "tecnica"],
  ["profesionalismo", "Profesionalismo", "comercial"],
  ["posventa", "Servicio posventa", "comercial"],
]
export const INDICADORES_CLIENTE: [string, string][] = [
  ["claridad", "Claridad del proyecto"],
  ["comunicacion", "Comunicación"],
  ["pagos", "Cumplimiento de pagos"],
  ["formalidad", "Formalidad"],
  ["cambios", "Manejo de cambios de alcance"],
  ["profesionalismo", "Profesionalismo"],
  ["contractual", "Cumplimiento de compromisos"],
]
// Opcional: puede no aplicar (0 = "no aplica")
const OPCIONALES = new Set(["posventa"])

let listo = false
export async function asegurarTrust(knex: any) {
  if (listo) return
  await asegurarExtra(knex)
  for (const [col, tipo] of [
    ["comunicacion", "integer"], ["precio", "integer"], ["capacidad", "integer"], ["profesionalismo", "integer"], ["posventa", "integer"],
    ["simultanea", "boolean"], ["publicada_en", "timestamptz"], ["sospechosa", "boolean"],
  ]) {
    await knex.raw(`alter table ?? add column if not exists ?? ${tipo}`, [T_RESENA, col])
  }
  if (!(await knex.schema.hasTable(T_RESENA_CLIENTE))) {
    await knex.schema.createTable(T_RESENA_CLIENTE, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().unique()
      t.text("seller_id").notNullable().index()
      t.text("cliente_id").index()
      t.text("cliente_email").index()
      for (const [k] of INDICADORES_CLIENTE) t.integer(k).notNullable()
      t.decimal("promedio", 3, 2).notNullable()
      t.text("comentario")
      t.text("respuesta_cliente")
      t.boolean("visible").notNullable().defaultTo(true)
      t.boolean("sospechosa")
      t.timestamp("publicada_en", { useTz: true })
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_RECLAMO))) {
    await knex.schema.createTable(T_RECLAMO, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().index()
      t.text("tipo").notNullable() // resena_taller | resena_cliente
      t.text("resena_id").notNullable()
      t.text("parte").notNullable() // cliente | taller | hetna
      t.text("motivo").notNullable()
      t.text("estado").notNullable().defaultTo("abierto") // abierto | oculta | mantenida
      t.text("resolucion")
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("resuelto_en", { useTz: true })
    })
  }
  listo = true
}

/** Condición SQL: evaluación pública (visible y, si es simultánea, ya publicada). */
export const publica = (q: any, alias = "") => {
  const c = (x: string) => (alias ? `${alias}.${x}` : x)
  return q.where(c("visible"), true).andWhere((w: any) => w.whereNot(c("simultanea"), true).orWhereNull(c("simultanea")).orWhereNotNull(c("publicada_en")))
}

const nota = (v: unknown, opcional = false) => {
  const n = Math.round(Number(v))
  if (opcional && (v === 0 || v === "0" || v === "" || v == null)) return null
  return n >= 1 && n <= 5 ? n : undefined
}
const err = (message: string, status = 400) => Object.assign(new Error(message), { status })

function verificarComprobable(s: any, quien: "cliente" | "taller") {
  if (!s.propuesta_elegida) throw err("Esta solicitud no tiene taller elegido.", 409)
  if (!(s.pago_estado === "pagado" || s.pago_estado === "anticipo" || s.estado === "pagada" || s.estado === "cerrada"))
    throw err("Sólo se evalúan trabajos pagados en HETNA.", 409)
  if (!["entregada", "cerrada"].includes(String(s.etapa || "")))
    throw err(quien === "cliente" ? "Podrás evaluar al taller cuando te entregue tu pedido." : "Podrás evaluar al cliente cuando entregues el pedido.", 409)
}

const LIBRES = /^(gmail|hotmail|outlook|live|yahoo|icloud|me|aol|protonmail|proton|msn|prodigy|gmx)\./i
/** Autoevaluación probable: mismo correo, o mismo dominio corporativo. */
export function pareceAutoevaluacion(emailCliente?: string | null, emailTaller?: string | null) {
  const a = String(emailCliente || "").toLowerCase().trim()
  const b = String(emailTaller || "").toLowerCase().trim()
  if (!a || !b) return false
  if (a === b) return true
  const da = a.split("@")[1] || ""
  const db = b.split("@")[1] || ""
  return !!da && da === db && !LIBRES.test(da)
}

async function reclamoAuto(knex: any, s: any, tipo: string, resenaId: string, motivo: string) {
  await knex(T_RECLAMO).insert({ id: nuevoId("rcl"), solicitud_id: s.id, tipo, resena_id: resenaId, parte: "hetna", motivo })
  if (process.env.HETNA_LEADS_EMAIL)
    await sendEmail({ to: process.env.HETNA_LEADS_EMAIL, subject: `[${folioTexto(s.folio)}] Evaluación sospechosa retenida`, html: marco("Evaluación retenida para revisión", `<p>${esc(motivo)}</p><p>Revísala en el panel: Verificaciones → Reclamaciones de evaluaciones.</p>`) }).catch(() => {})
}

// ---------------------------------------------------------------------
// El cliente evalúa al taller
// ---------------------------------------------------------------------

export async function guardarEvaluacionTaller(knex: any, s: any, b: Record<string, unknown>, logger?: any) {
  await asegurarTrust(knex)
  verificarComprobable(s, "cliente")
  const notas: Record<string, number | null> = {}
  for (const [k, nombre] of INDICADORES_TALLER) {
    const n = nota(b[k], OPCIONALES.has(k))
    if (n === undefined) throw err(`Califica "${nombre}" de 1 a 5 estrellas.`)
    notas[k] = n
  }
  const valores = Object.values(notas).filter((x) => x != null) as number[]
  const promedio = Math.round((valores.reduce((a, x) => a + x, 0) / valores.length) * 100) / 100
  const comentario = ocultarContacto(String(b.comentario || "").trim()).slice(0, 1000) || null
  const p = await knex(`${T_PROPUESTA} as p`).join("seller as v", "v.id", "p.seller_id").where("p.id", s.propuesta_elegida).first("p.seller_id", "v.email")
  if (!p) throw err("Propuesta no encontrada.", 404)
  const autor = String(s.contacto?.nombre || "").trim().split(/\s+/)[0]?.slice(0, 40) || null
  const previa = await knex(T_RESENA).where({ solicitud_id: s.id }).first()
  const trato = Math.round(((notas.comunicacion as number) + (notas.profesionalismo as number)) / 2)
  const sospechosa = pareceAutoevaluacion(s.contacto?.email, p.email)
  const datos: any = { seller_id: p.seller_id, ...notas, trato, promedio, comentario, autor, simultanea: previa ? previa.simultanea ?? false : true }
  if (sospechosa) Object.assign(datos, { visible: false, sospechosa: true })
  let id = previa?.id
  if (previa) await knex(T_RESENA).where({ id }).update(datos)
  else await knex(T_RESENA).insert({ id: (id = nuevoId("res")), solicitud_id: s.id, ...datos })
  if (sospechosa && !previa?.sospechosa) await reclamoAuto(knex, s, "resena_taller", id, "Posible autoevaluación: el correo del cliente coincide con el del taller.")

  const publicada = await publicarSiAmbas(knex, s, logger)
  if (!previa && !publicada) {
    await sendEmail({
      to: p.email,
      subject: `[${folioTexto(s.folio)}] Tu cliente ya te evaluó`,
      html: marco(
        "Tu cliente ya te evaluó",
        `<p style="color:#40403A">Verás su evaluación cuando tú evalúes al cliente (o en ${DIAS_PUBLICACION} días). Así nadie califica condicionado por lo que dijo el otro.</p>` +
          boton("Evaluar al cliente", `${VENDOR_URL}/solicitudes`)
      ),
    }).catch(() => {})
  }
  await recalcularTaller(knex, p.seller_id)
  return { promedio, publicada }
}

// ---------------------------------------------------------------------
// El taller evalúa al cliente
// ---------------------------------------------------------------------

export async function guardarEvaluacionCliente(knex: any, s: any, sellerId: string, b: Record<string, unknown>, logger?: any) {
  await asegurarTrust(knex)
  verificarComprobable(s, "taller")
  const p = await knex(`${T_PROPUESTA} as p`).join("seller as v", "v.id", "p.seller_id").where("p.id", s.propuesta_elegida).first("p.seller_id", "v.email")
  if (!p || p.seller_id !== sellerId) throw err("Sólo el taller elegido evalúa al cliente.", 403)
  const notas: Record<string, number> = {}
  for (const [k, nombre] of INDICADORES_CLIENTE) {
    const n = nota(b[k])
    if (!n) throw err(`Califica "${nombre}" de 1 a 5 estrellas.`)
    notas[k] = n
  }
  const promedio = Math.round((Object.values(notas).reduce((a, x) => a + x, 0) / INDICADORES_CLIENTE.length) * 100) / 100
  const comentario = ocultarContacto(String(b.comentario || "").trim()).slice(0, 1000) || null
  const sospechosa = pareceAutoevaluacion(s.contacto?.email, p.email)
  const previa = await knex(T_RESENA_CLIENTE).where({ solicitud_id: s.id }).first()
  const datos: any = {
    seller_id: sellerId, cliente_id: s.cliente_id || null, cliente_email: String(s.contacto?.email || "").toLowerCase() || null,
    ...notas, promedio, comentario,
  }
  if (sospechosa) Object.assign(datos, { visible: false, sospechosa: true })
  let id = previa?.id
  if (previa) await knex(T_RESENA_CLIENTE).where({ id }).update(datos)
  else await knex(T_RESENA_CLIENTE).insert({ id: (id = nuevoId("rcli")), solicitud_id: s.id, ...datos })
  if (sospechosa && !previa?.sospechosa) await reclamoAuto(knex, s, "resena_cliente", id, "Posible autoevaluación: el correo del cliente coincide con el del taller.")

  const publicada = await publicarSiAmbas(knex, s, logger)
  if (!previa && !publicada && s.contacto?.email) {
    await sendEmail({
      to: s.contacto.email,
      subject: `[${folioTexto(s.folio)}] El taller ya te evaluó`,
      html: marco(
        "El taller ya te evaluó como cliente",
        `<p style="color:#40403A">Verás su evaluación cuando tú califiques al taller (o en ${DIAS_PUBLICACION} días). Una buena reputación como cliente te abre las puertas de los mejores talleres.</p>` +
          boton("Evaluar al taller", ligaPropuestas(s.token))
      ),
    }).catch(() => {})
  }
  return { promedio, publicada }
}

// ---------------------------------------------------------------------
// Publicación simultánea (o a los 14 días)
// ---------------------------------------------------------------------

/** Si ya evaluaron los dos, publica ambas evaluaciones. Devuelve true si quedó publicada. */
export async function publicarSiAmbas(knex: any, s: any, logger?: any) {
  const [rt, rc] = await Promise.all([knex(T_RESENA).where({ solicitud_id: s.id }).first(), knex(T_RESENA_CLIENTE).where({ solicitud_id: s.id }).first()])
  if (!rt || !rc) return false
  if (rt.publicada_en && rc.publicada_en) return true
  await knex(T_RESENA).where({ id: rt.id }).whereNull("publicada_en").update({ publicada_en: knex.fn.now() })
  await knex(T_RESENA_CLIENTE).where({ id: rc.id }).whereNull("publicada_en").update({ publicada_en: knex.fn.now() })
  await recalcularTaller(knex, rt.seller_id)
  const folio = folioTexto(s.folio)
  const v = await knex("seller").where({ id: rt.seller_id }).first("email")
  const aviso = (to: string, liga: string) =>
    sendEmail({ to, subject: `[${folio}] Ya se publicaron las evaluaciones`, html: marco("Ya pueden ver sus evaluaciones", `<p style="color:#40403A">Los dos evaluaron, así que publicamos ambas evaluaciones. Si algo no es correcto, puedes responder o pedir una revisión.</p>` + boton("Ver evaluación", liga)) }).catch(() => {})
  if (v?.email) await aviso(v.email, `${VENDOR_URL}/solicitudes`)
  if (s.contacto?.email) await aviso(s.contacto.email, ligaPropuestas(s.token))
  logger?.info?.(`[trust] ${folio}: evaluaciones publicadas`)
  return true
}

/** Job diario: publica las que llevan 14 días esperando a la otra parte. */
export async function publicarVencidas(knex: any, logger?: any) {
  await asegurarTrust(knex)
  const limite = knex.raw(`now() - interval '${DIAS_PUBLICACION} days'`)
  const rt = await knex(T_RESENA).where({ simultanea: true }).whereNull("publicada_en").where("created_at", "<", limite).select("id", "seller_id")
  const rc = await knex(T_RESENA_CLIENTE).whereNull("publicada_en").where("created_at", "<", limite).select("id")
  if (rt.length) await knex(T_RESENA).whereIn("id", rt.map((r: any) => r.id)).update({ publicada_en: knex.fn.now() })
  if (rc.length) await knex(T_RESENA_CLIENTE).whereIn("id", rc.map((r: any) => r.id)).update({ publicada_en: knex.fn.now() })
  for (const sid of new Set(rt.map((r: any) => r.seller_id))) await recalcularTaller(knex, sid as string)
  if (rt.length || rc.length) logger?.info?.(`[trust] publicadas por plazo: ${rt.length} de talleres, ${rc.length} de clientes`)
  return { talleres: rt.length, clientes: rc.length }
}

// ---------------------------------------------------------------------
// Puntuaciones
// ---------------------------------------------------------------------

const r1 = (x: any) => (x == null ? null : Math.round(Number(x) * 10) / 10)

/** Promedio general y por indicador del taller → seller.metadata.perfil. */
export async function recalcularTaller(knex: any, sellerId: string) {
  await asegurarTrust(knex)
  const cols = INDICADORES_TALLER.map(([k]) => k)
  const sel = Object.fromEntries(cols.map((k) => [k, k]))
  const r = await publica(knex(T_RESENA).where({ seller_id: sellerId })).avg({ prom: "promedio", ...sel }).count({ n: "*" }).first()
  const n = Number(r?.n || 0)
  const indicadores = Object.fromEntries(cols.map((k) => [k, r1(r?.[k])]))
  const comercial = INDICADORES_TALLER.filter(([, , d]) => d === "comercial").map(([k]) => indicadores[k]).filter((x) => x != null)
  const tecnica = INDICADORES_TALLER.filter(([, , d]) => d === "tecnica").map(([k]) => indicadores[k]).filter((x) => x != null)
  const prom = (xs: number[]) => (xs.length ? r1(xs.reduce((a, x) => a + x, 0) / xs.length) : null)
  const datos = {
    calificacion: n ? r1(r.prom) : null,
    resenas: n,
    resenas_hetna: true,
    indicadores: n ? indicadores : null,
    reputacion_comercial: n ? prom(comercial as number[]) : null,
    capacidad_tecnica: n ? prom(tecnica as number[]) : null,
    historial_suficiente: n >= MIN_HISTORIAL,
  }
  await knex.raw(
    `update seller set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('perfil', coalesce(metadata->'perfil', '{}'::jsonb) || ?::jsonb) where id = ?`,
    [JSON.stringify(datos), sellerId]
  )
  return datos
}

/** Reputación del cliente como comprador (la ven los talleres). */
export async function reputacionCliente(knex: any, c: { clienteId?: string | null; email?: string | null }) {
  await asegurarTrust(knex)
  const email = String(c.email || "").toLowerCase().trim()
  if (!c.clienteId && !email) return { promedio: null, evaluaciones: 0, suficiente: false, indicadores: null }
  const q = publica(knex(T_RESENA_CLIENTE)).andWhere((w: any) => {
    if (c.clienteId) w.orWhere("cliente_id", c.clienteId)
    if (email) w.orWhere("cliente_email", email)
  })
  const sel = Object.fromEntries(INDICADORES_CLIENTE.map(([k]) => [k, k]))
  const r = await q.avg({ prom: "promedio", ...sel }).count({ n: "*" }).first()
  const n = Number(r?.n || 0)
  return {
    promedio: n ? r1(r.prom) : null,
    evaluaciones: n,
    suficiente: n >= MIN_HISTORIAL,
    indicadores: n ? Object.fromEntries(INDICADORES_CLIENTE.map(([k]) => [k, r1(r[k])])) : null,
  }
}

// ---------------------------------------------------------------------
// Vista de cada parte, respuestas y reclamaciones
// ---------------------------------------------------------------------

const limpiaTaller = (x: any) =>
  x && {
    id: x.id, promedio: Number(x.promedio), comentario: x.comentario, respuesta: x.respuesta_taller, fecha: x.created_at,
    publicada: !x.simultanea || !!x.publicada_en, retenida: x.visible === false,
    ...Object.fromEntries(INDICADORES_TALLER.map(([k]) => [k, x[k] ?? null])),
  }
const limpiaCliente = (x: any) =>
  x && {
    id: x.id, promedio: Number(x.promedio), comentario: x.comentario, respuesta: x.respuesta_cliente, fecha: x.created_at,
    publicada: !!x.publicada_en, retenida: x.visible === false,
    ...Object.fromEntries(INDICADORES_CLIENTE.map(([k]) => [k, x[k]])),
  }

/** Qué ve cada parte: lo que dio, y lo que recibió sólo si ya se publicó. */
export async function evaluacionesDe(knex: any, s: any, parte: "cliente" | "taller") {
  await asegurarTrust(knex)
  const [rt, rc] = await Promise.all([knex(T_RESENA).where({ solicitud_id: s.id }).first(), knex(T_RESENA_CLIENTE).where({ solicitud_id: s.id }).first()])
  const t = limpiaTaller(rt)
  const c = limpiaCliente(rc)
  const dada = parte === "cliente" ? t : c
  const recibida = parte === "cliente" ? c : t
  return {
    indicadores: parte === "cliente" ? INDICADORES_TALLER.map(([clave, nombre]) => ({ clave, nombre, opcional: OPCIONALES.has(clave) })) : INDICADORES_CLIENTE.map(([clave, nombre]) => ({ clave, nombre, opcional: false })),
    dada,
    recibida: recibida && recibida.publicada ? recibida : null,
    recibida_pendiente: !!recibida && !recibida.publicada,
    dias_publicacion: DIAS_PUBLICACION,
  }
}

export async function responderEvaluacion(knex: any, s: any, parte: "cliente" | "taller", texto: string) {
  await asegurarTrust(knex)
  const t = ocultarContacto(String(texto || "").trim()).slice(0, 800)
  if (!t) throw err("Escribe tu respuesta.")
  if (parte === "taller") {
    const r = await knex(T_RESENA).where({ solicitud_id: s.id }).first()
    if (!r || (r.simultanea && !r.publicada_en)) throw err("La evaluación todavía no está publicada.", 409)
    await knex(T_RESENA).where({ id: r.id }).update({ respuesta_taller: t })
  } else {
    const r = await knex(T_RESENA_CLIENTE).where({ solicitud_id: s.id }).first()
    if (!r || !r.publicada_en) throw err("La evaluación todavía no está publicada.", 409)
    await knex(T_RESENA_CLIENTE).where({ id: r.id }).update({ respuesta_cliente: t })
  }
  return { ok: true }
}

/** Reclamación sobre la evaluación que recibí (la revisa HETNA). */
export async function reclamarEvaluacion(knex: any, s: any, parte: "cliente" | "taller", motivo: string) {
  await asegurarTrust(knex)
  const m = String(motivo || "").trim().slice(0, 1000)
  if (m.length < 10) throw err("Explica en una o dos frases por qué la evaluación no es correcta.")
  const tipo = parte === "taller" ? "resena_taller" : "resena_cliente"
  const r = await knex(parte === "taller" ? T_RESENA : T_RESENA_CLIENTE).where({ solicitud_id: s.id }).first("id")
  if (!r) throw err("No hay evaluación que reclamar.", 404)
  if (await knex(T_RECLAMO).where({ resena_id: r.id, parte, estado: "abierto" }).first("id")) throw err("Ya tienes una reclamación abierta sobre esta evaluación.", 409)
  await knex(T_RECLAMO).insert({ id: nuevoId("rcl"), solicitud_id: s.id, tipo, resena_id: r.id, parte, motivo: m })
  if (process.env.HETNA_LEADS_EMAIL)
    await sendEmail({
      to: process.env.HETNA_LEADS_EMAIL,
      subject: `[${folioTexto(s.folio)}] Reclamación de evaluación (${parte})`,
      html: marco("Reclamación de una evaluación", `<table style="border-collapse:collapse;font-size:14px">${fila("Quién reclama", parte)}${fila("Motivo", m)}</table><p>Resuélvela en el panel: Verificaciones → Reclamaciones de evaluaciones.</p>`),
    }).catch(() => {})
  return { ok: true }
}

/** Reclamaciones para el panel de HETNA. */
export async function listarReclamos(knex: any, estado = "abierto") {
  await asegurarTrust(knex)
  const filas = await knex(`${T_RECLAMO} as r`).join(`${T_SOLICITUD} as s`, "s.id", "r.solicitud_id").where("r.estado", estado).orderBy("r.created_at", "desc").limit(200).select("r.*", "s.folio")
  const out = []
  for (const r of filas) {
    const ev = await knex(r.tipo === "resena_taller" ? T_RESENA : T_RESENA_CLIENTE).where({ id: r.resena_id }).first()
    out.push({ id: r.id, folio: folioTexto(r.folio), tipo: r.tipo, parte: r.parte, motivo: r.motivo, creada: r.created_at, evaluacion: ev ? { promedio: Number(ev.promedio), comentario: ev.comentario, visible: ev.visible } : null })
  }
  return out
}

export async function resolverReclamo(knex: any, id: string, accion: "ocultar" | "mantener", resolucion?: string) {
  await asegurarTrust(knex)
  const r = await knex(T_RECLAMO).where({ id }).first()
  if (!r) throw err("Reclamación no encontrada.", 404)
  const tabla = r.tipo === "resena_taller" ? T_RESENA : T_RESENA_CLIENTE
  await knex(tabla).where({ id: r.resena_id }).update({ visible: accion !== "ocultar" })
  await knex(T_RECLAMO).where({ resena_id: r.resena_id, estado: "abierto" }).update({ estado: accion === "ocultar" ? "oculta" : "mantenida", resolucion: String(resolucion || "").slice(0, 500) || null, resuelto_en: knex.fn.now() })
  if (r.tipo === "resena_taller") {
    const ev = await knex(T_RESENA).where({ id: r.resena_id }).first("seller_id")
    if (ev) await recalcularTaller(knex, ev.seller_id)
  }
  return { ok: true }
}

/** Reputación de varios clientes a la vez (lista de solicitudes del taller). */
export async function reputacionesClientes(knex: any, filas: { id: string; cliente_id?: string | null; email?: string | null }[]) {
  await asegurarTrust(knex)
  const ids = [...new Set(filas.map((f) => f.cliente_id).filter(Boolean))] as string[]
  const correos = [...new Set(filas.map((f) => String(f.email || "").toLowerCase()).filter(Boolean))]
  const out = new Map<string, { promedio: number | null; evaluaciones: number; suficiente: boolean }>()
  if (!ids.length && !correos.length) return out
  const evs = await publica(knex(T_RESENA_CLIENTE))
    .andWhere((w: any) => {
      if (ids.length) w.orWhereIn("cliente_id", ids)
      if (correos.length) w.orWhereIn("cliente_email", correos)
    })
    .select("id", "cliente_id", "cliente_email", "promedio")
  for (const f of filas) {
    const email = String(f.email || "").toLowerCase()
    const mias = evs.filter((e: any) => (f.cliente_id && e.cliente_id === f.cliente_id) || (email && e.cliente_email === email))
    const n = mias.length
    out.set(f.id, { promedio: n ? r1(mias.reduce((a: number, e: any) => a + Number(e.promedio), 0) / n) : null, evaluaciones: n, suficiente: n >= MIN_HISTORIAL })
  }
  return out
}
