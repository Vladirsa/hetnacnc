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
      t.text("estado").notNullable().defaultTo("abierta") // abierta | elegida | pagada | cerrada
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
  // Columnas de pago (se agregan solas si faltan)
  // aviso_cierre: cuándo se le avisó al cliente (o a HETNA) que la solicitud
  // cerró a propuestas nuevas. Evita mandar el aviso dos veces.
  for (const [col, tipo] of [["pago_url", "text"], ["pago_estado", "text"], ["pago_id", "text"], ["pago_monto", "decimal"], ["aviso_cierre", "fecha"]] as const) {
    if (!(await knex.schema.hasColumn(T_SOLICITUD, col))) {
      await knex.schema.alterTable(T_SOLICITUD, (t: any) =>
        tipo === "decimal"
          ? t.decimal(col, 12, 2).nullable()
          : tipo === "fecha"
            ? t.timestamp(col, { useTz: true }).nullable()
            : t.text(col).nullable()
      )
    }
  }
  listo = true
}

// Mercado Pago ---------------------------------------------------------------
// Usa la misma llave que el checkout de la tienda (MERCADOPAGO_ACCESS_TOKEN).
const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""

export const mpDisponible = () => Boolean(mpToken())

export const crearPreferenciaPago = async (p: {
  solicitudId: string
  folio: string
  titulo: string
  monto: number
  email?: string
  retorno: string
}): Promise<{ id: string; url: string } | null> => {
  if (!mpDisponible()) return null
  // nginx manda /api/* a la API: el aviso llega a src/api/api/mp-licitacion
  const webhook = process.env.MP_WEBHOOK_URL || `${STORE_URL}/api/mp-licitacion`
  const r = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `lic-${p.solicitudId}`,
    },
    body: JSON.stringify({
      items: [{ id: p.folio, title: p.titulo.slice(0, 250), quantity: 1, unit_price: Math.round(p.monto * 100) / 100, currency_id: "MXN" }],
      payer: p.email ? { email: p.email } : undefined,
      external_reference: `licitacion:${p.solicitudId}`,
      back_urls: { success: p.retorno, failure: p.retorno, pending: p.retorno },
      auto_return: "approved",
      statement_descriptor: "HETNA CNC",
      ...(webhook ? { notification_url: webhook } : {}),
    }),
  })
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = (await r.json()) as { id: string; init_point: string; sandbox_init_point?: string }
  const prueba = mpToken().startsWith("TEST-")
  return { id: d.id, url: (prueba && d.sandbox_init_point) || d.init_point }
}

export const consultarPago = async (pagoId: string) => {
  const r = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(pagoId)}`, {
    headers: { Authorization: `Bearer ${mpToken()}` },
  })
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}`)
  return (await r.json()) as { id: number; status: string; external_reference?: string; transaction_amount?: number; currency_id?: string }
}

export const nuevoId = (prefijo: string) =>
  `${prefijo}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`

export const nuevoToken = () =>
  globalThis.crypto.randomUUID().replace(/-/g, "") + globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)

export const folioTexto = (n: number | string) => `HET-${String(n).padStart(5, "0")}`

export const STORE_URL = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
export const VENDOR_URL = (process.env.VENDOR_PANEL_URL || "https://hetnacnc.com/seller").replace(/\/$/, "")
export const ligaPropuestas = (token: string) => `${STORE_URL}/mx/cotizar/propuestas/${token}`
// Página pública del trabajo (sin datos del cliente): /mx/trabajos/HET-00012
export const ligaTrabajo = (folio: number | string) => `${STORE_URL}/mx/trabajos/${folioTexto(folio)}`

// "HET-00012", "het-12" o "12" -> 12. null si no es un folio.
export const numeroDeFolio = (texto: string): number | null => {
  const m = String(texto || "").trim().match(/^(?:het-?)?0*(\d{1,9})$/i)
  return m ? Number(m[1]) : null
}

// Una solicitud recibe propuestas nuevas mientras está abierta y no pasa su
// fecha de cierre. Pasada la fecha ya no entran propuestas, pero el cliente
// puede seguir eligiendo entre las que le llegaron: por eso el cierre no
// cambia el estado a "cerrada" cuando ya hay propuestas.
export const recibePropuestas = (s: { estado: string; cierra_en?: Date | string | null }) =>
  s.estado === "abierta" && (!s.cierra_en || new Date(s.cierra_en).getTime() > Date.now())

// Lo que se puede enseñar en público de una solicitud abierta: el trabajo, sin
// nombre, correo, teléfono, archivo ni presupuesto. El presupuesto se queda
// entre el cliente y los talleres: publicarlo le pone piso a todas las
// propuestas.
export const trabajoPublico = (s: {
  folio: number
  estado: string
  trabajo: Trabajo
  cierra_en?: Date | string | null
  created_at: Date | string
  propuestas?: number
}) => {
  const t = s.trabajo || ({} as Trabajo)
  return {
    folio: folioTexto(s.folio),
    estado: recibePropuestas(s) ? "abierta" : s.estado === "elegida" || s.estado === "pagada" ? "asignada" : "cerrada",
    necesidad: t.necesidad || "",
    tiene_archivo: t.tiene_archivo || "",
    acabado: t.acabado || "",
    // Sólo cuántos: los archivos los ve el taller registrado, desde su panel.
    archivos: (t.archivos || []).length,
    servicio: t.servicio || "",
    material: t.material || "",
    cantidad: t.cantidad || "",
    medidas: t.medidas || "",
    fecha: t.fecha || "",
    frecuencia: t.frecuencia || "",
    ciudad: t.ciudad || "",
    estado_mx: t.estado_mx || "",
    acepta_envio: t.acepta_envio || "",
    descripcion: ocultarContacto(t.descripcion || "").slice(0, 1200),
    creada: s.created_at,
    cierra_en: s.cierra_en ?? null,
    propuestas: s.propuestas ?? 0,
  }
}

// Plan del taller (para ordenar propuestas: los talleres con membresía salen primero).
const PESO_PLAN: Record<string, number> = { industrial: 3, pro: 2, taller: 1 }
export const pesoPlan = (metadata: unknown): number => {
  const m = (typeof metadata === "string" ? safeJson(metadata) : metadata) as Record<string, unknown> | null
  const plan = String((m as any)?.plan || (m as any)?.perfil?.plan || "").toLowerCase()
  const vence = (m as any)?.plan_vence ? Date.parse(String((m as any).plan_vence)) : NaN
  if (!Number.isNaN(vence) && vence < Date.now()) return 0
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

export type ArchivoSolicitud = { clave: string; nombre: string; tamano: number }

export type Trabajo = {
  descripcion: string
  // Lo que el cliente quiere lograr (cortar piezas, pieza terminada...), en
  // sus palabras; el servicio es el proceso, si lo sabe.
  necesidad?: string
  // "Tengo archivo profesional" / "Tengo boceto o foto" / "Tengo idea o
  // referencia" / "No tengo archivo, necesito diseño"
  tiene_archivo?: string
  acabado?: string
  // Archivos subidos al bucket privado de B2. Nunca son públicos: el taller
  // pide una liga firmada desde su panel.
  archivos?: ArchivoSolicitud[]
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
  fila("Necesita", t.necesidad || "") +
  fila("Servicio", t.servicio || "") +
  fila("Archivo", t.tiene_archivo || "") +
  fila("Material", t.material || "") +
  fila("Cantidad", t.cantidad || "") +
  fila("Medidas", t.medidas || "") +
  fila("Acabado", t.acabado || "") +
  fila("Fecha requerida", t.fecha || "") +
  fila("Entrega en", [t.ciudad, t.estado_mx].filter(Boolean).join(", ")) +
  fila("Frecuencia", t.frecuencia || "") +
  fila("Presupuesto aproximado", t.presupuesto || "") +
  fila("Acepta envío por paquetería", t.acepta_envio || "") +
  (conArchivo ? fila("Liga a archivos", t.archivo || "") : "") +
  fila(
    "Archivos subidos",
    (t.archivos || []).length ? (t.archivos || []).map((a) => a.nombre).join(", ") : ""
  ) +
  `</table><p style="margin:14px 0 0;white-space:pre-line;color:#40403A">${esc(t.descripcion)}</p>`

// Quita teléfonos, correos y ligas de un texto que verá la otra parte.
export const ocultarContacto = (s: string) =>
  s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contacto oculto]")
    // Termina en dígito para no comerse el espacio que sigue al número.
    .replace(/\+?\d(?:[\s.-]?\d){7,}/g, "[contacto oculto]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[liga oculta]")
    .replace(/\b(wa\.me|whats\s?app|watsap|telegram|facebook\.com|instagram)\S*/gi, "[contacto oculto]")

// Extensiones que se aceptan al subir archivos de una solicitud: planos,
// modelos, vectores, fotos de referencia y comprimidos. Lo demás se rechaza
// para que el bucket no sirva para guardar cualquier cosa.
export const EXT_ARCHIVO_SOLICITUD = [
  "dxf", "dwg", "svg", "ai", "eps", "pdf", "cdr",
  "stl", "step", "stp", "iges", "igs", "3mf", "obj", "f3d", "skp",
  "png", "jpg", "jpeg", "webp", "heic",
  "zip", "rar", "7z",
]
export const MAX_MB_ARCHIVO_SOLICITUD = 25
export const MAX_ARCHIVOS_SOLICITUD = 5

// Una clave válida es una que generó esta API al subir: así un cliente no
// puede colgarle a su solicitud un archivo ajeno del bucket.
export const esClaveDeTaller = (clave: unknown) =>
  typeof clave === "string" && /^talleres\/\d{4}-\d{2}\/[a-f0-9]{24}\/[^/]{1,120}$/.test(clave)

export const esClaveDeSolicitud = (clave: unknown) =>
  typeof clave === "string" && /^solicitudes\/\d{4}-\d{2}\/[a-f0-9]{24}\/[^/]{1,120}$/.test(clave)

// Motivos con los que un taller dice que no a una solicitud. "mas_info"
// no es un no: le pide a HETNA que aclare con el cliente.
export const MOTIVOS_RESPUESTA: Record<string, string> = {
  sin_capacidad: "No tengo capacidad ahora",
  no_material: "No trabajo ese material",
  no_servicio: "No hago ese proceso",
  mas_info: "Necesito más información",
}
export const T_RESPUESTA = "hetna_respuesta_taller"

export const asegurarTablaRespuestas = async (knex: any) => {
  if (await knex.schema.hasTable(T_RESPUESTA)) return
  await knex.schema.createTable(T_RESPUESTA, (t: any) => {
    t.text("id").primary()
    t.text("solicitud_id").notNullable().index()
    t.text("seller_id").notNullable()
    t.text("motivo").notNullable()
    t.text("nota").nullable()
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(["solicitud_id", "seller_id"])
  })
}
