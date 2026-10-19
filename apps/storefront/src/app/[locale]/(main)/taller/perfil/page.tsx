import type { Metadata } from "next"

import { FormPerfilTaller } from "@/components/hetna/taller/FormPerfilTaller"
import { cargarPerfil } from "@/lib/cotizador/acciones"

export const metadata: Metadata = {
  title: "Mi taller — HETNA CNC",
  description: "Los datos y los costos con los que se arman tus cotizaciones.",
}

export default async function TallerPerfilPage() {
  const res = await cargarPerfil()

  if (!res.ok) {
    return (
      <section className="pt-10 max-w-[620px]">
        <h1 className="text-[24px] font-bold text-[#1B1B18]">No se pudo cargar tu taller</h1>
        <p className="mt-2 text-[15px] text-[#4A4943]">{res.mensaje}</p>
      </section>
    )
  }

  const { perfil, costos_referencia } = res.datos

  return (
    <section className="pt-8">
      <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">
        {perfil ? "Mi taller" : "Da de alta tu taller"}
      </h1>
      <p className="mt-2 text-[15px] text-[#4A4943] max-w-[640px] leading-relaxed">
        {perfil
          ? "Estos datos salen impresos en cada cotización, y tus costos por hora son los que usa la calculadora."
          : "Con el nombre basta para empezar. Los costos los puedes capturar después, pero hasta que lo hagas los precios salen con valores de referencia."}
      </p>

      <FormPerfilTaller perfil={perfil} referencia={costos_referencia} />
    </section>
  )
}
