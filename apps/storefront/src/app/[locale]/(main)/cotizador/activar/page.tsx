import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ActivarCotizador } from "@/components/hetna/cuenta/ActivarCotizador"
import { entradaCotizador } from "@/lib/cotizador/vinculo"
import { retrieveCustomer } from "@/lib/data/customer"

// Una sola cuenta: aquí llega el botón Cotizador cuando la cuenta de la tienda
// todavía no tiene taller en el Cotizador (o no ha confirmado su correo). Ver
// packages/api/src/lib/cotizador-vinculo.ts (entradaCotizador, activarCotizador).
export const metadata: Metadata = {
  title: "Activa tu Cotizador | HETNA CNC",
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function ActivarCotizadorPage() {
  const cliente = await retrieveCustomer()
  if (!cliente) redirect(`/login?volver=${encodeURIComponent("/api/app/entrar-cotizador")}`)

  const e = await entradaCotizador()
  // Ya tiene taller (vinculado o con el mismo correo): directo a la app
  if (e && "url" in e && e.url) redirect(e.url)

  const modo = !e ? "error" : "confirmar" in e ? "confirmar" : "activar" in e ? "activar" : "error"
  const sugerido = e && "activar" in e ? e.activar : { taller: "", telefono: "" }

  return (
    <main className="container py-8">
      <ActivarCotizador
        modo={modo}
        correo={cliente.email || ""}
        taller={sugerido.taller || cliente.company_name || ""}
        telefono={sugerido.telefono || cliente.phone || ""}
      />
    </main>
  )
}
