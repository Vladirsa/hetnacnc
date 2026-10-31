// Recibe una foto del escaneo 3D y la pasa al backend, que la sube a
// Backblaze con la sesión del cliente (lib/escaneos/acciones.ts).
//
// Una foto por petición: así una conexión mala sólo pierde esa foto y no las
// cuarenta.
import { NextResponse } from "next/server"

import { subirFoto } from "@/lib/escaneos/acciones"

const TIPOS = ["image/jpeg", "image/png", "image/webp"]
// Las cámaras de celular sacan fotos de 3 a 8 MB. Para fotogrametría conviene
// no reducirlas: la resolución es justo lo que permite alinear las vistas.
const MAX = 12 * 1024 * 1024

// Revisa la firma del archivo, no sólo lo que dice el navegador.
function tipoReal(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length > 8 && b.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png"
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")
    return "image/webp"
  return null
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, mensaje: "No se pudo leer la foto." }, { status: 400 })
  }

  const archivo = form.get("foto")
  if (!(archivo instanceof Blob)) {
    return NextResponse.json({ ok: false, mensaje: "Elige una foto." }, { status: 400 })
  }
  if (archivo.size > MAX) {
    return NextResponse.json({ ok: false, mensaje: "La foto pesa más de 12 MB." }, { status: 400 })
  }

  const contenido = await archivo.arrayBuffer()
  const tipo = tipoReal(Buffer.from(contenido))
  if (!tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ ok: false, mensaje: "Sólo fotos JPG, PNG o WebP." }, { status: 400 })
  }

  // El lote agrupa las fotos de un mismo escaneo en una carpeta. Lo valida el
  // backend; aquí sólo se pasa.
  const lote = form.get("lote")
  const resultado = await subirFoto(contenido, tipo, typeof lote === "string" ? lote : undefined)

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, mensaje: resultado.mensaje }, { status: 502 })
  }
  return NextResponse.json({ ok: true, lote: resultado.lote, storage_key: resultado.storage_key })
}
