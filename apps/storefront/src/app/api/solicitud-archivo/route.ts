// Subida del plano, modelo o foto de una solicitud de fabricación.
//
// El navegador no puede hablar directo con el backend de Medusa (otra
// dirección y exige la llave publicable), y una server action no sirve:
// Next corta su cuerpo en 1 MB. Esta ruta pasa el formulario tal cual, sin
// leerlo en memoria, a POST /store/solicitud-archivos, que lo guarda en el
// bucket privado y devuelve la clave.
import { NextResponse } from "next/server"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const MAX_BYTES = 26 * 1024 * 1024

export async function POST(req: Request) {
  const tipo = req.headers.get("content-type") || ""
  if (!tipo.toLowerCase().startsWith("multipart/form-data") || !req.body) {
    return NextResponse.json({ message: "Se esperaba un archivo." }, { status: 400 })
  }
  if (Number(req.headers.get("content-length") || 0) > MAX_BYTES) {
    return NextResponse.json({ message: "El archivo pesa más de 25 MB." }, { status: 413 })
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitud-archivos`, {
      method: "POST",
      headers: {
        "content-type": tipo,
        ...(req.headers.get("content-length") ? { "content-length": req.headers.get("content-length")! } : {}),
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        // El backend limita subidas por IP: que vea la del cliente, no la nuestra.
        "x-forwarded-for": req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "",
      },
      body: req.body,
      duplex: "half",
    } as RequestInit & { duplex: "half" })
    const cuerpo = await res.json().catch(() => ({}))
    return NextResponse.json(cuerpo, { status: res.status })
  } catch (e) {
    console.error("[solicitud-archivo] fallo subiendo al backend", e)
    return NextResponse.json({ message: "No pudimos subir tu archivo. Intenta de nuevo." }, { status: 502 })
  }
}
