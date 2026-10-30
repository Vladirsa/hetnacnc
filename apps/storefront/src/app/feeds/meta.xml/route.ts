// Catálogo para Meta (Facebook e Instagram: catálogo, etiquetas de productos y
// anuncios de catálogo Advantage+). El Administrador de ventas lo descarga solo
// cada hora o cada día; también sirve para TikTok y Pinterest, que leen el
// mismo formato. Ver lib/feeds/catalogo.ts.
import { armarCatalogo, catalogoXml } from "@/lib/feeds/catalogo"

// Se arma en cada descarga (es barato); los datos de la tienda vienen de la
// memoria de fetch, que dura una hora (lib/feeds/catalogo.ts). Así un fallo
// del backend nunca se queda guardado como respuesta.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { items } = await armarCatalogo()
    return new Response(catalogoXml(items, "HETNA CNC — Meta"), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    })
  } catch (e) {
    console.error("[feeds] meta", e)
    return new Response("Catálogo no disponible por ahora", { status: 503, headers: { "Retry-After": "600" } })
  }
}
