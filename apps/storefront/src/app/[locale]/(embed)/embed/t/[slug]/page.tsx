import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AjusteAltura } from "@/components/hetna/cotizacion/AjusteAltura"
import { CotizadorEnLinea } from "@/components/hetna/cotizacion/CotizadorEnLinea"
import { leerTallerPublico } from "@/lib/cotizador/taller-publico"

// Widget: el cotizador en línea del taller para pegar en su página web o en
// Facebook (iframe). Se arma con hetnacnc.com/widget/cotizador.js o con el
// código de /t/<slug>/compartir. next.config.ts permite mostrar /embed/* en
// cualquier sitio (frame-ancestors).
type Props = { params: Promise<{ slug: string; locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const t = await leerTallerPublico(slug)
  return {
    title: t ? `Cotiza con ${t.nombre}` : "Cotizador",
    robots: { index: false, follow: false },
    alternates: t ? { canonical: `https://hetnacnc.com/mx/t/${t.slug}` } : undefined,
  }
}

export default async function WidgetCotizador({ params }: Props) {
  const { slug } = await params
  const taller = await leerTallerPublico(slug)
  if (!taller) notFound()
  return (
    <>
      <AjusteAltura slug={taller.slug} />
      <CotizadorEnLinea taller={taller} widget />
    </>
  )
}
