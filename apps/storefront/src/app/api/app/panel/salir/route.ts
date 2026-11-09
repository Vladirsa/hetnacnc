import { NextResponse } from "next/server"

import { COOKIE_PANEL } from "@/lib/panel/sesion"

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/panel/entrar", req.url), 303)
  res.cookies.set(COOKIE_PANEL, "", { httpOnly: true, path: "/", maxAge: 0 })
  return res
}
