import type { Metadata } from "next"

import { CotizadorCliente } from "@/components/hetna/cotizador/CotizadorCliente"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { retrieveCustomer } from "@/lib/data/customer"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Cotizar una pieza",
  description: "Sube tu archivo, ve tu pieza y recibe un estimado al instante; después pide propuestas reales a talleres CNC verificados.",
  robots: { index: false, follow: false },
}

export default async function CotizarClientePage() {
  const customer = await retrieveCustomer()
  const nombre = customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : undefined

  return (
    <section className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1B1B18]">Cotizar una pieza</h1>
          <p className="mt-1 max-w-[640px] text-[15px] text-[#4A4943]">
            Sube tu archivo, ve la pieza y conoce un estimado al instante. Cuando quieras el precio real, pídelo a los talleres
            verificados: ellos te mandan su propuesta y tú eliges.
          </p>
        </div>
        <LocalizedClientLink href="/user/solicitudes" className="text-sm font-semibold text-[#C2560A] hover:underline">
          Ver mis solicitudes →
        </LocalizedClientLink>
      </div>
      <div className="mt-6">
        <CotizadorCliente email={customer?.email} nombre={nombre} />
      </div>
    </section>
  )
}
