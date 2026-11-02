import type { Metadata } from "next"

import DirectorioTalleres from "@/components/hetna/taller/DirectorioTalleres"
import ParaTalleres from "@/components/hetna/taller/ParaTalleres"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres } from "@/lib/hetna/talleres"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/talleres" },
  title: "Talleres CNC en México",
  description:
    "Encuentra talleres de corte, grabado y maquinado CNC en México y pide cotización. ¿Tienes taller? Únete gratis a HETNA y recibe solicitudes de trabajo.",
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
        className="mb-8 overflow-hidden rounded-3xl bg-[#142033] p-8 text-white sm:p-12"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 28px)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#C2560A]">Directorio HETNA</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
          Talleres CNC en todo México
        </h1>
        <p className="mt-3 max-w-xl text-white/70">
          Elige un taller por capacidad, máquina o material. Pide cotización directa y recibe envío con Envíos HETNA.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink
            href="/cotizar"
            className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110"
          >
            Cotizar mi pieza
          </LocalizedClientLink>
          <a
            href="#directorio"
            className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Ver talleres
          </a>
          <a
            href="#para-talleres"
            className="rounded-xl border border-[#F2A25F] px-5 py-3 font-semibold text-[#F2A25F] hover:bg-white/10"
          >
            Tengo un taller
          </a>
        </div>
      </header>

      {/* La otra mitad de quien llega aquí: dueños de taller. */}
      <a
        href="#para-talleres"
        className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[#C2560A] bg-[#FDEEE1] p-5 transition hover:shadow-md sm:p-6"
      >
        <span>
          <span className="block text-lg font-extrabold text-[#142033]">¿Tienes un taller CNC? Lleva tu taller a más clientes</span>
          <span className="block text-sm text-[#44433D]">
            Únete gratis a la red HETNA y recibe solicitudes de fabricación, corte, maquila y producción de todo México.
          </span>
        </span>
        <span className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white">Registrar mi taller →</span>
      </a>

      <div id="directorio" className="scroll-mt-24" />

      <DirectorioTalleres talleres={talleres} locale={locale} />

      {/* Para dueños de taller: cómo funciona, beneficios, perfiles,
          preguntas y registro, aquí mismo (la versión completa vive en
          /talleres/unete). */}
      <div id="para-talleres" className="mt-16 scroll-mt-24 border-t-4 border-[#C2560A] pt-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Para talleres</p>
        <h2 className="mt-1 text-3xl font-extrabold text-[#142033] sm:text-4xl">Lleva tu taller a más clientes</h2>
        <p className="mt-2 max-w-2xl text-[#6B675C]">
          Únete gratis a la red HETNA y recibe solicitudes de fabricación, corte, maquila y producción CNC de todo México.
        </p>
        <ParaTalleres />
      </div>
    </main>
  )
}
