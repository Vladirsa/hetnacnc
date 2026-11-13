// /sitemaps/<tipo>.xml — un archivo del mapa del sitio (lib/seo/mapa-sitio.ts).
import { ARCHIVOS_MAPA, type ArchivoMapa, entradasMapa, xmlUrlset } from "@/lib/seo/mapa-sitio"

export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return ARCHIVOS_MAPA.map((a) => ({ archivo: `${a}.xml` }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params
  const tipo = archivo.replace(/\.xml$/, "") as ArchivoMapa
  if (!ARCHIVOS_MAPA.includes(tipo)) return new Response("No existe", { status: 404 })
  const xml = xmlUrlset(await entradasMapa(tipo))
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
