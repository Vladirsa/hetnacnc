import { redirect } from "next/navigation"

import { BarraEstudio } from "@/components/hetna/estudio/BarraEstudio"
import { checkRegion } from "@/lib/helpers/check-region"

// Los estudios 3D y 2D ocupan toda la pantalla, como un programa: sin el
// encabezado ni el pie del sitio, sólo su barra con las herramientas.
export default async function EstudioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!(await checkRegion(locale))) return redirect("/")
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0D1015]">
      <BarraEstudio />
      <main id="contenido" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  )
}
