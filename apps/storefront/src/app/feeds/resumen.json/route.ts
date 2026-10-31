// Qué entra al catálogo y qué se queda fuera (y por qué). Para revisarlo sin
// abrir Merchant Center ni el Administrador de ventas. Por omisión el de
// Google; ?catalogo=meta el de Meta (que lleva los diseños descargables).
import { armarCatalogo } from "@/lib/feeds/catalogo"

// Se arma en cada descarga (es barato); los datos de la tienda vienen de la
// memoria de fetch, que dura una hora (lib/feeds/catalogo.ts). Así un fallo
// del backend nunca se queda guardado como respuesta.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const meta = new URL(req.url).searchParams.get("catalogo") === "meta"
  try {
    const { items, excluidos, moneda, generado } = await armarCatalogo({
      digitales: meta && process.env.FEED_META_DIGITALES !== "0",
    })
    const motivos: Record<string, number> = {}
    for (const e of excluidos) motivos[e.motivo] = (motivos[e.motivo] || 0) + 1
    return Response.json({
      catalogo: meta ? "meta" : "google",
      generado,
      moneda,
      en_catalogo: items.length,
      sin_existencia: items.filter((i) => !i.disponible).length,
      fuera_del_catalogo: excluidos.length,
      motivos,
      ejemplos_fuera: excluidos.slice(0, 30),
      en_catalogo_ejemplos: items.slice(0, 30).map((i) => ({ id: i.id, titulo: i.titulo, precio: i.precio, disponible: i.disponible })),
      catalogos: ["/feeds/google.xml", "/feeds/meta.xml"],
    })
  } catch (e) {
    return Response.json({ error: "No se pudo armar el catálogo" }, { status: 503 })
  }
}
