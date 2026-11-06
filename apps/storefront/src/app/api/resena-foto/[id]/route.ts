// Foto de una reseña publicada (packages/api/src/lib/resena-fotos.ts). El
// backend sólo la entrega si la reseña ya pasó la moderación.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^rfoto_[a-f0-9]{24}$/.test(id)) return new Response("No encontrada", { status: 404 })
  const r = await fetch(`${MEDUSA_BACKEND_URL}/store/resenas/fotos/${id}`, {
    headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
    next: { revalidate: 86400 },
  }).catch(() => null)
  if (!r || !r.ok) return new Response("No encontrada", { status: 404 })
  return new Response(await r.arrayBuffer(), {
    headers: {
      "Content-Type": r.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
