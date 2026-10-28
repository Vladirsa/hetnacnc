import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { diasRestantes, lugarTrabajo, tituloTrabajo, trabajoPorFolio, type TrabajoPublico } from "@/lib/trabajos/datos"

export const revalidate = 120

export async function generateMetadata({
  params,
}: {
  params: Promise<{ folio: string }>
}): Promise<Metadata> {
  const { folio } = await params
  const t = await trabajoPorFolio(folio)
  if (!t) return { title: "Trabajo no encontrado", robots: { index: false } }
  const lugar = lugarTrabajo(t)
  return {
    title: `${tituloTrabajo(t)}${lugar ? ` en ${lugar}` : ""} · ${t.folio}`,
    description: t.descripcion.slice(0, 155),
    // Un trabajo cerrado ya no le sirve a nadie que llegue de Google: se
    // sigue viendo (para no romper ligas compartidas) pero sale del índice.
    robots: t.estado === "abierta" ? { index: true, follow: true } : { index: false, follow: true },
  }
}

const DETALLES: [keyof TrabajoPublico, string][] = [
  ["servicio", "Servicio"],
  ["material", "Material"],
  ["cantidad", "Cantidad"],
  ["medidas", "Medidas"],
  ["fecha", "Lo necesita para"],
  ["frecuencia", "Frecuencia"],
  ["acepta_envio", "Acepta envío por paquetería"],
]

export default async function TrabajoPage({ params }: { params: Promise<{ folio: string }> }) {
  const { folio } = await params
  const t = await trabajoPorFolio(folio)
  if (!t) notFound()

  const dias = diasRestantes(t)
  const lugar = lugarTrabajo(t)
  const abierta = t.estado === "abierta"

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-8">
      <LocalizedClientLink href="/trabajos" className="text-sm font-semibold text-[#C2560A]">
        ← Todos los trabajos abiertos
      </LocalizedClientLink>

      <article className="mt-3 rounded-3xl border border-[#E7E4DC] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-[#6B675C]">{t.folio}</span>
          {abierta ? (
            <span className="rounded-full bg-[#EEF6EE] px-2.5 py-0.5 font-bold text-[#1F5A2B]">
              {dias === 0 ? "Recibe propuestas hasta hoy" : `Recibe propuestas ${dias === 1 ? "1 día más" : `${dias} días más`}`}
            </span>
          ) : (
            <span className="rounded-full bg-[#F3F1EA] px-2.5 py-0.5 font-bold text-[#6B675C]">
              {t.estado === "asignada" ? "El cliente ya eligió taller" : "Ya no recibe propuestas"}
            </span>
          )}
          <span className="text-[#6B675C]">· {t.propuestas === 1 ? "1 propuesta" : `${t.propuestas} propuestas`}</span>
        </div>

        <h1 className="mt-2 text-2xl font-extrabold leading-snug text-[#142033] sm:text-3xl">{tituloTrabajo(t)}</h1>
        {lugar && <p className="mt-1 text-[#6B675C]">📍 Entrega en {lugar}</p>}

        <p className="mt-5 whitespace-pre-line text-[#2B2A26]">{t.descripcion}</p>

        <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-[#E7E4DC] pt-5 sm:grid-cols-2">
          {DETALLES.filter(([k]) => t[k]).map(([k, etiqueta]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6B675C]">{etiqueta}</dt>
              <dd className="font-semibold text-[#142033]">{String(t[k])}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-xs text-[#6B675C]">
          Los datos del cliente y sus archivos sólo los ven los talleres registrados, desde su panel.
        </p>
      </article>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-[#142033] p-6 text-white">
          <h2 className="text-lg font-extrabold">¿Eres taller?</h2>
          <p className="mt-1 text-sm text-white/75">
            {abierta
              ? "Manda tu precio y tiempo de entrega. Si el cliente te elige, el pago llega por HETNA."
              : "Este ya cerró, pero cada semana llegan trabajos nuevos. Regístrate gratis y te avisamos."}
          </p>
          <a
            href="/seller/solicitudes"
            className="mt-4 inline-block rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110"
          >
            {abierta ? "Cotizar este trabajo" : "Ver trabajos en mi panel"}
          </a>
        </section>
        <section className="rounded-2xl border border-[#E7E4DC] bg-[#FBFAF6] p-6">
          <h2 className="text-lg font-extrabold text-[#142033]">¿Necesitas algo parecido?</h2>
          <p className="mt-1 text-sm text-[#44433D]">
            Publica tu trabajo gratis. Los talleres te mandan propuestas, comparas y pagas protegido en HETNA.
          </p>
          <LocalizedClientLink
            href={`/cotizar${t.servicio ? `?servicio=${encodeURIComponent(t.servicio)}` : ""}`}
            className="mt-4 inline-block rounded-xl border-2 border-[#C2560A] px-5 py-2.5 font-semibold text-[#C2560A] hover:bg-[#FFF3EC]"
          >
            Publicar mi trabajo
          </LocalizedClientLink>
        </section>
      </div>
    </main>
  )
}
