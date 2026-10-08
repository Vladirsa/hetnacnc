// Licitación HETNA: solicitudes de fabricación y propuestas de talleres.
// Tablas propias (se crean solas la primera vez). Los datos de contacto del
// cliente viven en `contacto` y NUNCA se mandan a los talleres.

export const T_SOLICITUD = "hetna_solicitud"
export const T_PROPUESTA = "hetna_propuesta"

let listo = false

export const asegurarTablas = async (knex: any) => {
  if (listo) return
  if (!(await knex.schema.hasTable(T_SOLICITUD))) {
    await knex.schema.createTable(T_SOLICITUD, (t: any) => {
      t.text("id").primary()
      t.increments("folio", { primaryKey: false })
      t.text("token").notNullable().unique()
      t.text("modo").notNullable().defaultTo("abierta") // abierta | directa
      t.text("taller_id").nullable()
      t.text("estado").notNullable().defaultTo("abierta") // abierta | elegida | cerrada
      t.jsonb("trabajo").notNullable()
      t.jsonb("contacto").notNullable()
      t.text("propuesta_elegida").nullable()
      t.timestamp("cierra_en", { useTz: true }).nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.index(["estado", "modo"])
    })
  }
  if (!(await knex.schema.hasTable(T_PROPUESTA))) {
    await knex.schema.createTable(T_PROPUESTA, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().index()
      t.text("seller_id").notNullable()
      t.decimal("precio", 12, 2).notNullable()
      t.integer("dias").notNullable()
      t.integer("vigencia_dias").notNullable().defaultTo(15)
      t.text("incluye_envio").notNullable().defaultTo("no") // si | no
      t.text("condiciones").nullable()
      t.text("estado").notNullable().defaultTo("enviada") // enviada | elegida | descartada
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.unique(["solicitud_id", "seller_id"])
    })
  }
  listo = true
}

export const nuevoId = (prefijo: string) =>
  `${prefijo}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`

export const nuevoToken = () =>
  globalThis.crypto.randomUUID().replace(/-/g, "") + globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)

export const folioTexto = (n: number | string) => `HET-${String(n).padStart(5, "0")}`

export const STORE_URL = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
export const VENDOR_URL = (process.env.VENDOR_PANEL_URL || "https://hetnacnc.com/seller").replace(/\/$/, "")
export const ligaPropuestas = (token: string) => `${STORE_URL}/mx/cotizar/propuestas/${token}`

// Plan del taller (para ordenar propuestas: los talleres con membresía salen primero).
const PESO_PLAN: Record<string, number> = { industrial: 3, pro: 2, taller: 1 }
export const pesoPlan = (metadata: unknown): number => {
  const m = (typeof metadata === "string" ? safeJson(metadata) : metadata) as Record<string, unknown> | null
  const plan = String((m as any)?.plan || (m as any)?.perfil?.plan || "").toLowerCase()
  return PESO_PLAN[plan] ?? 0
}
const safeJson = (s: string) => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

// Correos ------------------------------------------------------------------
const SITIO = process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"

export const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

export const fila = (k: string, v: string) =>
  v
    ? `<tr><td style="padding:6px 12px 6px 0;color:#6B675C;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#142033"><strong>${esc(v)}</strong></td></tr>`
    : ""

export const boton = (texto: string, url: string) =>
  `<p style="margin:20px 0 0"><a href="${esc(url)}" style="display:inline-block;background:#C2560A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">${esc(texto)}</a></p>`

export const marco = (titulo: string, cuerpo: string) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #E7E4DC;border-radius:12px;overflow:hidden">
  <div style="background:#142033;color:#fff;padding:18px 22px;font-size:18px;font-weight:bold">${esc(SITIO)}</div>
  <div style="padding:22px">
    <h2 style="margin:0 0 12px;color:#142033;font-size:18px">${esc(titulo)}</h2>
    ${cuerpo}
  </div>
</div>`

export type Trabajo = {
  descripcion: string
  servicio?: string
  material?: string
  cantidad?: string
  medidas?: string
  fecha?: string
  ciudad?: string
  estado_mx?: string
  frecuencia?: string
  presupuesto?: string
  acepta_envio?: string
  archivo?: string
}

export const tablaTrabajo = (t: Trabajo, conArchivo = true) =>
  `<table style="border-collapse:collapse;font-size:14px">` +
  fila("Servicio", t.servicio || "") +
  fila("Material", t.material || "") +
  fila("Cantidad", t.cantidad || "") +
  fila("Medidas", t.medidas || "") +
  fila("Fecha requerida", t.fecha || "") +
  fila("Entrega en", [t.ciudad, t.estado_mx].filter(Boolean).join(", ")) +
  fila("Frecuencia", t.frecuencia || "") +
  fila("Presupuesto aproximado", t.presupuesto || "") +
  fila("Acepta envío por paquetería", t.acepta_envio || "") +
  (conArchivo ? fila("Archivos", t.archivo || "") : "") +
  `</table><p style="margin:14px 0 0;white-space:pre-line;color:#40403A">${esc(t.descripcion)}</p>`

// Quita teléfonos, correos y ligas de un texto que verá la otra parte.
export const ocultarContacto = (s: string) =>
  s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contacto oculto]")
    .replace(/(?:\+?\d[\s.-]?){8,}/g, "[contacto oculto]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[liga oculta]")
    .replace(/\b(wa\.me|whats\s?app|watsap|telegram|facebook\.com|instagram)\S*/gi, "[contacto oculto]")
