import { redirect } from "next/navigation"

import { BarraCam } from "@/components/hetna/cam/BarraCam"
import { checkRegion } from "@/lib/helpers/check-region"

// CAM Studio: el CAM ocupa toda la pantalla, como un programa (igual que los
// estudios 3D y 2D de /disenar): sin el encabezado ni el pie del sitio, sólo
// su barra con los modos 2D, 3D y Torno. La explicación y los precios viven
// en /laboratorio-cam.
export default async function CamLayout({
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
      <BarraCam />
      <main id="contenido" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  )
}
