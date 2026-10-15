import { Suspense } from "react"

import { RetornoPayPal } from "./RetornoPayPal"

export const metadata = {
  title: "Confirmando tu pago",
  robots: { index: false, follow: false },
}

export default function PaginaRetornoPayPal() {
  return (
    <Suspense fallback={<p className="text-center py-16">Confirmando tu pago…</p>}>
      <RetornoPayPal />
    </Suspense>
  )
}
