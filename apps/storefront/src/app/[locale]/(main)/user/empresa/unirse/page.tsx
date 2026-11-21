import type { Metadata } from "next"

import { UnirseEmpresa } from "@/components/hetna/cuenta/UnirseEmpresa"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { miEquipo } from "@/lib/cotizar/solicitud-taller"

// Invitación a una empresa (lib/empresa-equipo.ts en la API): pide sesión con
// el mismo correo al que llegó la invitación.
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Unirme a mi empresa", robots: { index: false, follow: false } }

export default async function UnirsePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const { sesion } = await miEquipo()
  return (
    <main className="container">
      <div className="mx-auto max-w-[480px] py-16 text-center">
        <h1 className="text-[24px] font-bold text-[#1B1B18]">Unirme a mi empresa</h1>
        <div className="mt-4">
          {!token ? (
            <p className="text-[15px] text-[#4A4943]">La liga no trae invitación. Ábrela desde el correo que te llegó.</p>
          ) : !sesion ? (
            <>
              <p className="text-[15px] text-[#4A4943]">Entra (o crea tu cuenta) con el correo al que te llegó la invitación y vuelve a abrir la liga.</p>
              <LocalizedClientLink href="/login" className="mt-5 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white">
                Iniciar sesión
              </LocalizedClientLink>
            </>
          ) : (
            <UnirseEmpresa token={token} />
          )}
        </div>
      </div>
    </main>
  )
}
