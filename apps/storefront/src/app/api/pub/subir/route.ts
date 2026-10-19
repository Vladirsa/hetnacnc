// Sube una imagen del panel de publicidad al almacén de archivos de Medusa.
// Solo funciona si quien lo pide es administrador del dashboard.

import { NextRequest, NextResponse } from "next/server"

import { autorizacion, urlBackend } from "@/lib/publicidad/sesion"

export const dynamic = "force-dynamic"

const TIPOS = ["image/webp", "image/jpeg", "image/png", "image/avif"]
const MAX_BYTES = 6 * 1024 * 1024

// Dirección pública del sitio (https). Primero la variable del servidor; si no existe,
// la que usó el navegador para llegar aquí (detrás de nginx / Cloudflare).
function origenPublico(req: NextRequest): string {
  const fija = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  if (fija && /^https:\/\//i.test(fija) && !/localhost|127\.0\.0\.1/i.test(fija)) {
    return fija.replace(/\/$/, "")
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "hetnacnc.com"
  const limpio = host.split(",")[0].trim()
  // Si vino por la IP o por localhost, usamos el dominio real
  if (/^(localhost|127\.|\d+\.\d+\.\d+\.\d+)/.test(limpio)) return "https://hetnacnc.com"
  return `https://${limpio}`
}

// Convierte cualquier dirección devuelta por Medusa en una dirección pública con https.
function aPublica(url: string, req: NextRequest): string {
  // Ruta relativa (/static/...): se le pone el dominio
  if (url.startsWith("/")) return origenPublico(req) + url
  const m = url.match(/^https?:\/\/([^/]+)(\/.*)?$/i)
  if (!m) return url
  const host = m[1]
  const ruta = m[2] || ""
  // Dirección interna: se cambia por la pública
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return origenPublico(req) + ruta
  // Cualquier otra con http:// se sube a https://
  return `https://${host}${ruta}`
}

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
    const original = j.files?.[0]?.url
    if (!original) return NextResponse.json({ error: "No se recibió la dirección de la imagen." }, { status: 502 })

    const url = aPublica(original, req)
    // Queda anotado en el registro para poder revisar qué devolvió Medusa
    console.log("[publicidad] subir", original, "->", url)
    return NextResponse.json({ url })
  } catch (e) {
    console.error("[publicidad] subir", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 })
  }
}
