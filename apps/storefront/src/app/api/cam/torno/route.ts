// Laboratorio CAM > Torno 4 ejes: POST /api/cam/torno
//
// Recibe la pieza (segmentos, material, máquina, fresa y RPM) y devuelve el
// G-code. El motor vive aquí, en el servidor (lib/torno/gcode.ts), para que
// haya una sola versión y nadie dependa de cálculos hechos en su navegador.
//
// Va bajo /api/cam/ a propósito: Nginx manda /api/(app|cam|foro|mp|...) a la
// tienda y todo lo demás de /api/ a Medusa. Un /api/gcode suelto se perdería.
//
// Calcular es libre. El programa completo sólo se entrega con `descargar: true`,
// si el plan incluye el torno y queda cupo en el mes (lib/cam/cupo-servidor.ts);
// al calcular se devuelven los datos y las primeras líneas, para revisar.
import { NextResponse } from "next/server"

import { autorizarDescarga, huella } from "@/lib/cam/cupo-servidor"
import { generarGCode, validarEntrada } from "@/lib/torno/gcode"

export const dynamic = "force-dynamic"

const MAX_BYTES = 200_000
// Lo que se enseña al calcular: encabezado y arranque, suficiente para revisar el formato
const LINEAS_DE_VISTA = 60

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

  const descargar = (body as { descargar?: unknown })?.descargar === true
  try {
    const { gcode, ...datos } = generarGCode(revisado.entrada)
    if (!descargar) {
      const lineas = gcode.split("\n")
      return NextResponse.json({ ...datos, vista: lineas.slice(0, LINEAS_DE_VISTA).join("\n"), lineasOcultas: Math.max(0, lineas.length - LINEAS_DE_VISTA) })
    }
    const no = await autorizarDescarga("torno", huella(gcode))
    if (no) return NextResponse.json(no.negado, { status: no.status })
    return NextResponse.json({ ...datos, gcode })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: `No se pudo generar el G-code: ${mensaje}` }, { status: 400 })
  }
}
