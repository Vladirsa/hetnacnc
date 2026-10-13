// Sube una imagen del panel de publicidad al almacén de archivos de Medusa.
// Solo funciona si quien lo pide es administrador del dashboard.

import { NextRequest, NextResponse } from "next/server"

import { autorizacion, urlBackend } from "@/lib/publicidad/sesion"

export const dynamic = "force-dynamic"

const TIPOS = ["image/webp", "image/jpeg", "image/png", "image/avif"]
const MAX_BYTES = 6 * 1024 * 1024

export async function POST(req: NextRequest) {
  if (req.headers.get("x-hetna-pub") !== "1") return NextResponse.json({ error: "Petición no permitida." }, { status: 403 })
  const cabeceras = await autorizacion(req)
  if (!cabeceras) return NextResponse.json({ error: "Inicia sesión en el dashboard primero." }, { status: 401 })

  try {
    const form = await req.formData()
    const archivo = form.get("archivo")
    if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 })
    if (!TIPOS.includes(archivo.type)) return NextResponse.json({ error: "Solo imágenes WebP, JPG, PNG o AVIF." }, { status: 400 })
    if (archivo.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 6 MB." }, { status: 400 })

    const envio = new FormData()
    envio.append("files", archivo, archivo.name || "banner.webp")
    const r = await fetch(`${urlBackend()}/admin/uploads`, {
      method: "POST",
      headers: cabeceras,
      body: envio,
    })
    if (!r.ok) {
      console.error("[publicidad] subir", r.status, (await r.text()).slice(0, 300))
      return NextResponse.json({ error: "El almacén de archivos rechazó la imagen." }, { status: 502 })
    }
    const j = (await r.json()) as { files?: { url?: string }[] }
    let url = j.files?.[0]?.url
    if (!url) return NextResponse.json({ error: "No se recibió la dirección de la imagen." }, { status: 502 })

    // Si Medusa devuelve una dirección interna (localhost), la cambiamos por la pública.
    const publica = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
    if (publica && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
      url = url.replace(/^https?:\/\/[^/]+/i, publica.replace(/\/$/, ""))
    }
    return NextResponse.json({ url })
  } catch (e) {
    console.error("[publicidad] subir", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 })
  }
}
