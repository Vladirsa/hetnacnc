import type { Metadata } from "next"

import { Calculadora } from "@/components/hetna/taller/Calculadora"
import { cargarPerfil, cargarServicios } from "@/lib/cotizador/acciones"

export const metadata: Metadata = {
  title: "Calculadora — HETNA CNC",
  description: "Tantea el precio de un trabajo con los costos de tu taller, sin guardar nada.",
}

export default async function TallerCalculadoraPage() {
  const [resServicios, resPerfil] = await Promise.all([cargarServicios(), cargarPerfil()])

  if (!resServicios.ok) {
    return (
      <section className="pt-10 max-w-[620px]">
        <h1 className="text-[24px] font-bold text-[#1B1B18]">No se pudo cargar la calculadora</h1>
        <p className="mt-2 text-[15px] text-[#4A4943]">{resServicios.mensaje}</p>
      </section>
    )
  }

  const moneda = (resPerfil.ok && resPerfil.datos.perfil?.moneda) || "MXN"

  return (
    <section className="pt-8">
      <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">Calculadora</h1>
      <p className="mt-2 text-[15px] text-[#4A4943] max-w-[640px] leading-relaxed">
        Para tantear un precio antes de armar la cotización. No guarda nada ni consume
        cupo del mes.
      </p>

      <Calculadora servicios={resServicios.datos.servicios} moneda={moneda} />
    </section>
  )
}
