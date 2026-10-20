import type { Metadata } from "next"

import DirectorioTalleres from "@/components/hetna/taller/DirectorioTalleres"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres } from "@/lib/hetna/talleres"

export const metadata: Metadata = {
  title: "Talleres CNC en México | HETNA CNC",
  description:
    "Encuentra talleres de corte, grabado y maquinado CNC en México. Compara capacidades, máquinas y materiales, y solicita cotización.",
}

export default async function TalleresPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const talleres = await listarTalleres()

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 lg:px-8">
      <header
        className="mb-8 overflow-hidden rounded-3xl bg-[#1B1B1B] p-8 text-white sm:p-12"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 28px)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#E8590C]">Directorio HETNA</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
          Talleres CNC en todo México
        </h1>
        <p className="mt-3 max-w-xl text-white/70">
          Elige un taller por capacidad, máquina o material. Pide cotización directa y recibe envío con Envíos HETNA.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink
            href="/cotizar"
            className="rounded-xl bg-[#E8590C] px-5 py-3 font-semibold text-white hover:brightness-110"
          >
            Cotizar mi pieza
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/user/register"
            className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Registrar mi taller
          </LocalizedClientLink>
        </div>
      </header>

      <DirectorioTalleres talleres={talleres} locale={locale} />
    </main>
  )
}
