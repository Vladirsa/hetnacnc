// Miniatura de un escaneo para la galería "Mis modelos": la imagen del modelo
// terminado o, mientras, la foto que se subió. Mismo esquema que /modelo: el
// backend sólo firma si el escaneo es de quien tiene la sesión.
import { NextResponse } from "next/server"

import { cargarEscaneo } from "@/lib/escaneos/acciones"

const MAX = 15 * 1024 * 1024

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^esc3d_[A-Za-z0-9]+$/.test(id)) return new NextResponse(null, { status: 400 })
  const res = await cargarEscaneo(id)
  const url = res.ok ? res.datos.descargas?.miniatura : null
  if (!url) return new NextResponse(null, { status: 404 })
  const img = await fetch(url, { cache: "no-store" })
  if (!img.ok || !img.body) return new NextResponse(null, { status: 502 })
  const largo = Number(img.headers.get("content-length") || 0)
  if (largo > MAX) return new NextResponse(null, { status: 413 })
  return new NextResponse(img.body, {
    headers: {
      "content-type": img.headers.get("content-type") || "image/jpeg",
      "cache-control": "private, max-age=300",
      ...(largo ? { "content-length": String(largo) } : {}),
    },
  })
}
