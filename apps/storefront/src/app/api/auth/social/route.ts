// GET /api/auth/social -> { redes: [...] }: las redes con llaves en el servidor (para mostrar sus botones)
import { NextResponse } from "next/server"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const LLAVE = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export async function GET() {
  try {
    const r = await fetch(`${BACKEND}/store/hetna-social`, { headers: { "x-publishable-api-key": LLAVE }, next: { revalidate: 300 } })
    const d = r.ok ? ((await r.json()) as { redes?: string[] }) : { redes: [] }
    return NextResponse.json({ redes: d.redes || [] }, { headers: { "Cache-Control": "public, max-age=300" } })
  } catch {
    return NextResponse.json({ redes: [] })
  }
}
