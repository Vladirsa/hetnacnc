import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { Suspense } from "react"

import { RetornoPagoCreditos } from "./RetornoPagoCreditos"

// Mercado Pago y PayPal regresan aquí después de pagar un paquete de créditos.
const metadataEs: Metadata = {
  title: "Pago de créditos",
  robots: { index: false, follow: false },
}

export default function PagoCreditosPage() {
  return (
    <Suspense fallback={<main className="container py-16 text-center"><TS>Cargando…</TS></main>}>
      <RetornoPagoCreditos />
    </Suspense>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
