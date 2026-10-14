// Aviso de pago de Mercado Pago (webhook). No confiamos en lo que llega: con el número de pago
// le preguntamos directamente a Mercado Pago si está aprobado y por cuánto.

import { NextRequest, NextResponse } from "next/server"

import { avisarN8n, leerPedido, marcarPagado, UUID } from "@/lib/publicidad/pedidos"

export const dynamic = "force-dynamic"

async function procesar(req: NextRequest) {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) return NextResponse.json({ ok: false }, { status: 503 })

  const url = new URL(req.url)
  let pagoId = url.searchParams.get("data.id") || url.searchParams.get("id") || ""
  let tipo = url.searchParams.get("type") || url.searchParams.get("topic") || ""
  if (req.method === "POST") {
    const cuerpo = (await req.json().catch(() => null)) as { type?: string; topic?: string; data?: { id?: string | number } } | null
    if (cuerpo) {
      tipo = tipo || cuerpo.type || cuerpo.topic || ""
      pagoId = pagoId || String(cuerpo.data?.id ?? "")
    }
  }
  // Solo nos interesan los avisos de pagos
  if (tipo && tipo !== "payment") return NextResponse.json({ ok: true })
  if (!/^\d{3,20}$/.test(pagoId)) return NextResponse.json({ ok: true })

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${pagoId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!r.ok) {
    console.error("[publicidad] consulta de pago", r.status)
    return NextResponse.json({ ok: false }, { status: 502 }) // Mercado Pago volverá a intentar
  }
  const pago = (await r.json()) as { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string }
  if (pago.status !== "approved") return NextResponse.json({ ok: true })

  const id = pago.external_reference || ""
  if (!UUID.test(id)) return NextResponse.json({ ok: true })
  const pedido = await leerPedido(id)
  if (!pedido) return NextResponse.json({ ok: true })
  if (Number(pago.transaction_amount) + 0.01 < pedido.monto || (pago.currency_id && pago.currency_id !== "MXN")) {
    console.error("[publicidad] monto no coincide", id, pago.transaction_amount, pedido.monto)
    return NextResponse.json({ ok: true })
  }

  const listo = await marcarPagado(id, pagoId)
  if (listo) {
    console.log("[publicidad] pago aprobado", id, listo.espacio, listo.monto)
    await avisarN8n({
      tipo: "publicidad_pagada",
      anunciante: listo.anunciante,
      espacio: listo.espacio,
      dias: listo.dias,
      monto: listo.monto,
      correo: listo.correo,
      telefono: listo.telefono,
      vence: listo.vence,
      revisar: "https://hetnacnc.com/dashboard",
    })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  try {
    return await procesar(req)
  } catch (e) {
    console.error("[publicidad] mp-aviso", e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
