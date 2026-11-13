// Índice del mapa del sitio: apunta a un archivo por tipo (lib/seo/mapa-sitio.ts).
// Misma dirección que antes (/sitemap.xml), así Search Console no cambia.
import { xmlIndice } from "@/lib/seo/mapa-sitio"

export const revalidate = 3600

export function GET() {
  return new Response(xmlIndice(), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
