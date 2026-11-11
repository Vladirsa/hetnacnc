// POST /api/app/cam-nube (multipart: dxf, gcode, nombre) → guarda el trabajo
// del CAM Studio 2D en la HetNa Cloud del taller del cliente con sesión.
// El navegador no tiene la llave de la sesión (cookie httpOnly): este puente
// la agrega y lo manda a /store/hetna-cloud/cam.
import { NextResponse } from "next/server"

import { getAuthHeaders } from "@/lib/data/cookies"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const LLAVE = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export async function POST(req: Request) {
  const auth = await getAuthHeaders()
  if (!("authorization" in auth)) return NextResponse.json({ message: "Entra a tu cuenta para guardar en tu nube." }, { status: 401 })
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ message: "No llegaron los archivos." }, { status: 400 })
  }
  const salida = new FormData()
  const gcode = form.get("gcode")
  const dxf = form.get("dxf")
  if (!(gcode instanceof Blob) || gcode.size === 0) return NextResponse.json({ message: "No llegó el G-code." }, { status: 400 })
  if (gcode.size > 10 * 1024 * 1024 || (dxf instanceof Blob && dxf.size > 10 * 1024 * 1024)) {
    return NextResponse.json({ message: "Los archivos pasan de 10 MB." }, { status: 413 })
  }
  salida.append("gcode", gcode, (gcode as File).name || "pieza.nc")
  if (dxf instanceof Blob && dxf.size > 0) salida.append("dxf", dxf, (dxf as File).name || "pieza.dxf")
  salida.append("nombre", String(form.get("nombre") || "Pieza").slice(0, 90))
  try {
    const r = await fetch(`${BACKEND}/store/hetna-cloud/cam`, {
      method: "POST",
      headers: { ...auth, "x-publishable-api-key": LLAVE },
      body: salida,
    })
    const cuerpo = await r.json().catch(() => ({}))
    return NextResponse.json(cuerpo, { status: r.status })
  } catch {
    return NextResponse.json({ message: "No pudimos guardar en tu nube. Intenta de nuevo." }, { status: 502 })
  }
}
