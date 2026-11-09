// @ts-nocheck
// Licitaciones 3.0 — Fase 3: confianza (verificación, certificaciones,
// posicionamiento) y membresía empresarial de clientes.
// (docs/licitaciones-especificacion-maestra.md, secciones 6, 9 y 12)
//
// Tres conceptos SEPARADOS (regla de la especificación):
//   1. Identidad/empresa verificada  -> seller.metadata.verificado / empresa_verificada
//   2. Certificaciones acreditadas   -> tabla hetna_certificacion (aprobadas por HETNA)
//   3. Reputación por operaciones    -> calificación de reseñas (NO se toca aquí)
//
// Decisiones del dueño (9 nov 2026):
//   · Verificación y revisión de certificaciones incluidas en los planes de
//     pago (Taller, Pro, Industrial). Plan Gratis: pago único de $299 MXN.
//   · El plan, la verificación y las certificaciones POSICIONAN mejor al taller
//     (orden en búsquedas, propuestas y difusión), pero nunca cambian su
//     calificación.
//   · Membresía Empresarial de clientes: gratis por ahora, la activa HETNA a
//     mano. Incluye licitaciones privadas y restringidas, resumen con IA,
//     "HETNA te busca proveedor" y filtro de sólo talleres verificados.
import { randomBytes } from "crypto"

import { STORE_URL, VENDOR_URL, pesoPlan } from "./licitacion"

const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""
const API = (process.env.COTIZADOR_API_URL || `${STORE_URL}/api`).replace(/\/$/, "")

export const PRECIO_VERIFICACION_GRATIS = Number(process.env.PRECIO_VERIFICACION || 299)

const meta = (s: any) => (s?.metadata && typeof s.metadata === "object" ? s.metadata : {})

async function guardarMeta(knex: any, sellerId: string, datos: Record<string, unknown>) {
  await knex.raw(`update seller set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb, updated_at = now() where id = ?`, [
    JSON.stringify(datos),
    sellerId,
  ])
}

// ---------------------------------------------------------------------
// Pago de la verificación (sólo plan Gratis)
// ---------------------------------------------------------------------

/** ¿Este taller necesita pagar la verificación? (plan Gratis y sin pago previo) */
export function debePagarVerificacion(plan: string, s: any): boolean {
  if (meta(s).verificacion_pagada?.en) return false
  if (meta(s).requisitos_exento === true) return false
  return plan === "gratis"
}

async function mp(ruta: string, init: RequestInit = {}) {
  const res = await fetch(`${MP_API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${cuerpo?.message || cuerpo?.error || ""}`)
  return cuerpo
}

const refVerif = (sellerId: string) => `verifpago:${sellerId}:${randomBytes(4).toString("hex")}`
const leerRefVerif = (r: unknown): string | null => {
  const m = /^verifpago:([A-Za-z0-9_]{4,80}):[a-f0-9]{8}$/.exec(String(r || ""))
  return m ? m[1] : null
}

export async function ligaPagoVerificacion(seller: any): Promise<string> {
  if (!mpToken()) throw Object.assign(new Error("El pago con Mercado Pago no está disponible ahora. Intenta más tarde."), { status: 503 })
  const pagina = `${VENDOR_URL}/verificacion`
  const pref = await mp("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: "verificacion-taller",
          title: "Verificación HETNA (identidad, empresa y revisión de certificaciones)",
          quantity: 1,
          currency_id: "MXN",
          unit_price: PRECIO_VERIFICACION_GRATIS,
        },
      ],
      payer: seller.email ? { email: seller.email } : undefined,
      external_reference: refVerif(seller.id),
      notification_url: `${API}/mp-verificacion`,
      back_urls: { success: `${pagina}?pago=ok`, pending: `${pagina}?pago=ok`, failure: `${pagina}?pago=error` },
      auto_return: "approved",
      statement_descriptor: "HETNA VERIFICA",
      metadata: { tipo: "verificacion_taller", seller_id: seller.id },
    }),
  })
  const url = pref.init_point || pref.sandbox_init_point
  if (!url) throw new Error("Mercado Pago no devolvió la liga")
  return url
}

/** Revisa el pago con Mercado Pago (nunca confía en el navegador). Idempotente. */
export async function confirmarPagoVerificacion(knex: any, pagoId: string, logger?: any): Promise<{ ok: boolean; sellerId: string | null; motivo?: string }> {
  if (!/^\d{5,24}$/.test(String(pagoId)) || !mpToken()) return { ok: false, sellerId: null, motivo: "pago inválido" }
  const p = await mp(`/v1/payments/${pagoId}`)
  const sellerId = leerRefVerif(p.external_reference)
  if (!sellerId) return { ok: false, sellerId: null, motivo: "no es un pago de verificación" }
  if (p.status !== "approved") return { ok: false, sellerId, motivo: "El pago todavía no se aprueba." }
  if (Number(p.transaction_amount) < PRECIO_VERIFICACION_GRATIS || p.currency_id !== "MXN") return { ok: false, sellerId, motivo: "monto distinto" }
  const s = await knex("seller").where({ id: sellerId }).first("id", "metadata")
  if (!s) return { ok: false, sellerId: null, motivo: "taller no encontrado" }
  if (meta(s).verificacion_pagada?.pago !== `mp:${pagoId}`) {
    await guardarMeta(knex, sellerId, { verificacion_pagada: { pago: `mp:${pagoId}`, monto: Number(p.transaction_amount), en: new Date().toISOString() } })
    logger?.info?.(`[verificacion] pago recibido de ${sellerId} (mp:${pagoId})`)
  }
  return { ok: true, sellerId }
}

// ---------------------------------------------------------------------
// Certificaciones acreditadas
// ---------------------------------------------------------------------

export const T_CERT = "hetna_certificacion"

export const TIPOS_CERT: Record<string, string> = {
  iso9001: "ISO 9001 (gestión de calidad)",
  iso14001: "ISO 14001 (ambiental)",
  as9100: "AS9100 (aeroespacial)",
  iatf16949: "IATF 16949 (automotriz)",
  iso13485: "ISO 13485 (dispositivos médicos)",
  distribuidor: "Distribuidor autorizado de marca",
  soldadura: "Certificación de soldadura (AWS u otra)",
  ctpat: "C-TPAT / OEA",
  otra: "Otra certificación",
}

let listaCert = false
export async function asegurarCertificaciones(knex: any) {
  if (listaCert) return
  if (!(await knex.schema.hasTable(T_CERT))) {
    await knex.schema.createTable(T_CERT, (t: any) => {
      t.text("id").primary()
      t.text("seller_id").notNullable().index()
      t.text("tipo").notNullable()
      t.text("nombre").nullable() // para "otra" o la marca del distribuidor
      t.text("emisor").nullable() // organismo certificador o marca
      t.text("numero").nullable()
      t.date("vigencia").nullable()
      t.text("archivo_clave").nullable() // B2 privado
      t.text("archivo_nombre").nullable()
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | aprobada | rechazada
      t.text("motivo").nullable()
      t.text("revisado_por").nullable()
      t.timestamp("revisado_en", { useTz: true }).nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listaCert = true
}

export const certVigente = (c: any) => c.estado === "aprobada" && (!c.vigencia || new Date(c.vigencia).getTime() >= Date.now() - 86_400_000)

/** Copia en el perfil del taller las certificaciones aprobadas y vigentes (lo que ve el público). */
export async function sincronizarCertificacionesPerfil(knex: any, sellerId: string) {
  await asegurarCertificaciones(knex)
  const filas = await knex(T_CERT).where({ seller_id: sellerId, estado: "aprobada" }).orderBy("created_at", "asc")
  const publicas = filas.filter(certVigente).map((c: any) => ({
    tipo: c.tipo,
    nombre: c.tipo === "otra" || c.tipo === "distribuidor" ? c.nombre || TIPOS_CERT[c.tipo] : TIPOS_CERT[c.tipo] || c.tipo,
    emisor: c.emisor || null,
    vigencia: c.vigencia ? new Date(c.vigencia).toISOString().slice(0, 10) : null,
  }))
  await guardarMeta(knex, sellerId, { certificaciones: publicas })
  return publicas
}

// ---------------------------------------------------------------------
// Posicionamiento (orden), separado de la calificación
// ---------------------------------------------------------------------

/**
 * Cuánto "sube" un taller en listas y difusión. Plan + verificación +
 * empresa verificada + certificaciones vigentes. NO es su calificación y
 * nunca se muestra como tal (regla: la membresía no compra reputación).
 */
export function puntajePosicion(metadata: any): number {
  const m = (typeof metadata === "string" ? JSON.parse(metadata || "{}") : metadata) || {}
  const certs = Array.isArray(m.certificaciones) ? m.certificaciones.length : 0
  return (
    pesoPlan(m) * 3 +
    (m.verificado === true || m.verificado === "true" ? 2 : 0) +
    (m.empresa_verificada === true ? 1 : 0) +
    Math.min(certs, 3)
  )
}

export const tallerVerificado = (metadata: any) => {
  const m = metadata || {}
  return m.verificado === true || m.verificado === "true"
}

// ---------------------------------------------------------------------
// Membresía Empresarial de clientes
// ---------------------------------------------------------------------

export const BENEFICIOS_EMPRESARIAL = [
  "Licitaciones privadas (sólo talleres invitados) y restringidas (planos bajo autorización)",
  "Resumen de propuestas con inteligencia artificial",
  "Recibir propuestas sólo de talleres verificados",
  "HETNA te busca proveedor cuando nadie se postula",
]

const membresiaVigente = (m: any) => {
  const mem = m?.membresia_empresarial
  if (!mem || mem.activa !== true) return false
  return !mem.hasta || new Date(mem.hasta).getTime() > Date.now()
}

/** ¿El cliente (por id o por correo) tiene Membresía Empresarial vigente? */
export async function esMiembroEmpresarial(knex: any, cliente: { customerId?: string | null; email?: string | null }): Promise<boolean> {
  try {
    if (cliente.customerId) {
      const c = await knex("customer").where({ id: cliente.customerId }).whereNull("deleted_at").first("metadata")
      if (c && membresiaVigente(c.metadata)) return true
    }
    if (cliente.email) {
      const filas = await knex("customer")
        .whereRaw("lower(email) = ?", [String(cliente.email).trim().toLowerCase()])
        .whereNull("deleted_at")
        .select("metadata")
      if (filas.some((f: any) => membresiaVigente(f.metadata))) return true
    }
  } catch {
    /* sin membresía */
  }
  return false
}

/** HETNA activa o quita la membresía a un cliente por su correo. */
export async function cambiarMembresia(knex: any, email: string, activa: boolean, quien?: string, hasta?: string | null) {
  const filas = await knex("customer").whereRaw("lower(email) = ?", [email.trim().toLowerCase()]).whereNull("deleted_at").select("id", "metadata")
  if (!filas.length) throw Object.assign(new Error("No hay ningún cliente registrado con ese correo."), { status: 404 })
  for (const f of filas) {
    const m = f.metadata && typeof f.metadata === "object" ? f.metadata : {}
    const membresia_empresarial = activa
      ? { activa: true, desde: m.membresia_empresarial?.desde || new Date().toISOString(), hasta: hasta || null, por: quien || null }
      : { ...(m.membresia_empresarial || {}), activa: false, quitada_en: new Date().toISOString(), por: quien || null }
    await knex("customer").where({ id: f.id }).update({ metadata: JSON.stringify({ ...m, membresia_empresarial }), updated_at: knex.fn.now() })
  }
  return filas.length
}

export async function listarMiembros(knex: any) {
  const filas = await knex("customer")
    .whereNull("deleted_at")
    .whereRaw("(metadata->'membresia_empresarial'->>'activa')::boolean is true")
    .select("id", "email", "first_name", "last_name", "company_name", "metadata")
    .limit(500)
  return filas.map((f: any) => ({
    id: f.id,
    email: f.email,
    nombre: [f.first_name, f.last_name].filter(Boolean).join(" "),
    empresa: f.company_name || "",
    desde: f.metadata?.membresia_empresarial?.desde || null,
    hasta: f.metadata?.membresia_empresarial?.hasta || null,
  }))
}
