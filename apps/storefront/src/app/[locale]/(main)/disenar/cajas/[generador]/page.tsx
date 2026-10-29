import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GeneradorCajas } from "@/components/hetna/disenar/GeneradorCajas"
import { esquemaCaja } from "@/lib/hetna/cajas"

// Una caja de Boxes.py abierta dentro del espacio Diseñar y escanear.
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; generador: string }> }

export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { generador } = await params
  const e = await esquemaCaja(generador)
  if (!e) return {}
  return {
    title: `${e.nombre}: generador gratis para láser y router CNC (DXF, SVG, PDF)`,
    description: `${e.descripcion || e.nombre}. Escribe tus medidas y el espesor del material y descarga gratis el archivo para corte láser o router CNC en DXF, SVG, PDF o LightBurn. O pide que un taller cercano te la corte.`,
    alternates: {
      canonical: `${SITIO}/mx/disenar/cajas/${e.id}`,
      languages: { "es-MX": `${SITIO}/mx/disenar/cajas/${e.id}`, "en-US": `${SITIO}/us/disenar/cajas/${e.id}` },
    },
  }
}

export default async function PaginaCaja({ params }: Props) {
  const { generador, locale } = await params
  const e = await esquemaCaja(generador)
  if (!e) notFound()
  return <GeneradorCajas esquema={e} locale={locale} />
}
