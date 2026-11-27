// /mx/cnc/<guía> — ver lib/seo/guias.ts
import { metaEnIdioma } from "@/i18n/servidor"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GuiaCnc } from "@/components/hetna/guias/GuiaCnc"
import { guiaPorSlug } from "@/lib/seo/guias"

type Props = { params: Promise<{ locale: string; guia: string }> }

// Las rutas que no existen dan 404 con notFound() (no se usa dynamicParams =
// false: el segmento [locale] no se genera en el build y todo daría 404).
export const revalidate = 3600


async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const g = guiaPorSlug((await params).guia)
  if (!g) return {}
  const url = `https://hetnacnc.com/mx/cnc/${g.slug}`
  return { title: g.titulo, description: g.descripcion, alternates: { canonical: url }, openGraph: { title: g.h1, description: g.descripcion, url } }
}

export default async function PaginaGuia({ params }: Props) {
  const g = guiaPorSlug((await params).guia)
  if (!g) notFound()
  return <GuiaCnc guia={g} />
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
