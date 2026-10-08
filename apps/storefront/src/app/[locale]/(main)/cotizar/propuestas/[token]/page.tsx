import type { Metadata } from "next"
import { notFound } from "next/navigation"

import ComparadorPropuestas from "@/components/hetna/taller/ComparadorPropuestas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { verSolicitud } from "@/lib/cotizar/solicitud-taller"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Mis propuestas",
  robots: { index: false, follow: false },
}

const ETIQUETAS: [string, string][] = [
  ["servicio", "Servicio"],
  ["material", "Material"],
  ["cantidad", "Cantidad"],
  ["medidas", "Medidas"],
  ["fecha", "Fecha requerida"],
  ["frecuencia", "Frecuencia"],
  ["presupuesto", "Presupuesto"],
]

export default async function PropuestasPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = await verSolicitud(token)
  if (!s) notFound()

  const t = s.trabajo || {}
  const entrega = [t.ciudad, t.estado_mx].filter(Boolean).join(", ")
  const cierra = s.cierra_en ? new Date(s.cierra_en).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : ""

  return (
    <main className="mx-auto w-full max-w-[1000px] px-4 pb-16 pt-8 lg:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]">Folio {s.folio}</p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#142033]">Propuestas para tu trabajo</h1>
      <p className="mt-2 text-[#6B675C]">
        {s.estado === "abierta"
          ? `Compara precio, tiempo y condiciones. ${s.modo === "abierta" && cierra ? `Los talleres pueden enviar propuestas hasta el ${cierra}.` : ""}`
          : "Ya elegiste una propuesta. HETNA te contactará para el pago y el seguimiento."}
      </p>

      <section className="mt-6 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-[#142033]">Tu solicitud</h2>
        <p className="mt-2 whitespace-pre-line text-[#40403A]">{t.descripcion}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {ETIQUETAS.filter(([k]) => t[k]).map(([k, label]) => (
            <div key={k}>
              <dt className="text-[#6B675C]">{label}</dt>
              <dd className="font-semibold text-[#142033]">{t[k]}</dd>
            </div>
          ))}
          {entrega && (
            <div>
              <dt className="text-[#6B675C]">Entrega en</dt>
              <dd className="font-semibold text-[#142033]">{entrega}</dd>
            </div>
          )}
        </dl>
      </section>

      <ComparadorPropuestas token={token} solicitud={s} />

      <p className="mt-8 text-center text-sm text-[#6B675C]">
        ¿Dudas? Escríbenos desde <LocalizedClientLink href="/contacto" className="text-[#C2560A] underline">Contacto</LocalizedClientLink> con tu folio {s.folio}.
      </p>
    </main>
  )
}
