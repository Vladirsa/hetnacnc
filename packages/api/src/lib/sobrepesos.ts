// Sobrepesos: lo que la paquetería cobra de más cuando el paquete pesó o midió
// más de lo cotizado. Skydropx se lo descuenta a HETNA de su saldo; aquí se
// registra y se le cobra a quien lo causó:
//   - "envio": un envío de Envíos HETNA -> el cliente que lo solicitó.
//   - "guia": la guía de un pedido de la tienda -> el taller que la generó.
//
// HETNA lo registra desde el panel (Envíos > Sobrepesos) con lo que reportó
// la paquetería. Puede cobrarlo de inmediato (liga de Mercado Pago por correo)
// o disputarlo primero con la evidencia del paquete. Mientras haya uno "por
// cobrar", esa persona o taller no puede generar nuevas guías.
import { STORE_URL, boton, esc, fila, marco, nuevoId } from "./licitacion"
import { sendEmail } from "./resend"

export const T_SOBREPESO = "hetna_sobrepeso"

export const ESTADOS_SOBREPESO = {
  por_cobrar: "Por cobrar",
  en_disputa: "En disputa con la paquetería",
  pagado: "Pagado",
  descontado: "Descontado de pagos al taller",
  anulado: "Anulado (disputa ganada)",
} as const
export type EstadoSobrepeso = keyof typeof ESTADOS_SOBREPESO

export const folioSobrepeso = (n: number | string) => `SOB-${String(n).padStart(5, "0")}`

let lista = false
export async function asegurarTablaSobrepesos(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_SOBREPESO))) {
    await knex.schema.createTable(T_SOBREPESO, (t: any) => {
      t.text("id").primary()
      t.increments("folio", { primaryKey: false })
      t.text("tipo").notNullable() // envio | guia
      t.text("ref").notNullable().index() // id del envío o del pedido
      t.text("referencia").notNullable() // "ENV-00012" o "Pedido #123"
      t.text("responsable_tipo").notNullable() // cliente | taller
      t.text("responsable_id").notNullable().index()
      t.text("responsable_email")
      t.text("responsable_nombre")
      t.decimal("kg_cotizado", 10, 2)
      t.decimal("kg_reportado", 10, 2)
      t.decimal("monto", 12, 2).notNullable()
      t.text("nota")
      t.text("estado").notNullable().defaultTo("por_cobrar").index()
      t.boolean("evidencia_completa").notNullable().defaultTo(false)
      t.text("pago_url")
      t.text("pago_id")
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export type Sobrepeso = {
  id: string
  folio: number
  tipo: "envio" | "guia"
  ref: string
  referencia: string
  responsable_tipo: "cliente" | "taller"
  responsable_id: string
  responsable_email: string | null
  responsable_nombre: string | null
  kg_cotizado: string | number | null
  kg_reportado: string | number | null
  monto: string | number
  nota: string | null
  estado: EstadoSobrepeso
  evidencia_completa: boolean
  pago_url: string | null
  pago_id: string | null
  created_at: Date
  updated_at: Date
}

export const sobrepesoPublico = (s: Sobrepeso) => ({
  folio: folioSobrepeso(s.folio),
  tipo: s.tipo,
  referencia: s.referencia,
  kg_cotizado: s.kg_cotizado != null ? Number(s.kg_cotizado) : null,
  kg_reportado: s.kg_reportado != null ? Number(s.kg_reportado) : null,
  monto: Number(s.monto),
  estado: s.estado,
  estado_nombre: ESTADOS_SOBREPESO[s.estado] || s.estado,
  pago_url: s.estado === "por_cobrar" ? s.pago_url : null,
  created_at: s.created_at,
})

// Los que impiden generar nuevas guías
export async function sobrepesosPendientes(knex: any, responsableTipo: "cliente" | "taller", responsableId: string): Promise<Sobrepeso[]> {
  await asegurarTablaSobrepesos(knex)
  return knex(T_SOBREPESO).where({ responsable_tipo: responsableTipo, responsable_id: responsableId, estado: "por_cobrar" })
}

export async function sobrepesosDe(knex: any, responsableTipo: "cliente" | "taller", responsableId: string): Promise<Sobrepeso[]> {
  await asegurarTablaSobrepesos(knex)
  return knex(T_SOBREPESO).where({ responsable_tipo: responsableTipo, responsable_id: responsableId }).orderBy("created_at", "desc").limit(50)
}

// ── Cobro con Mercado Pago ────────────────────────────────────────────────────────────
const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""

export async function crearPagoSobrepeso(s: Sobrepeso): Promise<string | null> {
  if (!mpToken()) return null
  const folio = folioSobrepeso(s.folio)
  const r = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", "X-Idempotency-Key": `sob-${s.id}` },
    body: JSON.stringify({
      items: [
        {
          id: folio,
          title: `${folio} · Sobrepeso de ${s.referencia} · HETNA CNC`.slice(0, 250),
          quantity: 1,
          unit_price: Math.round(Number(s.monto) * 100) / 100,
          currency_id: "MXN",
        },
      ],
      payer: s.responsable_email ? { email: s.responsable_email } : undefined,
      external_reference: `sobrepeso:${s.id}`,
      back_urls: {
        success: `${STORE_URL}/mx/user/envios`,
        failure: `${STORE_URL}/mx/user/envios`,
        pending: `${STORE_URL}/mx/user/envios`,
      },
      auto_return: "approved",
      statement_descriptor: "HETNA CNC",
      notification_url: process.env.MP_WEBHOOK_ENVIO_URL || `${STORE_URL}/api/mp-envio`,
    }),
  })
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = (await r.json()) as { init_point: string; sandbox_init_point?: string }
  return (mpToken().startsWith("TEST-") && d.sandbox_init_point) || d.init_point
}

// ── Correo al responsable ─────────────────────────────────────────────────────────────
const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`

export async function avisarSobrepeso(s: Sobrepeso) {
  if (!s.responsable_email) return { sent: false, reason: "sin correo" }
  const folio = folioSobrepeso(s.folio)
  const taller = s.responsable_tipo === "taller"
  const detalle =
    `<table style="border-collapse:collapse;font-size:14px">` +
    fila("Folio", folio) +
    fila(taller ? "Pedido" : "Envío", s.referencia) +
    (s.kg_cotizado != null ? fila("Cotizado", `${Number(s.kg_cotizado)} kg`) : "") +
    (s.kg_reportado != null ? fila("Reportado por la paquetería", `${Number(s.kg_reportado)} kg`) : "") +
    fila("Cobro de la paquetería", pesos(Number(s.monto))) +
    (s.nota ? fila("Nota", s.nota) : "") +
    `</table>`
  const cuerpo =
    `<p style="margin:0 0 12px;color:#40403A">Hola ${esc(s.responsable_nombre || "")}: la paquetería volvió a pesar y medir el paquete y reportó más de lo cotizado. ` +
    `Skydropx ya nos cobró la diferencia y, como dicen las condiciones que aceptaste, la paga quien envía.</p>` +
    detalle +
    (s.pago_url ? boton("Pagar el sobrepeso", s.pago_url) : "") +
    `<p style="margin:16px 0 0;color:#40403A">` +
    (taller
      ? "Si no se paga, lo descontamos de tu siguiente pago de ventas. Mientras esté pendiente no podrás generar nuevas guías desde tu panel."
      : "Mientras esté pendiente no podrás solicitar nuevos envíos.") +
    ` Si tienes evidencia (fotos de las medidas y de la báscula con la guía visible, tomadas antes de entregar el paquete) y crees que el cobro es injusto, responde a este correo con tu folio y lo disputamos con la paquetería.</p>` +
    `<p style="margin:12px 0 0;font-size:13px;color:#6B675C">Condiciones: <a href="${STORE_URL}/mx/servicios/envios-hetna/condiciones" style="color:#C2560A">Envíos HETNA</a></p>`
  return sendEmail({ to: s.responsable_email, subject: `[${folio}] Sobrepeso de ${s.referencia}: ${pesos(Number(s.monto))}`, html: marco("Cobro por sobrepeso", cuerpo) })
}

// Cobrar: crea la liga de pago (si no la tiene), deja el sobrepeso "por cobrar" y avisa
export async function cobrarSobrepeso(knex: any, s: Sobrepeso, logger: any) {
  let pagoUrl = s.pago_url
  if (!pagoUrl) {
    try {
      pagoUrl = await crearPagoSobrepeso(s)
    } catch (e) {
      logger.error(`[sobrepesos] ${folioSobrepeso(s.folio)} sin liga de pago: ${(e as Error).message}`)
    }
  }
  await knex(T_SOBREPESO).where({ id: s.id }).update({ estado: "por_cobrar", pago_url: pagoUrl, updated_at: knex.fn.now() })
  const r = await avisarSobrepeso({ ...s, estado: "por_cobrar", pago_url: pagoUrl })
  if (!r.sent) logger.warn(`[sobrepesos] ${folioSobrepeso(s.folio)} correo no enviado: ${r.reason}`)
  return { pago_url: pagoUrl, correo: r.sent }
}

export const nuevoSobrepesoId = () => nuevoId("sob")
