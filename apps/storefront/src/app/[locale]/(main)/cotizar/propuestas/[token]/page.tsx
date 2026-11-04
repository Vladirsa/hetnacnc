import type { Metadata } from "next"
import { notFound } from "next/navigation"

import ComparadorPropuestas from "@/components/hetna/taller/ComparadorPropuestas"
import PreguntasSolicitud from "@/components/hetna/taller/PreguntasSolicitud"
import ResenaTaller from "@/components/hetna/taller/ResenaTaller"
import SeguimientoSolicitud from "@/components/hetna/taller/SeguimientoSolicitud"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { verSolicitud } from "@/lib/cotizar/solicitud-taller"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Mis propuestas",
  robots: { index: false, follow: false },
}

const ETIQUETAS: [string, string][] = [
  ["necesidad", "Necesitas"],
  ["servicio", "Servicio"],
  ["material", "Material"],
  ["cantidad", "Cantidad"],
  ["medidas", "Medidas"],
  ["acabado", "Acabado"],
  ["tolerancia", "Tolerancia"],
  ["fecha", "Fecha requerida"],
  ["frecuencia", "Frecuencia"],
  ["presupuesto", "Presupuesto"],
]

export default async function PropuestasPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ pago?: string }>
}) {
  const { token } = await params
  const { pago } = await searchParams
  const s = await verSolicitud(token)
  if (!s) notFound()

  const t = s.trabajo || {}
  const archivos = s.trabajo?.archivos || []
  const entrega = [t.ciudad, t.estado_mx].filter(Boolean).join(", ")
  const cierra = s.cierra_en ? new Date(s.cierra_en).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : ""

  return (
    <main className="mx-auto w-full max-w-[1000px] px-4 pb-16 pt-8 lg:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]">Folio {s.folio}</p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#142033]">Tu solicitud de fabricación</h1>
      <p className="mt-2 text-[#6B675C]">
        {s.estado === "revision"
          ? "Estamos revisando tu solicitud. En cuanto la aprobemos la enviamos a los talleres y te avisamos por correo."
          : s.estado === "cerrada"
            ? s.etapa_explica || "Esta solicitud está cerrada."
            : s.estado === "abierta"
          ? `Compara precio, tiempo y condiciones. ${s.modo === "abierta" && cierra ? `Los talleres pueden enviar propuestas hasta el ${cierra}.` : ""}`
          : s.pago_estado === "pagado"
            ? s.etapa_explica || "Pago recibido. El taller está fabricando tu pedido."
            : "Ya elegiste una propuesta. Completa tu pago para que el taller empiece."}
      </p>

      {pago === "ok" && (
        <p className="mt-4 rounded-xl bg-[#E6F4EA] p-3 text-sm font-semibold text-[#1E7B3A]">
          ¡Gracias! Recibimos tu pago. En unos minutos se refleja aquí.
        </p>
      )}
      {pago === "pendiente" && (
        <p className="mt-4 rounded-xl bg-[#FFF1E6] p-3 text-sm font-semibold text-[#C2560A]">
          Tu pago está en proceso. Te avisamos por correo en cuanto se confirme.
        </p>
      )}
      {pago === "error" && (
        <p className="mt-4 rounded-xl bg-[#FDECEA] p-3 text-sm font-semibold text-[#B3261E]">
          El pago no se completó. Puedes intentarlo de nuevo abajo.
        </p>
      )}

      <ResenaTaller token={token} s={s} />

      <SeguimientoSolicitud token={token} s={s} />

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
        {archivos.length > 0 && (
          <p className="mt-4 text-sm text-[#6B675C]">
            Archivos que subiste: <span className="font-semibold text-[#142033]">{archivos.map((a) => a.nombre).join(", ")}</span>
          </p>
        )}
      </section>

      <PreguntasSolicitud token={token} preguntas={s.preguntas || []} abierta={s.estado === "abierta"} />

      {s.estado !== "revision" && <ComparadorPropuestas token={token} solicitud={s} />}

      <p className="mt-8 text-center text-sm text-[#6B675C]">
        ¿Dudas? Escríbenos desde <LocalizedClientLink href="/contacto" className="text-[#C2560A] underline">Contacto</LocalizedClientLink> con tu folio {s.folio}.
      </p>
    </main>
  )
}
