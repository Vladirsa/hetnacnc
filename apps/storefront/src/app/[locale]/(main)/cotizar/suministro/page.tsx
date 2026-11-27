import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import { DIAS_SOLICITUD_ABIERTA } from "@/lib/hetna/promesas"
import type { Metadata } from "next"

import FormSuministro from "@/components/hetna/taller/FormSuministro"

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/cotizar/suministro" },
  title: "Cotiza material e insumos CNC con proveedores",
  description:
    "Pide cotización de lámina, MDF, acrílico, fresas, refacciones y consumibles CNC a proveedores de México. Compara precios y tiempos de entrega gratis.",
}

// Licitación de suministro (Licitaciones 3.0, Fase 2)
export default function SuministroPage() {
  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 lg:px-6">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#1E7B3A]"><TS>Suministro</TS></p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#142033] sm:text-4xl"><TS>Cotiza material e insumos con proveedores</TS></h1>
          <p className="mt-2 max-w-2xl text-[#6B675C]">
            <TS>Dinos qué necesitas y cuánto. Los proveedores de HETNA te mandan su precio, tiempo de entrega y condiciones durante</TS> {DIAS_SOLICITUD_ABIERTA} <TS>días. Te llega
            una liga por correo para compararlas y elegir.</TS>
          </p>
        </header>
        <FormSuministro />
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
