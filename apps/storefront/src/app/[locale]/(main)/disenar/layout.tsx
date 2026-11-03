import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { MigasDisenar } from "@/components/hetna/disenar/NavDisenar"

// Portada de Diseñar y catálogo de cajas. Sin menú lateral: las herramientas
// se abren en el 3D Studio y el 2D Studio, cada uno con su propia barra.
export default function DisenarLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full min-h-[70vh] bg-[#FAF9F6]">
      <div className="border-b border-[#E7E4DC] bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <MigasDisenar />
          <LocalizedClientLink href="/herramientas-cnc" className="hidden shrink-0 text-[13px] font-semibold text-[#B34D07] hover:underline sm:inline">
            Calculadoras y cotizador
          </LocalizedClientLink>
        </div>
      </div>
      {children}
    </main>
  )
}
