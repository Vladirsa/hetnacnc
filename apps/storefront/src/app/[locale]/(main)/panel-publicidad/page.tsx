// Panel privado para administrar banners y publicidad.
// Dirección: https://hetnacnc.com/mx/panel-publicidad  (mismo usuario y contraseña del /dashboard)
import type { Metadata } from "next"

import PanelPublicidad from "@/components/hetna/publicidad/PanelPublicidad"
import { esAdmin } from "@/lib/publicidad/sesion"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Panel de publicidad",
  robots: { index: false, follow: false },
}

export default async function PaginaPanelPublicidad() {
  const autenticado = await esAdmin()
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6">
      <PanelPublicidad autenticadoInicial={autenticado} />
    </main>
  )
}
