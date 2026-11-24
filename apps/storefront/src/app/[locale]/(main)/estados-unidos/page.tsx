import type { Metadata } from "next"

import { PaginaPais, metaPais } from "@/components/hetna/latam/PaginaPais"

// Pre-registro de Estados Unidos (hispanos) (fase 5.2 de la estrategia)
export const revalidate = 300

export const metadata: Metadata = metaPais("us")

export default function Page() {
  return <PaginaPais pais="us" />
}
