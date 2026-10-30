// Qué entra al catálogo y qué se queda fuera (y por qué). Para revisarlo sin
// abrir Merchant Center ni el Administrador de ventas.
import { armarCatalogo } from "@/lib/feeds/catalogo"

// Se arma en cada descarga (es barato); los datos de la tienda vienen de la
// memoria de fetch, que dura una hora (lib/feeds/catalogo.ts). Así un fallo
// del backend nunca se queda guardado como respuesta.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { items, excluidos, moneda, generado } = await armarCatalogo()
    const motivos: Record<string, number> = {}
    for (const e of excluidos) motivos[e.motivo] = (motivos[e.motivo] || 0) + 1
    return Response.json({
      generado,
      moneda,
      en_catalogo: items.length,
      sin_existencia: items.filter((i) => !i.disponible).length,
      fuera_del_catalogo: excluidos.length,
      motivos,
      ejemplos_fuera: excluidos.slice(0, 30),
      catalogos: ["/feeds/google.xml", "/feeds/meta.xml"],
    })
  } catch (e) {
    return Response.json({ error: "No se pudo armar el catálogo" }, { status: 503 })
  }
}
