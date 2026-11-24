import type { Metadata } from "next"

import { PaginaPais, metaPais } from "@/components/hetna/latam/PaginaPais"

// Pre-registro de España (fase 5.2 de la estrategia)
export const revalidate = 300

export const metadata: Metadata = metaPais("es")

export default function Page() {
  return <PaginaPais pais="es" />
}
