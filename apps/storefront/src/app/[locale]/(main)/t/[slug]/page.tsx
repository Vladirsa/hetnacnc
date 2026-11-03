import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CotizadorEnLinea } from "@/components/hetna/cotizacion/CotizadorEnLinea"
import { IMAGEN_OG, descripcionCorta } from "@/lib/helpers/seo"
import { leerTallerPublico } from "@/lib/cotizador/taller-publico"

// Cotizador en línea de un taller: el cliente sube su archivo, ve un precio
// estimado y manda su solicitud, que le llega al taller en su app.
// packages/api/src/lib/cotizador-en-linea.ts
type Props = { params: Promise<{ slug: string; locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const t = await leerTallerPublico(slug)
  if (!t) return { title: "Taller no encontrado", robots: { index: false, follow: false } }
  const servicios = t.servicios.map((s) => s.nombre).join(", ")
  const titulo = `${t.titulo} — cotiza en línea${t.ciudad ? ` en ${t.ciudad}` : ""}`
  const descripcion = descripcionCorta(
    t.descripcion || `Sube tu archivo DXF, SVG o STL y recibe tu cotización de ${servicios || "corte y fabricación CNC"} con ${t.nombre}.`
  )
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `https://hetnacnc.com/${locale}/t/${t.slug}` },
    openGraph: { title: titulo, description: descripcion, images: [t.logo || IMAGEN_OG] },
  }
}

export default async function TallerEnLineaPage({ params }: Props) {
  const { slug } = await params
  const taller = await leerTallerPublico(slug)
  if (!taller) notFound()
  return (
    <main className="container py-6 md:py-10">
      <CotizadorEnLinea taller={taller} />
    </main>
  )
}
