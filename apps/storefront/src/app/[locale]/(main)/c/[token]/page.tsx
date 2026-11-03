import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CotizacionPublicaVista } from "@/components/hetna/cotizacion/CotizacionPublicaVista"
import { leerCotizacionPublica } from "@/lib/cotizador/liga"

// Liga que el taller manda a su cliente desde el Cotizador: hetnacnc.com/c/<token>.
// El cliente ve la cotización, la acepta y paga el anticipo (a la cuenta de
// Mercado Pago del taller). Ver packages/api/src/lib/cotizacion-liga.ts.
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string; locale: string }>; searchParams: Promise<{ pago?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const c = await leerCotizacionPublica(token)
  return {
    title: c ? `Cotización ${c.folio} · ${c.taller.nombre}` : "Cotización",
    robots: { index: false, follow: false },
  }
}

export default async function CotizacionPublicaPage({ params, searchParams }: Props) {
  const { token } = await params
  const { pago } = await searchParams
  const c = await leerCotizacionPublica(token)
  if (!c) notFound()
  return (
    <main className="container py-6 md:py-10">
      <CotizacionPublicaVista token={token} inicial={c} pago={pago || ""} />
    </main>
  )
}
