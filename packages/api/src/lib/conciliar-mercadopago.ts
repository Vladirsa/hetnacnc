// Revisión de cobros de Mercado Pago sin pedido (cada 10 minutos, jobs/conciliar-mercadopago.ts).
//
// Con Checkout Pro, Mercado Pago cobra ANTES de que exista el pedido: el pedido
// se crea cuando el navegador del cliente regresa a la tienda. Si cierra la
// pestaña, la app de MP lo regresa a otro navegador o algo falla al completar,
// el cliente queda cobrado y sin pedido.
//
// Esta revisión busca los pagos aprobados de los últimos días cuya referencia es
// de un carrito (hetna_<cart_id>_<hora>, modules/mercadopago/service.ts) y:
//   - si el carrito ya tiene pedido, no hace nada;
//   - si no, completa el carrito con el mismo flujo de Mercur que usa la tienda
//     (completeCartWithSplitOrdersWorkflow: un pedido por taller);
//   - si no se puede, avisa por correo a la casa UNA vez. No reembolsa sola:
//     un reembolso no se deshace, lo decide el dueño.
// Los pagos de menos de 10 minutos se dejan: el regreso del navegador gana.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWithSplitOrdersWorkflow } from "@mercurjs/core/workflows"

import { correosDeLaCasa } from "./cuentas-casa"
import { esCuponHetna, motivoCupon } from "./cupones"
import { STORE_URL, esc, fila, marco } from "./licitacion"
import { sendEmail } from "./resend"

const API = "https://api.mercadopago.com"
const DIAS = 3
const ESPERA_MIN = 10
const MAX_PAGINAS = 5

type PagoMP = {
  id: number | string
  status?: string
  external_reference?: string | null
  date_approved?: string | null
  transaction_amount?: number
}

/** "hetna_cart_01ABC_1712345678901" → "cart_01ABC" (null si no es de un carrito). */
export function carritoDeReferencia(ref: string | null | undefined): string | null {
  const m = /^hetna_(cart_[A-Za-z0-9]+)_\d+$/.exec(String(ref || ""))
  return m ? m[1] : null
}

/** ¿Ya toca revisarlo? Aprobado y con más de ESPERA_MIN minutos. */
export function listoParaRevisar(pago: PagoMP, ahora = Date.now()): boolean {
  if (pago.status !== "approved" || !pago.date_approved) return false
  const t = new Date(pago.date_approved).getTime()
  return Number.isFinite(t) && t <= ahora - ESPERA_MIN * 60_000
}

async function pagosAprobados(token: string): Promise<PagoMP[]> {
  const pagos: PagoMP[] = []
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const q = new URLSearchParams({
      status: "approved",
      sort: "date_created",
      criteria: "desc",
      range: "date_created",
      begin_date: `NOW-${DIAS}DAYS`,
      end_date: "NOW",
      limit: "100",
      offset: String(pagina * 100),
    })
    const r = await fetch(`${API}/v1/payments/search?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}`)
    const d = (await r.json()) as { results?: PagoMP[] }
    const lote = d.results || []
    pagos.push(...lote)
    if (lote.length < 100) break
  }
  return pagos
}

async function avisar(asunto: string, filas: [string, string][], texto: string) {
  const para = String(process.env.CONTROL_AVISOS_PARA || correosDeLaCasa()[0] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const html = marco(
    asunto,
    `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${esc(texto)}</p>` +
      `<table style="border-collapse:collapse;font-size:14px">${filas.map(([a, b]) => fila(a, b)).join("")}</table>`
  )
  for (const to of para) await sendEmail({ to, subject: asunto, html }).catch(() => undefined)
}

export async function conciliarMercadoPago(
  container: MedusaContainer
): Promise<{ revisados: number; completados: number; avisos: number }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || ""
  const salida = { revisados: 0, completados: 0, avisos: 0 }
  if (!token) return salida
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  for (const pago of await pagosAprobados(token)) {
    const cartId = carritoDeReferencia(pago.external_reference)
    if (!cartId || !listoParaRevisar(pago)) continue
    salida.revisados++
    const {
      rows: [cart],
    } = await knex.raw(`select id, email, metadata from cart where id = ?`, [cartId])
    if (!cart) continue
    const meta = (cart.metadata || {}) as Record<string, unknown>
    if (meta.mp_conciliacion_aviso === String(pago.id)) continue
    const filas: [string, string][] = [
      ["Pago de Mercado Pago", String(pago.id)],
      ["Monto", `$${Number(pago.transaction_amount || 0).toFixed(2)}`],
      ["Carrito", cartId],
      ["Cliente", cart.email || "—"],
    ]
    const marcarAvisado = () =>
      knex.raw(`update cart set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb where id = ?`, [
        JSON.stringify({ mp_conciliacion_aviso: String(pago.id) }),
        cartId,
      ])

    const { rows: grupo } = await knex.raw(`select 1 from order_group where cart_id = ? and deleted_at is null limit 1`, [cartId])
    if (grupo.length) {
      // Ya hay pedido. Si la sesión quedó con OTRO pago aprobado, este es un cobro doble.
      const { rows: sesiones } = await knex.raw(
        `select ps.data->>'payment_id' as payment_id from payment_session ps
         join cart_payment_collection cpc on cpc.payment_collection_id = ps.payment_collection_id and cpc.deleted_at is null
         where cpc.cart_id = ? and ps.provider_id like 'pp_mercadopago%' and ps.deleted_at is null`,
        [cartId]
      )
      const usados = new Set((sesiones as { payment_id: string | null }[]).map((s) => String(s.payment_id || "")).filter(Boolean))
      if (usados.size && !usados.has(String(pago.id))) {
        salida.avisos++
        await marcarAvisado()
        await avisar(
          "Posible cobro DOBLE en Mercado Pago",
          filas,
          "Este carrito ya tiene pedido con otro pago, y Mercado Pago tiene este segundo pago aprobado. Revísalo en tu cuenta de Mercado Pago y, si es doble, reembólsalo desde ahí."
        )
      }
      continue
    }

    // Los cupones de HETNA se revisan igual que al pagar en la tienda (api/store/hetna-cupones)
    const { data: carritos } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["id", "customer_id", "email", "items.unit_price", "items.quantity", "promotions.code"],
      filters: { id: cartId },
    })
    const carrito = carritos[0] as any
    let cuponMal: string | null = null
    for (const codigo of ((carrito?.promotions || []) as { code?: string | null }[]).map((p) => p?.code || "").filter(esCuponHetna)) {
      cuponMal = cuponMal || (await motivoCupon(container as any, carrito, codigo))
    }
    if (cuponMal) {
      salida.avisos++
      await marcarAvisado()
      await avisar(
        "Cobro de Mercado Pago SIN pedido: revisa y decide el reembolso",
        [...filas, ["Motivo", `Cupón: ${cuponMal}`]],
        "Mercado Pago cobró, pero el cupón del carrito ya no aplica, así que el pedido no se creó solo. Decide si lo surtes o lo reembolsas desde Mercado Pago."
      )
      continue
    }

    // La sesión de pago del carrito apunta a ESTE pago aprobado: si el cliente pagó
    // una preferencia anterior (la referencia cambia cuando cambia el total),
    // authorizePayment la encuentra por payment_id y revisa que cubra el total.
    await knex.raw(
      `update payment_session ps set data = coalesce(ps.data, '{}'::jsonb) || ?::jsonb
       from cart_payment_collection cpc
       where cpc.cart_id = ? and cpc.deleted_at is null and ps.payment_collection_id = cpc.payment_collection_id
         and ps.provider_id like 'pp_mercadopago%' and ps.deleted_at is null`,
      [JSON.stringify({ payment_id: pago.id }), cartId]
    )
    const { errors, result } = await completeCartWithSplitOrdersWorkflow(container).run({
      input: { cart_id: cartId },
      throwOnError: false,
    })
    if (!errors?.length) {
      salida.completados++
      logger.info(`[conciliar-mp] pedido creado para ${cartId} (pago ${pago.id})`)
      await avisar(
        "Pedido creado por la revisión de Mercado Pago",
        [...filas, ["Grupo de pedidos", String((result as { order_group_id?: string } | undefined)?.order_group_id || "")]],
        "El cliente pagó pero no regresó a la tienda. La revisión automática creó su pedido; ya aparece en el panel y les llega a los talleres."
      )
      continue
    }
    const motivo = (errors[0] as { error?: { message?: string } })?.error?.message || "error desconocido"
    salida.avisos++
    logger.warn(`[conciliar-mp] ${cartId} (pago ${pago.id}) no se pudo completar: ${motivo}`)
    await marcarAvisado()
    await avisar(
      "Cobro de Mercado Pago SIN pedido: revisa y decide el reembolso",
      [...filas, ["Motivo", motivo]],
      `Mercado Pago cobró y el pedido no se pudo crear solo. Revisa el pago en tu cuenta de Mercado Pago y escríbele al cliente; si no se puede surtir, reembólsalo desde Mercado Pago. Tienda: ${STORE_URL}`
    )
  }
  return salida
}
