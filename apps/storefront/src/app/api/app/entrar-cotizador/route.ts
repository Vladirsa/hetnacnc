import { ligaEntradaCotizador } from "@/lib/cotizador/vinculo"

// Botón "Cotizador" de la tienda (y "Entrar con mi cuenta de hetnacnc.com" de
// la app). Una sola cuenta: entra a la app con la sesión ya iniciada (liga de
// un solo uso de Supabase), o manda a iniciar sesión o a activar el Cotizador;
// ver ligaEntradaCotizador y packages/api/src/lib/cotizador-vinculo.ts. La
// dirección va relativa para no depender del host interno detrás de nginx.
export const dynamic = "force-dynamic"

export async function GET() {
  const liga = await ligaEntradaCotizador().catch(() => "/cotizador/")
  return new Response(null, {
    status: 302,
    headers: { Location: liga, "Cache-Control": "no-store" },
  })
}
