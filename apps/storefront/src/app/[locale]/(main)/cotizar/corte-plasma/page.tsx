import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CalculadoraLead } from "@/components/hetna/cotizar/CalculadoraLead"
import { FranjaAyuda } from "@/components/hetna/ServicioPagina"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Costo de corte plasma CNC | Cotiza en línea",
    description:
      "Calcula al instante el precio de tu corte plasma en acero, inoxidable o aluminio. Pon medidas, calibre y cantidad, y recibe el estimado por correo.",
  }
}


export default async function CotizarCortePlasma() {
  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Cotizar corte plasma</span>
      </div>

      <section className="px-4 lg:px-16 pt-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-10 flex flex-col gap-4">
          <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
            Corte plasma
          </span>
          <h1 className="font-display text-[28px] lg:text-[38px] leading-[1.1] font-bold m-0 max-w-[560px]">
            ¿Cuánto cuesta cortar tu pieza en plasma?
          </h1>
          <p className="m-0 text-[15px] lg:text-[16px] text-[#C9D2E0] max-w-[520px] leading-relaxed">
            Pon material, calibre, medidas y cantidad. Te damos un estimado al instante, sin subir archivo ni crear cuenta.
          </p>
        </div>
        <CalculadoraLead
          servicio="plasma"
          tituloServicio="corte plasma"
          materiales={["Acero al carbón", "Acero inoxidable", "Aluminio"]}
          opcion={{
            campo: "calibre",
            etiqueta: "Grosor",
            valores: ["Lámina delgada (cal. 20 a 12)", "Placa (cal. 10 o más grueso)"],
          }}
          servicioSolicitud="Corte plasma"
        />
      </section>

      <div className="px-4 lg:px-16 pb-12">
        <FranjaAyuda />
      </div>
    </main>
  )
}
