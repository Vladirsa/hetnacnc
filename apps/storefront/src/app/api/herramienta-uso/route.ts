import { NextRequest, NextResponse } from "next/server"

import { cabeceraIpCliente } from "@/lib/seguridad/ip-firmada"

// Puente del navegador al backend para contar el uso de una herramienta del
// Estudio (components/hetna/estudio/ContarUsoHerramienta.tsx). Igual que
// /api/vistas: sin exponer la clave publicable y contestando 200 siempre.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => null)
    const herramienta = b && typeof b.herramienta === "string" ? b.herramienta.slice(0, 60) : ""
    const evento = b && typeof b.evento === "string" ? b.evento.slice(0, 20) : ""
    if (herramienta && evento)
      await fetch(`${MEDUSA_BACKEND_URL}/store/herramienta-uso`, {
        method: "POST",
        // con la IP del visitante firmada: el API pone su tope por IP
        headers: { "Content-Type": "application/json", "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...(await cabeceraIpCliente()) },
        body: JSON.stringify({ herramienta, evento }),
        cache: "no-store",
      })
  } catch {
    // Se ignora a propósito.
  }
  return NextResponse.json({ ok: true })
}
