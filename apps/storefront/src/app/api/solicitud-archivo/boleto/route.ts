// Pide al backend un boleto de subida directa a Backblaze (ver
// lib/subir-archivo.ts). Pasa el JSON tal cual a POST /store/solicitud-archivos/boleto.
//
// Nginx: esta ruta cuelga de /api/solicitud-archivo, así que el bloque de
// nginx debe ser `location ^~ /api/solicitud-archivo` (prefijo), no `=`:
// con `=` sólo la subida llega a la tienda y /boleto cae al API de Medusa.
import { NextResponse } from "next/server"
import { ipDe } from "@/lib/seguridad/ip-cliente"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function POST(req: Request) {
  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ message: "Se esperaba el nombre y el tamaño del archivo." }, { status: 400 })
  }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitud-archivos/boleto`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        "x-forwarded-for": ipDe(req.headers),
      },
      body: JSON.stringify(cuerpo),
    })
    const r = await res.json().catch(() => ({}))
    return NextResponse.json(r, { status: res.status })
  } catch (e) {
    console.error("[solicitud-archivo/boleto] fallo con el backend", e)
    return NextResponse.json({ message: "No pudimos preparar la subida." }, { status: 502 })
  }
}
