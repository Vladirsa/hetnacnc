import type { Metadata } from "next"
import { Suspense } from "react"

import { RetornoPagoCreditos } from "./RetornoPagoCreditos"

// Mercado Pago y PayPal regresan aquí después de pagar un paquete de créditos.
export const metadata: Metadata = {
  title: "Pago de créditos",
  robots: { index: false, follow: false },
}

export default function PagoCreditosPage() {
  return (
    <Suspense fallback={<main className="container py-16 text-center">Cargando…</main>}>
      <RetornoPagoCreditos />
    </Suspense>
  )
}
