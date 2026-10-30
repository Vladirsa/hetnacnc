// Catálogo para Google Merchant Center (Shopping gratis, anuncios de Shopping y
// Performance Max). Merchant Center lo descarga solo cada día; ver
// lib/feeds/catalogo.ts.
import { armarCatalogo, catalogoXml } from "@/lib/feeds/catalogo"

// Se arma en cada descarga (es barato); los datos de la tienda vienen de la
// memoria de fetch, que dura una hora (lib/feeds/catalogo.ts). Así un fallo
// del backend nunca se queda guardado como respuesta.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { items } = await armarCatalogo()
    return new Response(catalogoXml(items, "HETNA CNC — Google"), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    })
  } catch (e) {
    // 503 y no un catálogo vacío: con uno vacío Google daría de baja todos los productos
    console.error("[feeds] google", e)
    return new Response("Catálogo no disponible por ahora", { status: 503, headers: { "Retry-After": "600" } })
  }
}
