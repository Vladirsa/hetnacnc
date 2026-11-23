// Correos del pedido, al cliente y al taller (subscribers/correo-pedido.ts).
//
// Antes de esto, al comprar algo físico no llegaba ningún correo: sólo push y
// WhatsApp (a quien lo tiene verificado). Quien compraba sin cuenta no tenía
// ninguna constancia, y la liga del pedido le pedía iniciar sesión.
//
//   Cliente: recibido → va en camino (paquetería, guía y rastreo) → cancelado.
//            Las compras digitales no reciben "recibido": ya les llega el correo
//            con su descarga (lib/digital-delivery.ts).
//   Taller:  pedido nuevo, con lo que tiene que preparar y la dirección de envío.
//
// Mercur divide el carrito en un pedido por taller: cada pedido lleva su correo.
// Cada correo sale UNA vez por pedido, etapa y destinatario (tabla
// hetna_correo_pedido), aunque el evento llegue dos veces.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, VENDOR_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"
import { T_GUIAS } from "./guias"
import { CAMPOS_PAGO, pedidoPagado } from "./pago-pedido"
import { esPedidoDigital } from "./whatsapp-pedidos"

export const T_CORREO_PEDIDO = "hetna_correo_pedido"
export type EtapaCorreo = "recibido" | "en_camino" | "cancelado" | "taller_nuevo"

let listo = false
async function asegurar(knex: any) {
  if (listo) return
  // "if not exists": Mercur emite order.placed de cada pedido dividido casi a la
  // vez; con hasTable + createTable dos corridas chocaban y una perdía su correo
  await knex.raw(`create table if not exists ${T_CORREO_PEDIDO} (
    order_id text not null, etapa text not null, para text not null,
    enviado_en timestamptz not null default now(),
    primary key (order_id, etapa, para))`)
  listo = true
}

const dinero = (n: unknown, moneda = "mxn") =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: String(moneda || "mxn").toUpperCase() })

export type Renglon = { titulo: string; presentacion: string; cantidad: number; precio: string; foto: string }
export type Pedido = {
  id: string
  numero: string
  nombre: string
  email: string | null
  conCuenta: boolean
  taller: { id: string; nombre: string; email: string | null } | null
  renglones: Renglon[]
  subtotal: string
  envioCosto: string
  total: string
  envio: string
  direccion: string[]
  digital: boolean
  pagado: boolean
  paqueteria: string
  guia: string
  rastreo: string
}

export async function datosCorreoPedido(container: any, orderId: string): Promise<Pedido | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "email", "currency_code", "total", "item_total", "shipping_total",
      "customer.first_name", "customer.has_account",
      "shipping_address.first_name", "shipping_address.last_name", "shipping_address.address_1", "shipping_address.address_2",
      "shipping_address.city", "shipping_address.province", "shipping_address.postal_code", "shipping_address.phone",
      "items.title", "items.product_title", "items.variant_title", "items.quantity", "items.unit_price", "items.thumbnail",
      "shipping_methods.name",
      "fulfillments.canceled_at", "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url",
      ...CAMPOS_PAGO,
    ],
    filters: { id: orderId },
  })
  const o = data?.[0] as any
  if (!o) return null
  const moneda = o.currency_code || "mxn"

  const { data: ligas } = await query.graph({ entity: "order_seller", fields: ["seller_id"], filters: { order_id: orderId } as any })
  const sellerId = (ligas?.[0] as any)?.seller_id as string | undefined
  let taller: Pedido["taller"] = null
  if (sellerId) {
    const { data: ts } = await query.graph({ entity: "seller", fields: ["id", "name", "email"], filters: { id: sellerId } })
    const t = ts?.[0] as any
    if (t) taller = { id: t.id, nombre: t.name || "", email: t.email || null }
  }

  const guia = await knex(T_GUIAS).where({ order_id: o.id }).first().catch(() => null)
  const etiqueta = (o.fulfillments || []).filter((f: any) => !f.canceled_at).flatMap((f: any) => f.labels || []).find((l: any) => l?.tracking_number)
  const a = o.shipping_address || {}
  const direccion = [
    [a.first_name, a.last_name].filter(Boolean).join(" "),
    [a.address_1, a.address_2].filter(Boolean).join(", "),
    [a.city, a.province, a.postal_code].filter(Boolean).join(", "),
    a.phone ? `Tel. ${a.phone}` : "",
  ].filter((x) => x && !/^entrega digital$/i.test(x))

  return {
    id: o.id,
    numero: `#${o.display_id}`,
    nombre: String(o.customer?.first_name || a.first_name || "").trim().split(/\s+/)[0] || "",
    email: o.email || null,
    conCuenta: !!o.customer?.has_account,
    taller,
    renglones: (o.items || []).map((i: any) => ({
      titulo: String(i.product_title || i.title || ""),
      presentacion: i.variant_title && !/^(única|default)/i.test(i.variant_title) ? String(i.variant_title) : "",
      cantidad: Number(i.quantity || 0),
      precio: dinero(Number(i.unit_price || 0) * Number(i.quantity || 0), moneda),
      foto: String(i.thumbnail || ""),
    })),
    subtotal: dinero(o.item_total, moneda),
    envioCosto: dinero(o.shipping_total, moneda),
    total: dinero(o.total, moneda),
    envio: String(o.shipping_methods?.[0]?.name || ""),
    direccion,
    digital: esPedidoDigital(o.shipping_methods),
    pagado: pedidoPagado(o),
    paqueteria: String(guia?.paqueteria || ""),
    guia: String(guia?.guia || etiqueta?.tracking_number || ""),
    // Sólo ligas web: la liga de rastreo la puede escribir el taller y va en un botón
    rastreo: /^https?:\/\//i.test(String(guia?.rastreo_url || etiqueta?.tracking_url || "")) ? String(guia?.rastreo_url || etiqueta?.tracking_url) : "",
  }
}

// ── HTML ───────────────────────────────────────────────────────────────────

const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${t}</p>`

function tablaRenglones(d: Pedido) {
  const filas = d.renglones
    .map(
      (r) => `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #eee;width:56px">${r.foto ? `<img src="${esc(r.foto)}" width="48" height="48" alt="" style="border-radius:6px;object-fit:cover;display:block">` : ""}</td>
  <td style="padding:8px;border-bottom:1px solid #eee">${esc(r.titulo)}${r.presentacion ? `<br><span style="color:#6B6A63;font-size:12px">${esc(r.presentacion)}</span>` : ""}<br><span style="color:#6B6A63;font-size:12px">Cantidad: ${r.cantidad}</span></td>
  <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${esc(r.precio)}</td>
</tr>`
    )
    .join("")
  const tot = (k: string, v: string, fuerte = false) =>
    `<tr><td></td><td style="padding:4px 8px;text-align:right;color:#6B6A63${fuerte ? ";font-weight:700;color:#142033" : ""}">${k}</td><td style="padding:4px 0;text-align:right${fuerte ? ";font-weight:700" : ""}">${esc(v)}</td></tr>`
  return (
    `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 12px">${filas}` +
    tot("Productos", d.subtotal) +
    (d.digital ? "" : tot(`Envío${d.envio ? ` (${esc(d.envio)})` : ""}`, d.envioCosto)) +
    tot("Total", d.total, true) +
    `</table>`
  )
}

const bloqueDireccion = (d: Pedido) =>
  d.digital || !d.direccion.length
    ? ""
    : `<p style="margin:0 0 4px;font-weight:700;color:#142033">Se envía a</p>${p(d.direccion.map(esc).join("<br>"))}`

/** Liga del pedido: sólo si tiene cuenta (la página pide iniciar sesión). */
const ligaCliente = (d: Pedido) => (d.conCuenta ? boton("Ver mi pedido", `${STORE_URL}/mx/user/orders/${d.id}`) : "")

export function correoCliente(etapa: Exclude<EtapaCorreo, "taller_nuevo">, d: Pedido): { asunto: string; html: string } {
  const hola = d.nombre ? `¡Hola ${esc(d.nombre)}!` : "¡Hola!"
  const deTaller = d.taller?.nombre ? ` de ${esc(d.taller.nombre)}` : ""
  if (etapa === "recibido") {
    return {
      asunto: `Recibimos tu pedido ${d.numero} 📦`,
      html: marco(
        `Recibimos tu pedido ${d.numero}`,
        p(
          d.pagado
            ? `${hola} Tu pedido${deTaller} ya está confirmado. El taller lo está preparando y te avisaremos por correo cuando vaya en camino.`
            : `${hola} Recibimos tu pedido${deTaller}. Falta confirmar el pago: el taller se pondrá en contacto contigo. Cuando vaya en camino te avisaremos por correo.`
        ) +
          tablaRenglones(d) +
          bloqueDireccion(d) +
          ligaCliente(d) +
          p(`<span style="font-size:13px;color:#6B6A63">Guarda este correo como comprobante. Si tienes una duda, responde a este correo o escríbenos por WhatsApp con tu número de pedido ${d.numero}.</span>`)
      ),
    }
  }
  if (etapa === "en_camino") {
    const guia = [d.paqueteria && `Paquetería: <b>${esc(d.paqueteria)}</b>`, d.guia && `Guía: <b>${esc(d.guia)}</b>`].filter(Boolean).join("<br>")
    return {
      asunto: `Tu pedido ${d.numero} va en camino 🚚`,
      html: marco(
        `Tu pedido ${d.numero} va en camino`,
        p(`${hola} El taller ya envió tu pedido${deTaller}.`) +
          (guia ? p(guia) : "") +
          (d.rastreo ? boton("Rastrear mi paquete", d.rastreo) : "") +
          tablaRenglones(d) +
          bloqueDireccion(d) +
          ligaCliente(d)
      ),
    }
  }
  return {
    asunto: `Tu pedido ${d.numero} fue cancelado`,
    html: marco(
      `Pedido ${d.numero} cancelado`,
      p(`${hola} Tu pedido${deTaller} fue cancelado. Si ya lo habías pagado, el reembolso se hace al mismo medio de pago; puede tardar unos días en reflejarse.`) +
        tablaRenglones(d) +
        p(`<span style="font-size:13px;color:#6B6A63">Si no pediste la cancelación o tienes una duda, responde a este correo con tu número de pedido ${d.numero}.</span>`)
    ),
  }
}

export function correoTaller(d: Pedido): { asunto: string; html: string } {
  return {
    asunto: `Pedido nuevo ${d.numero}: ${d.renglones.reduce((a, r) => a + r.cantidad, 0)} artículo(s) por ${d.total}`,
    html: marco(
      `Pedido nuevo ${d.numero}`,
      p(
        (d.pagado ? "" : "<b>Pago pendiente:</b> ponte de acuerdo con el cliente antes de preparar el pedido. ") +
          (d.digital
            ? "Este pedido no lleva envío por paquetería. Revisa los detalles en tu panel."
            : "Tienes un pedido nuevo para preparar. Cuando lo tengas listo, genera la guía desde tu panel: al cliente le llega el aviso de que va en camino.")
      ) +
        tablaRenglones(d) +
        bloqueDireccion(d) +
        boton("Ver el pedido en mi panel", `${VENDOR_URL}/orders/${d.id}`)
    ),
  }
}

// ── Envío ──────────────────────────────────────────────────────────────────

const correoValido = (v: unknown): v is string => typeof v === "string" && /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(v.trim())

/** Manda el correo de una etapa. Nunca truena el flujo que lo llama. Devuelve cuántos salieron. */
export async function correoPedido(container: any, orderId: string, etapas: EtapaCorreo[], logger?: any): Promise<number> {
  let n = 0
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await asegurar(knex)
    const d = await datosCorreoPedido(container, orderId)
    if (!d) return 0
    for (const etapa of etapas) {
      if (etapa !== "taller_nuevo" && d.digital && etapa !== "cancelado") continue
      const para = etapa === "taller_nuevo" ? d.taller?.email : d.email
      if (!correoValido(para)) continue
      const destino = para.trim().toLowerCase()
      // Se reserva antes de mandar: si el evento llega dos veces, sale uno
      const reservado = await knex(T_CORREO_PEDIDO)
        .insert({ order_id: d.id, etapa, para: destino })
        .onConflict(["order_id", "etapa", "para"])
        .ignore()
        .returning("order_id")
      if (!reservado?.length) continue
      const m = etapa === "taller_nuevo" ? correoTaller(d) : correoCliente(etapa, d)
      const r = await sendEmail({ to: destino, subject: m.asunto, html: m.html }).catch((e: Error) => ({ sent: false, reason: e.message }) as any)
      if (r?.sent) {
        n++
      } else {
        // No salió: se libera la reserva (si el mismo evento vuelve a llegar, se reintenta)
        await knex(T_CORREO_PEDIDO).where({ order_id: d.id, etapa, para: destino }).del().catch(() => null)
        logger?.warn?.(`[correo-pedido] ${d.numero} ${etapa}: ${r?.reason || "no se envió"}`)
      }
    }
    if (n) logger?.info?.(`[correo-pedido] ${d.numero}: ${n} correo(s)`)
  } catch (e) {
    logger?.warn?.(`[correo-pedido] ${orderId}: ${(e as Error).message}`)
  }
  return n
}
