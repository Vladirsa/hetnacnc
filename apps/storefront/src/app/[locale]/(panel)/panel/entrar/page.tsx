import { redirect } from "next/navigation"

import { usuarioPanel } from "@/lib/panel/sesion"
import { FormEntrar } from "@/components/hetna/panel/FormEntrar"

export default async function EntrarPanel({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (await usuarioPanel()) redirect(`/${locale}/panel`)
  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#C2560A] text-xl font-black">H</span>
        <div>
          <h1 className="text-2xl font-extrabold leading-none">HETNA Panel</h1>
          <p className="mt-1 text-sm text-white/70">Sólo para el equipo de HETNA</p>
        </div>
      </div>
      <FormEntrar destino={`/${locale}/panel`} />
      <p className="mt-8 text-xs text-white/50">Entra con tu cuenta de administrador de hetnacnc.com. Para tenerlo como app: en el celular, menú del navegador → "Agregar a la pantalla de inicio".</p>
    </div>
  )
}
