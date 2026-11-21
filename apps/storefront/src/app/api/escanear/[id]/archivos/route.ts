// Sube un archivo de Escanear (escaneo STL/OBJ/PLY/3MF/ZIP o foto, hasta 95 MB).
// Va por aquí y no por una acción del servidor: las acciones tienen tope de
// 1 MB. El cuerpo se pasa tal cual al backend con la sesión del cliente.
import { NextResponse } from "next/server"

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^esc_[a-f0-9]{24}$/.test(id)) return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 })
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return NextResponse.json({ message: "Necesitas iniciar sesión." }, { status: 401 })
  const tipo = req.headers.get("content-type") || ""
  if (!tipo.startsWith("multipart/form-data")) return NextResponse.json({ message: "Formulario no válido." }, { status: 400 })
  const res = await fetch(`${MEDUSA_BACKEND_URL}/store/escanear/${id}/archivos`, {
    method: "POST",
    headers: {
      "content-type": tipo,
      ...(req.headers.get("content-length") ? { "content-length": req.headers.get("content-length")! } : {}),
      "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      ...auth,
    },
    body: req.body,
    // @ts-expect-error: Node necesita esto para mandar el cuerpo como flujo
    duplex: "half",
    cache: "no-store",
  })
  const cuerpo = await res.json().catch(() => ({ message: "No se pudo subir el archivo." }))
  return NextResponse.json(cuerpo, { status: res.status })
}
