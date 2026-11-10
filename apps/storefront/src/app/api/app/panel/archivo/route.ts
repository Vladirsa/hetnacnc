// HETNA Panel: abre un documento del expediente de verificación de un taller
// (el API sólo lo entrega a administradores; aquí se pasa el token).
//   GET /api/app/panel/archivo?seller=<id>&id=<archivoId>
import { NextResponse } from "next/server"

import { puede } from "@/lib/panel/roles"
import { tokenPanel, usuarioPanel } from "@/lib/panel/sesion"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function GET(req: Request) {
  const yo = await usuarioPanel()
  if (!yo || !puede(yo.rol, "talleres")) return NextResponse.json({ message: "Sin acceso." }, { status: 401 })
  const u = new URL(req.url)
  const seller = u.searchParams.get("seller") || "", id = u.searchParams.get("id") || ""
  if (!/^[\w-]+$/.test(seller) || !/^[\w-]+$/.test(id)) return NextResponse.json({ message: "Parámetros inválidos." }, { status: 400 })
  const token = await tokenPanel()
  const r = await fetch(`${BACKEND}/admin/hetna-verificacion/${seller}/archivos/${id}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!r.ok) return NextResponse.json({ message: "No se encontró el documento." }, { status: r.status })
  return new NextResponse(r.body, { headers: { "content-type": r.headers.get("content-type") || "application/octet-stream", "cache-control": "private, no-store", "content-disposition": "inline" } })
}
