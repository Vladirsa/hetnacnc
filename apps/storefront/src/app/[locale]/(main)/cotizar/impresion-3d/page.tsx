import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CalculadoraLead } from "@/components/hetna/cotizar/CalculadoraLead"
import { FranjaAyuda } from "@/components/hetna/ServicioPagina"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Costo de impresión 3D | Cotiza en línea — HETNA CNC",
    description:
      "Calcula al instante el precio de tu pieza impresa en 3D en PLA, PETG, ABS o TPU. Pon medidas, material y calidad, y recibe el estimado por correo.",
  }
}


export default async function CotizarImpresion3d() {
  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Cotizar impresión 3D</span>
      </div>

      <section className="px-4 lg:px-16 pt-5 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-[#142033] text-white rounded-[18px] p-6 lg:p-10 flex flex-col gap-4">
          <span className="self-start text-[12px] font-bold tracking-wide uppercase bg-[#C2560A] px-3 py-1 rounded-full">
            Impresión 3D
          </span>
          <h1 className="font-display text-[28px] lg:text-[38px] leading-[1.1] font-bold m-0 max-w-[560px]">
            ¿Cuánto cuesta imprimir tu pieza en 3D?
          </h1>
          <p className="m-0 text-[15px] lg:text-[16px] text-[#C9D2E0] max-w-[520px] leading-relaxed">
            Pon las medidas de tu pieza (largo, ancho y alto), el material y la calidad. Te damos un estimado al instante, sin subir archivo ni crear cuenta.
          </p>
        </div>
        <CalculadoraLead
          servicio="impresion_3d"
          tituloServicio="impresión 3D"
          materiales={["PLA", "PETG", "ABS", "TPU (flexible)"]}
          pideAlto
          opcion={{
            campo: "calidad",
            etiqueta: "Calidad",
            valores: ["Prototipo rápido", "Pieza funcional", "Alta calidad"],
            inicial: "Pieza funcional",
          }}
          servicioSolicitud="Impresión 3D"
        />
      </section>

      <div className="px-4 lg:px-16 pb-12">
        <FranjaAyuda />
      </div>
    </main>
  )
}
