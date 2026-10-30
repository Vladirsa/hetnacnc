// Facturas (CFDI) de los pedidos de la tienda.
//
// En HETNA cada taller vende por su cuenta y emite el CFDI de sus ventas
// (Términos para vendedores, cláusula 9). HETNA no timbra: junta los datos
// fiscales del cliente, le pasa la solicitud al taller del pedido y guarda el
// PDF y el XML que el taller sube, para que el cliente los descargue desde su
// cuenta. Los archivos van al bucket privado (carpeta facturas/).
//
// Datos fiscales del cliente: customer.metadata.fiscal (los guarda él mismo en
// Mi cuenta > Datos y contraseña). Catálogos del SAT para CFDI 4.0.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, VENDOR_URL, boton, esc, fila, marco, nuevoId } from "./licitacion"
import { sendEmail } from "./resend"

export const T_FACTURA = "hetna_factura"

// Régimen fiscal del receptor (c_RegimenFiscal): los más comunes
export const REGIMENES: Record<string, string> = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios",
  "606": "Arrendamiento",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "616": "Sin obligaciones fiscales",
  "621": "Incorporación Fiscal",
  "625": "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
  "626": "Régimen Simplificado de Confianza (RESICO)",
}
// Uso del CFDI (c_UsoCFDI): los que aplican a compras de un taller CNC
export const USOS_CFDI: Record<string, string> = {
  G01: "Adquisición de mercancías",
  G03: "Gastos en general",
  I04: "Equipo de cómputo y accesorios",
  I08: "Otra maquinaria y equipo",
  S01: "Sin efectos fiscales",
}

export type DatosFiscales = {
  rfc: string
  razon_social: string
  regimen: string
  cp: string
  uso_cfdi: string
  correo: string
}

// Valida y normaliza. Devuelve el texto del error si algo no cuadra.
export function validarFiscal(v: any): DatosFiscales | string {
  const t = (x: unknown, max: number) => String(x ?? "").trim().replace(/\s+/g, " ").slice(0, max)
  const f: DatosFiscales = {
    rfc: t(v?.rfc, 13).toUpperCase(),
    razon_social: t(v?.razon_social, 254).toUpperCase(),
    regimen: t(v?.regimen, 3),
    cp: t(v?.cp, 5),
    uso_cfdi: t(v?.uso_cfdi, 4).toUpperCase(),
    correo: t(v?.correo, 120).toLowerCase(),
  }
  if (!/^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/.test(f.rfc)) return "Revisa el RFC: 12 caracteres (empresa) o 13 (persona física), sin espacios ni guiones."
  if (f.razon_social.length < 3) return "Escribe tu nombre o razón social tal como aparece en tu constancia de situación fiscal."
  if (/\b(S\.?A\.?|S\. ?DE ?R\.?L\.?)\s+DE\s+C\.?V\.?$/i.test(f.razon_social))
    return "Escribe la razón social sin el régimen de capital (sin “SA de CV”), como pide el CFDI 4.0."
  if (!(f.regimen in REGIMENES)) return "Elige tu régimen fiscal."
  if (!/^\d{5}$/.test(f.cp)) return "El código postal fiscal debe tener 5 dígitos."
  if (!(f.uso_cfdi in USOS_CFDI)) return "Elige el uso del CFDI."
  if (f.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo)) return "Revisa el correo para recibir la factura."
  // RFC de 12 = persona moral, de 13 = persona física. RESICO (626) aplica a las dos.
  const moral = f.rfc.length === 12
  if (moral && ["605", "606", "612", "616", "621", "625"].includes(f.regimen))
    return "Ese régimen es de persona física y tu RFC es de persona moral."
  if (!moral && ["601", "603"].includes(f.regimen)) return "Ese régimen es de persona moral y tu RFC es de persona física."
  return f
}

let lista = false
export async function asegurarTablaFacturas(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_FACTURA))) {
    await knex.schema.createTable(T_FACTURA, (t: any) => {
      t.text("id").primary()
      t.text("order_id").notNullable().unique()
      t.integer("display_id")
      t.text("seller_id").notNullable().index()
      t.text("customer_id").notNullable().index()
      t.jsonb("fiscal").notNullable()
      t.decimal("total", 12, 2)
      t.text("estado").notNullable().defaultTo("solicitada") // solicitada | emitida | rechazada
      t.text("pdf_clave")
      t.text("xml_clave")
      t.text("nota")
      t.timestamp("emitida_at", { useTz: true })
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export type Factura = {
  id: string
  order_id: string
  display_id: number | null
  seller_id: string
  customer_id: string
  fiscal: DatosFiscales
  total: string | number | null
  estado: "solicitada" | "emitida" | "rechazada"
  pdf_clave: string | null
  xml_clave: string | null
  nota: string | null
  emitida_at: Date | null
  created_at: Date
}

export const facturaPublica = (f: Factura) => ({
  id: f.id,
  order_id: f.order_id,
  display_id: f.display_id,
  estado: f.estado,
  nota: f.nota,
  tiene_pdf: Boolean(f.pdf_clave),
  tiene_xml: Boolean(f.xml_clave),
  emitida_at: f.emitida_at,
  created_at: f.created_at,
})

// ── Solicitar ─────────────────────────────────────────────────────────────────────────
export class ErrorFactura extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje)
  }
}

const leer = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v)

export async function solicitarFactura(c: MedusaContainer, customerId: string, orderId: string, logger: any) {
  const knex = c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  await asegurarTablaFacturas(knex)

  const cliente = await knex("customer").where({ id: customerId }).first("email", "first_name", "last_name", "metadata")
  const fiscal = validarFiscal(leer(cliente?.metadata)?.fiscal)
  if (typeof fiscal === "string") throw new ErrorFactura("Primero guarda tus datos fiscales en Mi cuenta > Datos y contraseña.", 409)

  const {
    data: [p],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "customer_id", "status", "total", "created_at", "payment_collections.status"],
    filters: { id: orderId },
  })
  const pedido = p as any
  if (!pedido || pedido.customer_id !== customerId) throw new ErrorFactura("No encontramos ese pedido en tu cuenta.", 404)
  if (pedido.status === "canceled") throw new ErrorFactura("El pedido está cancelado.")
  const pagado = (pedido.payment_collections || []).some((pc: any) => ["completed", "authorized", "partially_captured"].includes(pc?.status))
  if (!pagado) throw new ErrorFactura("Puedes pedir la factura cuando el pedido esté pagado.")

  const { data: ligas } = await query.graph({ entity: "order_seller", fields: ["seller_id"], filters: { order_id: orderId } })
  const sellerId = (ligas as { seller_id: string }[])[0]?.seller_id
  if (!sellerId) throw new ErrorFactura("Este pedido no tiene taller asignado. Escríbenos y lo resolvemos.", 409)

  const previa = await knex(T_FACTURA).where({ order_id: orderId }).first()
  if (previa && previa.estado !== "rechazada") throw new ErrorFactura("Ya pediste la factura de este pedido.", 409)
  const datos = {
    display_id: pedido.display_id,
    seller_id: sellerId,
    customer_id: customerId,
    fiscal: JSON.stringify(fiscal),
    total: pedido.total,
    estado: "solicitada",
    nota: null,
    updated_at: knex.fn.now(),
  }
  if (previa) await knex(T_FACTURA).where({ id: previa.id }).update(datos)
  else await knex(T_FACTURA).insert({ id: nuevoId("fac"), order_id: orderId, ...datos })

  // Aviso al taller con todo lo que necesita para timbrar
  const taller = await knex("seller").where({ id: sellerId }).first("email", "name")
  if (taller?.email) {
    const tabla =
      `<table style="border-collapse:collapse;font-size:14px">` +
      fila("Pedido", `#${pedido.display_id}`) +
      fila("Total", `$${Number(pedido.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`) +
      fila("RFC", fiscal.rfc) +
      fila("Razón social", fiscal.razon_social) +
      fila("Régimen fiscal", `${fiscal.regimen} · ${REGIMENES[fiscal.regimen]}`) +
      fila("Código postal fiscal", fiscal.cp) +
      fila("Uso del CFDI", `${fiscal.uso_cfdi} · ${USOS_CFDI[fiscal.uso_cfdi]}`) +
      `</table>`
    const r = await sendEmail({
      to: taller.email,
      subject: `Solicitud de factura · pedido #${pedido.display_id}`,
      html: marco(
        "Un cliente pidió factura",
        `<p style="margin:0 0 12px;color:#40403A">Emite el CFDI de este pedido con tu sistema de facturación y sube el PDF y el XML en tu panel, en <b>Facturas</b>. El cliente los descarga desde su cuenta.</p>` +
          tabla +
          boton("Subir la factura", `${VENDOR_URL}/facturas`)
      ),
    })
    if (!r.sent) logger.warn(`[facturas] aviso al taller del pedido #${pedido.display_id} no enviado: ${r.reason}`)
  }
}

// Aviso al cliente cuando el taller sube su factura (o la rechaza)
export async function avisarCliente(knex: any, f: Factura) {
  const cliente = await knex("customer").where({ id: f.customer_id }).first("email", "first_name")
  const para = f.fiscal?.correo || cliente?.email
  if (!para) return
  const emitida = f.estado === "emitida"
  await sendEmail({
    to: para,
    subject: emitida ? `Tu factura del pedido #${f.display_id} está lista` : `Sobre tu factura del pedido #${f.display_id}`,
    html: marco(
      emitida ? "Tu factura está lista" : "El taller no pudo emitir tu factura",
      `<p style="margin:0 0 12px;color:#40403A">Hola ${esc(cliente?.first_name || "")}: ` +
        (emitida
          ? `el taller ya subió el PDF y el XML de la factura de tu pedido #${f.display_id}. Descárgalos desde tu cuenta.</p>`
          : `el taller no pudo emitir la factura de tu pedido #${f.display_id}.${f.nota ? ` Motivo: ${esc(f.nota)}.` : ""} Revisa tus datos fiscales y vuelve a pedirla.</p>`) +
        boton(emitida ? "Ver mis pedidos" : "Revisar mis datos", `${STORE_URL}/mx/user/${emitida ? "orders" : "settings"}`)
    ),
  })
}
