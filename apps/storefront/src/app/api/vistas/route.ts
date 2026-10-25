import { NextRequest, NextResponse } from "next/server"

// Puente del navegador al backend para contar una vista de ficha.
//
// Pasa por aquí y no directo a Medusa para no exponer la clave publicable en
// una petición que se puede ver desde la consola del navegador, y para que el
// origen de la llamada sea el mismo sitio (sin CORS ni preflight).
//
// Contesta 200 siempre. Es una estadística: no tiene por qué informarle al
// navegador que algo salió mal, ni dar pie a que alguien reintente.
const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function POST(req: NextRequest) {
  try {
    const cuerpo = await req.json().catch(() => null)
    const productId =
      cuerpo && typeof cuerpo.product_id === "string" ? cuerpo.product_id : ""
    if (!productId) return NextResponse.json({ ok: false })

    await fetch(`${MEDUSA_BACKEND_URL}/store/vistas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env
          .NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify({
        product_id: productId,
        ...(typeof cuerpo.seller_id === "string"
          ? { seller_id: cuerpo.seller_id }
          : {}),
      }),
      cache: "no-store",
    })
  } catch {
    // Se ignora a propósito.
  }

  return NextResponse.json({ ok: true })
}
