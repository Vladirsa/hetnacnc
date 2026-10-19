// Cuenta el clic de un anuncio y manda a la persona a su destino.
// Ejemplo: /api/pub/clic/<id del anuncio>

import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/foro/db"
import isBot from "@/lib/helpers/isBot"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com"
  let destino = "/"

  if (UUID.test(id)) {
    try {
      const bot = isBot(req.headers.get("user-agent") || "")
      // Los robots de buscadores no cuentan como clic.
      const r = bot
        ? await db().query("select enlace from publicidad.piezas where id = $1", [id])
        : await db().query("update publicidad.piezas set clics = clics + 1 where id = $1 returning enlace", [id])
      if (r.rows[0]?.enlace) destino = r.rows[0].enlace as string
    } catch (e) {
      console.error("[publicidad] clic", e instanceof Error ? e.message : e)
    }
  }

  const url = /^https?:\/\//i.test(destino) ? destino : new URL(destino, base).toString()
  const res = NextResponse.redirect(url, 302)
  res.headers.set("X-Robots-Tag", "noindex")
  res.headers.set("Cache-Control", "no-store")
  return res
}
