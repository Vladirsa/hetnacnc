import { metaEnIdioma } from "@/i18n/servidor"
import type { Metadata } from "next"

import { PaginaPais, metaPais } from "@/components/hetna/latam/PaginaPais"

// Pre-registro de España (fase 5.2 de la estrategia)
export const revalidate = 300

const metadataEs: Metadata = metaPais("es")

export default function Page() {
  return <PaginaPais pais="es" />
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
