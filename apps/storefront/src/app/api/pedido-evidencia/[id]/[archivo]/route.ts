// Ver una foto o video del reclamo de una compra propia (privado: con la sesión).
import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; archivo: string }> }) {
  const { id, archivo } = await params
  if (!/^order_[A-Za-z0-9]+$/.test(id) || !/^evi_[a-f0-9]{32}$/.test(archivo)) return new Response("No encontrado", { status: 404 })
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return new Response("Inicia sesión", { status: 401 })
  const r = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-pedidos/${id}/evidencia/${archivo}`, {
    headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, authorization: auth.authorization },
    cache: "no-store",
  }).catch(() => null)
  if (!r || !r.ok) return new Response("No encontrado", { status: 404 })
  return new Response(await r.arrayBuffer(), {
    headers: {
      "Content-Type": r.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
