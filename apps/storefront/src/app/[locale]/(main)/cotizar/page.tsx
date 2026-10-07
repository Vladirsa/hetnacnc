import type { Metadata } from "next"

import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { tallerPorHandle } from "@/lib/hetna/talleres"

export const metadata: Metadata = {
  title: "Solicitar cotización CNC",
  description:
    "Cotiza corte láser, router CNC, grabado y maquinado con talleres de México. Describe tu trabajo y recibe tu cotización por correo.",
}

const CALCULADORAS = [
  {
    href: "/cotizar/corte-laser",
    titulo: "Corte láser",
    texto: "Precio estimado al instante para MDF, madera y acrílico.",
  },
  {
    href: "/cotizar/router-cnc",
    titulo: "Router CNC",
    texto: "Precio estimado al instante para corte en router.",
  },
]

export default async function CotizarPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>
}) {
  const { taller } = await searchParams
  const t = taller ? await tallerPorHandle(taller) : null

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-6">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Cotización</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#142033] sm:text-4xl">
            {t ? `Cotiza con ${t.nombre}` : "Solicita tu cotización"}
          </h1>
          <p className="mt-2 max-w-2xl text-[#6B675C]">
            Describe tu trabajo y te enviamos la cotización por correo. El pago y el envío se hacen
            dentro de HETNA, con Envíos HETNA.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <FormSolicitudTaller taller={t?.handle} nombreTaller={t?.nombre} />

          <aside className="grid content-start gap-4">
            <p className="text-sm font-semibold text-[#142033]">¿Quieres un precio al instante?</p>
            {CALCULADORAS.map((c) => (
              <LocalizedClientLink
                key={c.href}
                href={c.href}
                className="rounded-2xl border border-[#E7E4DC] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="font-bold text-[#142033]">{c.titulo} →</p>
                <p className="mt-1 text-sm text-[#6B675C]">{c.texto}</p>
              </LocalizedClientLink>
            ))}
            <LocalizedClientLink
              href="/talleres"
              className="rounded-2xl bg-[#142033] p-5 text-white transition hover:-translate-y-0.5"
            >
              <p className="font-bold">Ver directorio de talleres →</p>
              <p className="mt-1 text-sm text-white/70">Elige un taller por servicio, material o estado.</p>
            </LocalizedClientLink>
          </aside>
        </div>
      </div>
    </main>
  )
}
