// Cuenta las vistas de los anuncios (el navegador avisa una vez por sesión).

import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/foro/db"
import isBot from "@/lib/helpers/isBot"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    if (isBot(req.headers.get("user-agent") || "")) return NextResponse.json({ ok: true })
    const cuerpo = (await req.json()) as { ids?: unknown }
    const ids = Array.isArray(cuerpo.ids)
      ? (cuerpo.ids as unknown[]).filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 12)
      : []
    if (ids.length) {
      await db().query("update publicidad.piezas set vistas = vistas + 1 where id = any($1::uuid[])", [ids])
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
