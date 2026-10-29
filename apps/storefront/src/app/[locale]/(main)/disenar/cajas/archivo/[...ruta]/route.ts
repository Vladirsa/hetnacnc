// Reenvía al servicio de cajas (infra/cajas) lo que el navegador necesita:
// la vista previa SVG, las descargas y las miniaturas. El servicio sólo
// escucha en localhost; por aquí es como sale a internet.
//
// Vive en /<locale>/disenar/cajas/archivo/... y no en /api/... a propósito:
// en el VPS nginx manda /api/* al backend de Medusa.
import { NextResponse } from "next/server"

import { CAJAS_URL } from "@/lib/hetna/cajas"

export const dynamic = "force-dynamic"

const PERMITIDAS = new Set(["generar", "miniatura"])

export async function GET(req: Request, { params }: { params: Promise<{ ruta: string[]; locale: string }> }) {
  const { ruta } = await params
  const [accion, id] = ruta || []
  if (!CAJAS_URL || !PERMITIDAS.has(accion) || !/^[A-Za-z0-9]+$/.test(id || "")) {
    return NextResponse.json({ error: "no disponible" }, { status: 404 })
  }
  const { search } = new URL(req.url)
  try {
    const r = await fetch(`${CAJAS_URL}/${accion}/${id}${search}`, { cache: accion === "miniatura" ? "force-cache" : "no-store" })
    const cuerpo = await r.arrayBuffer()
    const cab = new Headers()
    for (const k of ["content-type", "content-disposition", "cache-control"]) {
      const v = r.headers.get(k)
      if (v) cab.set(k, v)
    }
    if (accion === "generar") {
      // Descarga con nombre legible cuando lo piden así (?descargar=1)
      const q = new URL(req.url).searchParams
      if (q.get("descargar")) cab.set("content-disposition", `attachment; filename="hetna-${id}.${q.get("formato") || "svg"}"`)
      cab.set("cache-control", "private, max-age=300")
    }
    return new NextResponse(cuerpo, { status: r.status, headers: cab })
  } catch {
    return NextResponse.json({ error: "el servicio de cajas no responde" }, { status: 502 })
  }
}
