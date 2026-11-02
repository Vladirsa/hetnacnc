import type { Metadata } from "next"

import { EstudioTorno } from "@/components/hetna/cam/torno/EstudioTorno"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  title: "Torno CNC 4 ejes: balaustres, patas y columnas | Laboratorio CAM",
  description:
    "Diseña piezas torneadas por segmentos y descarga el G-code para tu router CNC con eje rotativo (Mach3 / Mach4). Gratis y sin cuenta.",
}

// Sin guardia de sesión, igual que el flujo del DXF: se prueba gratis.
export default function TornoCncPage() {
  return (
    <main className="w-full bg-[#FAF9F6] min-h-[70vh]">
      <div className="px-4 lg:px-16 pt-6 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">
          Inicio
        </LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/herramientas-cnc" className="hover:text-[#B34D07]">
          Herramientas CNC
        </LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/herramientas-cnc#laboratorio-cam" className="hover:text-[#B34D07]">
          Laboratorio CAM
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Torno 4 ejes</span>
      </div>

      <section className="px-4 lg:px-16 pt-6 pb-16">
        <h1 className="text-[30px] lg:text-[40px] font-bold text-[#1B1B18] leading-[1.1] max-w-[820px]">
          Tornea balaustres, patas y columnas con tu router
        </h1>
        <p className="mt-3 text-[16px] text-[#4A4943] leading-relaxed max-w-[680px]">
          Arma la pieza por tramos, mira cómo queda y descarga el G-code para tu eje rotativo: escuadrado
          del bloque, desbaste y acabado en espiral. Gratis y sin crear cuenta.
        </p>

        <div className="mt-8 max-w-[1300px]">
          <EstudioTorno />
        </div>

        <p className="mt-10 text-[14px] text-[#4A4943] max-w-[760px]">
          ¿Tu pieza tiene tallados, estrías o viene en STL?{" "}
          <LocalizedClientLink href="/cam/lab" className="font-semibold text-[#B34D07] underline">
            Úsala en el laboratorio de 3, 4 y 5 ejes
          </LocalizedClientLink>
          .
        </p>
      </section>
    </main>
  )
}
