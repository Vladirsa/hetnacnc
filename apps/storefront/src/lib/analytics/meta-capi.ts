"use server"

// API de conversiones de Meta: la compra se reporta también desde el servidor.
//
// El Pixel del navegador pierde compras (bloqueadores, Safari, gente que cierra
// la pestaña) y Meta optimiza los anuncios con lo que sí le llega. Desde el
// servidor llega casi todo y con mejores datos para reconocer a la persona
// (correo, teléfono y CP cifrados, IP, navegador, cookies _fbp/_fbc).
//
// Mismo event_id que el Pixel (el id de la orden): Meta junta los dos y la
// cuenta una sola vez.
//
// Sólo se llama si la persona aceptó cookies de publicidad (TrackEvent revisa
// permiteRastreo() antes): se respeta lo que eligió en el aviso.
//
// Variables (storefront): NEXT_PUBLIC_META_PIXEL_ID y META_CAPI_TOKEN (Events
// Manager > tu conjunto de datos > Configuración > API de conversiones >
// Generar token). META_CAPI_TEST_CODE para ver los eventos en "Probar eventos".
import { createHash } from "crypto"
import { cookies, headers } from "next/headers"

import { retrieveCustomer } from "@/lib/data/customer"
import { retrieveOrder } from "@/lib/data/orders"
import { ipDe } from "@/lib/seguridad/ip-cliente"

const sha = (v: string) => createHash("sha256").update(v).digest("hex")
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase()
const cifrar = (v: unknown) => (norm(v) ? sha(norm(v)) : undefined)

// Teléfono con lada de país: Meta lo pide así (52 para México)
const telefono = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "")
  if (!d) return undefined
  return sha(d.length === 10 ? `52${d}` : d)
}

// Esta acción la puede llamar cualquiera desde el navegador con cualquier id.
// Para que nadie mande a Meta compras ajenas (con los datos cifrados de otra
// persona y su propia IP), sólo se reporta un pedido recién hecho, una vez por
// proceso, y nunca uno de otra cuenta si hay sesión.
const RECIENTE_MS = 60 * 60 * 1000
const yaReportados = new Set<string>()

export async function reportarCompraMeta(orderId: string): Promise<void> {
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_CAPI_TOKEN
  if (!pixel || !token || !/^order_[A-Za-z0-9]+$/.test(orderId)) return

  try {
    if (yaReportados.has(orderId)) return
    const order = (await retrieveOrder(orderId)) as any
    if (!order?.id) return
    const creado = new Date(order.created_at || 0).getTime()
    if (!creado || Date.now() - creado > RECIENTE_MS) return
    if (order.customer_id) {
      const cliente = await retrieveCustomer().catch(() => null)
      if (cliente?.id && cliente.id !== order.customer_id) return
    }
    yaReportados.add(orderId)
    if (yaReportados.size > 5000) yaReportados.clear()
    const dir = order.shipping_address || order.billing_address || {}
    const cabeceras = await headers()
    const galletas = await cookies()
    const ip = ipDe(cabeceras) || undefined
    const items = (order.items || []) as any[]

    const evento = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: order.id,
      action_source: "website",
      event_source_url: cabeceras.get("referer") || undefined,
      user_data: {
        em: cifrar(order.email) ? [cifrar(order.email)] : undefined,
        ph: telefono(dir.phone) ? [telefono(dir.phone)] : undefined,
        fn: cifrar(dir.first_name),
        ln: cifrar(dir.last_name),
        ct: cifrar(String(dir.city || "").replace(/\s+/g, "")),
        st: cifrar(dir.province),
        zp: cifrar(dir.postal_code),
        country: cifrar(dir.country_code),
        external_id: order.customer_id ? [sha(order.customer_id)] : undefined,
        client_ip_address: ip,
        client_user_agent: cabeceras.get("user-agent") || undefined,
        fbp: galletas.get("_fbp")?.value,
        fbc: galletas.get("_fbc")?.value,
      },
      custom_data: {
        currency: String(order.currency_code || "mxn").toUpperCase(),
        value: Math.round(Number(order.total || 0) * 100) / 100,
        order_id: order.id,
        content_type: "product",
        content_ids: items.map((i) => i.product_id || i.id),
        contents: items.map((i) => ({ id: i.product_id || i.id, quantity: i.quantity, item_price: Number(i.unit_price || 0) })),
        num_items: items.reduce((n, i) => n + (Number(i.quantity) || 1), 0),
      },
    }

    // El token va en el cuerpo y no en la dirección, para que no quede en bitácoras
    const r = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        data: [evento],
        ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) console.error("[meta-capi] compra no aceptada", r.status, (await r.text()).slice(0, 300))
  } catch (e) {
    // Medición, no cobro: si falla, la compra ya está hecha y el Pixel sigue
    console.error("[meta-capi] no se pudo reportar la compra", e instanceof Error ? e.message : e)
  }
}
