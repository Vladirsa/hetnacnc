import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import { UnirseEmpresa } from "@/components/hetna/cuenta/UnirseEmpresa"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { miEquipo } from "@/lib/cotizar/solicitud-taller"

// Invitación a una empresa (lib/empresa-equipo.ts en la API): pide sesión con
// el mismo correo al que llegó la invitación.
export const dynamic = "force-dynamic"
const metadataEs: Metadata = { title: "Unirme a mi empresa", robots: { index: false, follow: false } }

export default async function UnirsePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const { sesion } = await miEquipo()
  return (
    <main className="container">
      <div className="mx-auto max-w-[480px] py-16 text-center">
        <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>Unirme a mi empresa</TS></h1>
        <div className="mt-4">
          {!token ? (
            <p className="text-[15px] text-[#4A4943]"><TS>La liga no trae invitación. Ábrela desde el correo que te llegó.</TS></p>
          ) : !sesion ? (
            <>
              <p className="text-[15px] text-[#4A4943]"><TS>Entra (o crea tu cuenta) con el correo al que te llegó la invitación y vuelve a abrir la liga.</TS></p>
              <LocalizedClientLink href="/login" className="mt-5 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white">
                <TS>Iniciar sesión</TS>
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

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
