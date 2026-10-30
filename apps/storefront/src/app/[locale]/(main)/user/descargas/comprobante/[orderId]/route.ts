// Pasa el comprobante PDF del backend al navegador con la sesión del cliente
// (la cookie no viaja al backend directo desde el navegador).
import { getAuthHeaders } from "@/lib/data/cookies"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return new Response("Pedido no válido", { status: 400 })
  const auth = (await getAuthHeaders()) as Record<string, string>
  if (!auth.authorization) return new Response("Inicia sesión para descargar tu comprobante", { status: 401 })
  const res = await fetch(`${API}/store/customers/me/descargas/comprobante/${orderId}`, {
    headers: { "x-publishable-api-key": PK, ...auth },
    cache: "no-store",
  })
  if (!res.ok) return new Response("No encontramos ese comprobante en tu cuenta", { status: res.status === 404 ? 404 : 502 })
  return new Response(await res.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": res.headers.get("content-disposition") || 'attachment; filename="HETNA-entrega.pdf"',
      "Cache-Control": "private, no-store",
    },
  })
}
