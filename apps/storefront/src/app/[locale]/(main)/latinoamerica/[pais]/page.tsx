import { metaEnIdioma } from "@/i18n/servidor"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import { PaginaPais, metaPais } from "@/components/hetna/latam/PaginaPais"
import { paisPorClave, rutaPais } from "@/components/hetna/latam/paises"

// Pre-registro por país (fase 5). España y EUA tienen dirección propia
// (/espana, /estados-unidos): la de aquí redirige.
export const revalidate = 300

type Props = { params: Promise<{ pais: string; locale: string }> }

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const { pais } = await params
  return metaPais(pais)
}

export default async function PaisLatamPage({ params }: Props) {
  const { pais } = await params
  if (!paisPorClave(pais)) notFound()
  if (pais === "es" || pais === "us") permanentRedirect(rutaPais(pais))
  return <PaginaPais pais={pais} />
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
