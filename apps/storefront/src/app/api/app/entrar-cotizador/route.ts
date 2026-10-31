import { ligaEntradaCotizador } from "@/lib/cotizador/vinculo"

// Botón "Cotizador" de la tienda. Si la cuenta está vinculada con un taller
// del Cotizador, entra a la app con la sesión ya iniciada (liga de un solo uso
// de Supabase, ver packages/api/src/lib/cotizador-vinculo.ts). Si no, abre la
// app normal, que pide su inicio de sesión, y le pasa la huella del correo para
// que cierre la sesión de otra persona que haya quedado en ese navegador (ver
// ligaEntradaCotizador). La dirección va relativa para no depender del host
// interno detrás de nginx.
export const dynamic = "force-dynamic"

export async function GET() {
  const liga = await ligaEntradaCotizador().catch(() => "/cotizador/")
  return new Response(null, {
    status: 302,
    headers: { Location: liga, "Cache-Control": "no-store" },
  })
}
