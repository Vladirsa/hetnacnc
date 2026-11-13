import type { Metadata } from "next"
import { Suspense } from "react"

import { VisorDeLiga } from "@/components/hetna/visor/VisorDeLiga"

export const metadata: Metadata = {
  title: "Visor de planos y modelos",
  robots: { index: false, follow: false },
}

// /visor?u=<liga firmada>&n=<nombre>: abre un DXF, SVG, STL u OBJ del bucket
// privado en el visor. Lo usa el panel del taller para ver la pieza de una
// solicitud sin descargarla. La liga firmada dura una hora; el archivo se
// lee en el navegador y no pasa por el servidor.
export default function VisorPagina() {
  return (
    <Suspense fallback={null}>
      <VisorDeLiga />
    </Suspense>
  )
}
