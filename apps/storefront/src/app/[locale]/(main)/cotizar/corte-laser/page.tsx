import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CalculadoraLead } from "@/components/hetna/cotizar/CalculadoraLead"
import { FranjaAyuda } from "@/components/hetna/ServicioPagina"

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: "https://hetnacnc.com/mx/cotizar/corte-laser" },
    title: "Costo de corte láser CNC | Cotiza en línea",
    description:
      "Calcula al instante el precio de tu corte láser en MDF, madera, acrílico, cuero o tela. Pon tus medidas y cantidad, y recibe el estimado por correo.",
  }
}

const MATERIALES = ["MDF delgado (hasta 2.5mm)", "MDF/Madera (3-5mm)", "Acrílico, cuero, tela u otro"]

export default async function CotizarCorteLaser() {
  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Cotizar corte láser</span>
      </div>

      <section className="px-4 lg:px-16 pt-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-10 flex flex-col gap-4">
          <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
            Corte láser
          </span>
          <h1 className="font-display text-[28px] lg:text-[38px] leading-[1.1] font-bold m-0 max-w-[560px]">
            ¿Cuánto cuesta cortar tu pieza en láser?
          </h1>
          <p className="m-0 text-[15px] lg:text-[16px] text-[#C9D2E0] max-w-[520px] leading-relaxed">
            Pon material, medidas y cantidad. Te damos un estimado al instante, sin subir archivo ni crear cuenta.
          </p>
        </div>
        <CalculadoraLead servicio="laser_co2" tituloServicio="corte láser" materiales={MATERIALES} servicioSolicitud="Corte láser" />
      </section>

      <div className="px-4 lg:px-16 pb-12">
        <FranjaAyuda />
      </div>
    </main>
  )
}
