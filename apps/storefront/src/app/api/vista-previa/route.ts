// Modelo de muestra de un producto para el visor 3D de la ficha
// (lib/hetna/ficha-tecnica.ts). Pasa por aquí para no depender del CORS del
// almacenamiento, y sólo trae archivos STL/OBJ/DXF/SVG de los dominios propios.
import { EXT_VISTA, urlPropia } from "@/lib/hetna/ficha-tecnica"

const MAX_BYTES = 15 * 1024 * 1024

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") || ""
  if (!urlPropia(u) || !EXT_VISTA.test(u.split(/[?#]/)[0])) return new Response("No permitido", { status: 400 })
  const r = await fetch(u, { next: { revalidate: 86400 } }).catch(() => null)
  if (!r || !r.ok) return new Response("No encontrado", { status: 404 })
  if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) return new Response("Muy grande", { status: 413 })
  const datos = await r.arrayBuffer()
  if (datos.byteLength > MAX_BYTES) return new Response("Muy grande", { status: 413 })
  return new Response(datos, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
