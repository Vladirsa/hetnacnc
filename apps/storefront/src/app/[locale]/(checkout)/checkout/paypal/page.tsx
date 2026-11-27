import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import { Suspense } from "react"

import { RetornoPayPal } from "./RetornoPayPal"

const metadataEs = {
  title: "Confirmando tu pago",
  robots: { index: false, follow: false },
}

export default function PaginaRetornoPayPal() {
  return (
    <Suspense fallback={<p className="text-center py-16"><TS>Confirmando tu pago…</TS></p>}>
      <RetornoPayPal />
    </Suspense>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
