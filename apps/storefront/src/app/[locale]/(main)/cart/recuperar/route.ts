// /<locale>/cart/recuperar?id=cart_… -> deja ese carrito como el del navegador y manda al carrito.
// Lo usan los correos y el WhatsApp de carrito abandonado (28 nov 2026): antes ligaban a
// /mx/cart a secas, y abierto en otro teléfono o navegador el carrito salía vacío.
import { NextRequest, NextResponse } from "next/server"

import { setCartId } from "@/lib/data/cookies"
import { baseSitio } from "@/lib/hetna/schema"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const id = req.nextUrl.searchParams.get("id") || ""
  // Detrás de nginx req.nextUrl.origin es localhost:3000: el dominio sale de la configuración
  const destino = new URL(`/${locale}/cart`, baseSitio())
  // Sólo ids de carrito de Medusa; cualquier otra cosa va al carrito tal cual
  if (/^cart_[A-Za-z0-9]{10,40}$/.test(id)) await setCartId(id)
  return NextResponse.redirect(destino, { status: 303, headers: { "Cache-Control": "no-store" } })
}
