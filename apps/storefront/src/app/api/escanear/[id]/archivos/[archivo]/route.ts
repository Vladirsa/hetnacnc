// Entrega un archivo de una solicitud de Escanear del propio cliente (para el
// visor 3D, las imágenes del render y "Cotizar fabricación"). El backend sólo
// firma si la solicitud es suya; el navegador nunca ve la liga firmada.
import { NextResponse } from "next/server"

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const MAX = 100 * 1024 * 1024
const TIPOS: Record<string, string> = { stl: "model/stl", obj: "model/obj", ply: "application/octet-stream", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", zip: "application/zip", step: "model/step", stp: "model/step", "3mf": "model/3mf", dxf: "application/dxf" }

export async function GET(req: Request, { params }: { params: Promise<{ id: string; archivo: string }> }) {
  const { id, archivo } = await params
  if (!/^esc_[a-f0-9]{24}$/.test(id) || !/^arc_[a-f0-9]{1,20}$/.test(archivo)) return NextResponse.json({ message: "No válido." }, { status: 400 })
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return NextResponse.json({ message: "Necesitas iniciar sesión." }, { status: 401 })
  const r = await fetch(`${MEDUSA_BACKEND_URL}/store/escanear/${id}/archivos/${archivo}`, {
    headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...auth },
    cache: "no-store",
  })
  const d = (await r.json().catch(() => ({}))) as { url?: string; nombre?: string }
  if (!r.ok || !d.url) return NextResponse.json({ message: "No encontrado." }, { status: 404 })
  const f = await fetch(d.url, { cache: "no-store" })
  if (!f.ok || !f.body) return NextResponse.json({ message: "No se pudo leer el archivo." }, { status: 502 })
  const largo = Number(f.headers.get("content-length") || 0)
  if (largo > MAX) return NextResponse.json({ message: "Archivo demasiado grande." }, { status: 413 })
  const ext = (d.nombre?.split(".").pop() || "").toLowerCase()
  const descargar = new URL(req.url).searchParams.get("descargar") === "1"
  return new NextResponse(f.body, {
    headers: {
      "content-type": TIPOS[ext] || "application/octet-stream",
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
      ...(descargar ? { "content-disposition": `attachment; filename="${(d.nombre || "archivo").replace(/[^\w.\- ]+/g, "_")}"` } : {}),
      ...(largo ? { "content-length": String(largo) } : {}),
    },
  })
}
