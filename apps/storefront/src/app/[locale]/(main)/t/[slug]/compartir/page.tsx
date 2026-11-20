import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CompartirCotizador } from "@/components/hetna/cotizacion/CompartirCotizador"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { leerTallerPublico } from "@/lib/cotizador/taller-publico"
import { svgQR } from "@/lib/generador/qr"

// /t/<slug>/compartir: liga, QR y código para poner el cotizador del taller en
// su página web (estrategia 2.3). Nada aquí es privado (la liga ya es pública);
// las estadísticas se ven en la app, en Mi página en línea.
type Props = { params: Promise<{ slug: string; locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const t = await leerTallerPublico(slug)
  return { title: t ? `Comparte el cotizador de ${t.nombre}` : "Compartir cotizador", robots: { index: false, follow: false } }
}

export default async function CompartirPage({ params }: Props) {
  const { slug } = await params
  const t = await leerTallerPublico(slug)
  if (!t) notFound()
  const liga = `https://hetnacnc.com/t/${t.slug}`
  return (
    <main className="container max-w-[860px] py-6 md:py-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Tu cotizador en línea</p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#142033]">Comparte el cotizador de {t.nombre}</h1>
      <p className="mt-2 text-[#40403A]">
        Cada cliente que cotiza aquí te llega a la app con sus medidas, su archivo revisado y su precio estimado. Entre más lugares tenga tu liga, más solicitudes recibes.
      </p>
      <p className="mb-6 mt-2 text-sm">
        <LocalizedClientLink href={`/t/${t.slug}`} className="font-semibold text-[#C2560A] hover:underline">
          Ver mi cotizador →
        </LocalizedClientLink>
      </p>
      <CompartirCotizador liga={liga} slug={t.slug} nombre={t.nombre} qrSvg={svgQR(liga, 220)} />
    </main>
  )
}
