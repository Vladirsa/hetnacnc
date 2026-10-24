// Laboratorio CAM > Torno 4 ejes: POST /api/cam/torno
//
// Recibe la pieza (segmentos, material, máquina, fresa y RPM) y devuelve el
// G-code. El motor vive aquí, en el servidor (lib/torno/gcode.ts), para que
// haya una sola versión y nadie dependa de cálculos hechos en su navegador.
//
// Va bajo /api/cam/ a propósito: Nginx manda /api/(app|cam|foro|mp|...) a la
// tienda y todo lo demás de /api/ a Medusa. Un /api/gcode suelto se perdería.
//
// Sin cuenta, como el flujo del DXF: no se guarda nada.
import { NextResponse } from "next/server"

import { generarGCode, validarEntrada } from "@/lib/torno/gcode"

export const dynamic = "force-dynamic"

const MAX_BYTES = 200_000

export async function POST(req: Request) {
  const largo = Number(req.headers.get("content-length") || 0)
  if (largo > MAX_BYTES) {
    return NextResponse.json({ error: "El diseño es demasiado grande." }, { status: 413 })
  }

  let body: unknown
  try {
    const texto = await req.text()
    if (texto.length > MAX_BYTES) {
      return NextResponse.json({ error: "El diseño es demasiado grande." }, { status: 413 })
    }
    body = JSON.parse(texto)
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es JSON válido." }, { status: 400 })
  }

  const revisado = validarEntrada(body)
  if (!revisado.ok) {
    return NextResponse.json({ error: revisado.error }, { status: 400 })
  }

  try {
    return NextResponse.json(generarGCode(revisado.entrada))
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: `No se pudo generar el G-code: ${mensaje}` }, { status: 400 })
  }
}
