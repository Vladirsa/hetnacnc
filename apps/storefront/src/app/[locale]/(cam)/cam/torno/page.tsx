import type { Metadata } from "next"

import { EstudioTorno } from "@/components/hetna/cam/torno/EstudioTorno"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/cam/torno" },
  title: "CAM Studio Torno: balaustres, patas y columnas | HETNA",
  description:
    "Diseña piezas torneadas por segmentos y descarga el G-code para tu router CNC con eje rotativo (Mach3 / Mach4). Gratis y sin cuenta.",
}

// Sin guardia de sesión, igual que el flujo del DXF: se prueba gratis. El
// estudio del torno se pinta oscuro con el tema común (.tema-estudio).
export default function CamStudioTorno() {
  return (
    <div className="tema-estudio flex-1 px-3 py-4 lg:px-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="m-0 text-[16px] font-bold">
          Torno <span className="text-[#F28A3C]">4 ejes</span>{" "}
          <span className="text-[12.5px] font-normal text-[#8A97AB]">balaustres, patas y columnas con tu eje rotativo</span>
        </h1>
        <LocalizedClientLink href="/cam/lab" className="text-[12.5px] font-semibold text-[#F28A3C] hover:underline">
          ¿Tallados, estrías o STL? Usa el 3D →
        </LocalizedClientLink>
      </div>
      <EstudioTorno />
    </div>
  )
}
