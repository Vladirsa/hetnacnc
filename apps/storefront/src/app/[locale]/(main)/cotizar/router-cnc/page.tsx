import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CalculadoraLead } from "@/components/hetna/cotizar/CalculadoraLead"
import { FranjaAyuda } from "@/components/hetna/ServicioPagina"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Precio de corte en Router CNC | Cotiza en línea",
    description:
      "Calcula al instante el precio de tu corte en router CNC: MDF, acrílico, pino, cedro y más. Pon tus medidas y cantidad, y recibe el estimado por correo.",
  }
}

const MATERIALES = ["MDF 3mm", "MDF 9mm", "MDF 15mm", "MDF 18mm", "Acrilico", "Pino", "Cedro", "Parota", "Encino", "Aluminio"]

export default async function CotizarRouterCnc() {
  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Cotizar router CNC</span>
      </div>

      <section className="px-4 lg:px-16 pt-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-10 flex flex-col gap-4">
          <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
            Router CNC
          </span>
          <h1 className="font-display text-[28px] lg:text-[38px] leading-[1.1] font-bold m-0 max-w-[560px]">
            ¿Cuánto cuesta tu corte en router CNC?
          </h1>
          <p className="m-0 text-[15px] lg:text-[16px] text-[#C9D2E0] max-w-[520px] leading-relaxed">
            Pon material, medidas y cantidad. Te damos un estimado al instante, sin subir archivo ni crear cuenta.
          </p>
        </div>
        <CalculadoraLead servicio="router" tituloServicio="router CNC" materiales={MATERIALES} servicioSolicitud="Corte CNC" />
      </section>

      <div className="px-4 lg:px-16 pb-12">
        <FranjaAyuda />
      </div>
    </main>
  )
}
