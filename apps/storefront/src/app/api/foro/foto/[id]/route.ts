// Mostrar una foto del foro (se guarda en caché un año: la foto nunca cambia)
import { foto } from "@/lib/foro/consultas"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const f = await foto(id)
  if (!f) return new Response("No encontrada", { status: 404 })
  return new Response(new Uint8Array(f.datos), {
    headers: {
      "Content-Type": f.tipo,
      "Content-Length": String(f.datos.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
