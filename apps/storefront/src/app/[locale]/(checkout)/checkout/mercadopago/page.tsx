import { Suspense } from "react"

import { RetornoMercadoPago } from "./RetornoMercadoPago"

export const metadata = {
  title: "Confirmando tu pago",
  robots: { index: false, follow: false },
}

export default function PaginaRetornoMercadoPago() {
  return (
    <Suspense fallback={<p className="text-center py-16">Confirmando tu pago…</p>}>
      <RetornoMercadoPago />
    </Suspense>
  )
}
