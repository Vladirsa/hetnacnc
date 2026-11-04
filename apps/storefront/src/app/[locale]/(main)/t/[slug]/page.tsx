import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CotizadorEnLinea } from "@/components/hetna/cotizacion/CotizadorEnLinea"
import { IMAGEN_OG, descripcionCorta } from "@/lib/helpers/seo"
import { leerTallerPublico } from "@/lib/cotizador/taller-publico"
import { tiendaDeCotizador } from "@/lib/hetna/perfil-unico"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

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
  // Un solo perfil: si el taller también tiene perfil en la tienda, se liga.
  const tienda = await tiendaDeCotizador(slug)
  return (
    <main className="container py-6 md:py-10">
      {tienda && (
        <div className="mx-auto mb-4 flex max-w-[860px] flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E7E4DC] bg-[#FAF8F3] px-4 py-3 text-sm text-[#40403A]">
          <span>Conoce sus máquinas, trabajos, reseñas y productos.</span>
          <LocalizedClientLink href={`/talleres/${tienda}`} className="font-semibold text-[#C2560A] hover:underline">
            Ver perfil del taller →
          </LocalizedClientLink>
        </div>
      )}
      <CotizadorEnLinea taller={taller} />
    </main>
  )
}
