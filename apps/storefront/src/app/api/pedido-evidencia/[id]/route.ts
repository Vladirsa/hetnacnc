// Subida de una foto o video de evidencia para el reclamo de una compra.
// Pasa el formulario tal cual (sin leerlo en memoria) a
// POST /store/hetna-pedidos/:id/evidencia con la sesión del cliente. Una
// server action no sirve: Next corta su cuerpo en 1 MB.
import { NextResponse } from "next/server"

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const MAX_MB = 15
const MAX_BYTES = (MAX_MB + 1) * 1024 * 1024

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^order_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ message: "Pedido inválido." }, { status: 400 })
  const tipo = req.headers.get("content-type") || ""
  if (!tipo.toLowerCase().startsWith("multipart/form-data") || !req.body) {
    return NextResponse.json({ message: "Se esperaba un archivo." }, { status: 400 })
  }
  if (Number(req.headers.get("content-length") || 0) > MAX_BYTES) {
    return NextResponse.json({ message: `El archivo pesa más de ${MAX_MB} MB.` }, { status: 413 })
  }
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return NextResponse.json({ message: "Inicia sesión de nuevo." }, { status: 401 })
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-pedidos/${id}/evidencia`, {
      method: "POST",
      headers: {
        "content-type": tipo,
        ...(req.headers.get("content-length") ? { "content-length": req.headers.get("content-length")! } : {}),
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        authorization: auth.authorization,
      },
      body: req.body,
      duplex: "half",
    } as RequestInit & { duplex: "half" })
    const cuerpo = await res.json().catch(() => ({}))
    return NextResponse.json(cuerpo, { status: res.status })
  } catch (e) {
    console.error("[pedido-evidencia] fallo subiendo al backend", e)
    return NextResponse.json({ message: "No pudimos subir tu archivo. Intenta de nuevo." }, { status: 502 })
  }
}
