import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { diasRestantes, lugarTrabajo, tituloTrabajo, trabajoPorFolio, type TrabajoPublico } from "@/lib/trabajos/datos"

export const revalidate = 120

async function generateMetadataEs({
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
    description: (t.descripcion || [t.servicio, t.material, t.ciudad || t.estado_mx].filter(Boolean).join(" · ")).slice(0, 155),
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
        <TS>← Todos los trabajos abiertos</TS>
      </LocalizedClientLink>

      <article className="mt-3 rounded-3xl border border-[#E7E4DC] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-[#6B675C]"><TS>{t.folio}</TS></span>
          {abierta ? (
            <span className="rounded-full bg-[#EEF6EE] px-2.5 py-0.5 font-bold text-[#1F5A2B]">
              <TS>{dias === 0 ? "Recibe propuestas hasta hoy" : `Recibe propuestas ${dias === 1 ? "1 día más" : `${dias} días más`}`}</TS>
            </span>
          ) : (
            <span className="rounded-full bg-[#F3F1EA] px-2.5 py-0.5 font-bold text-[#6B675C]">
              <TS>{t.estado === "asignada" ? "El cliente ya eligió taller" : "Ya no recibe propuestas"}</TS>
            </span>
          )}
          <span className="text-[#6B675C]">· <TS>{t.propuestas === 1 ? "1 propuesta" : `${t.propuestas} propuestas`}</TS></span>
        </div>

        <h1 className="mt-2 text-2xl font-extrabold leading-snug text-[#142033] sm:text-3xl">{tituloTrabajo(t)}</h1>
        {lugar && <p className="mt-1 text-[#6B675C]"><TS>📍 Entrega en</TS> <TS>{lugar}</TS></p>}

        {t.descripcion ? (
          <p className="mt-5 whitespace-pre-line text-[#2B2A26]"><TS>{t.descripcion}</TS></p>
        ) : (
          <p className="mt-5 rounded-xl bg-[#F3F1EA] px-4 py-3 text-sm text-[#40403A]">
            <TS>🔒 El cliente reservó la descripción completa para los talleres que autorice. Regístrate como taller y pide acceso desde tu panel.</TS>
          </p>
        )}
        {t.presupuesto && <p className="mt-3 text-sm text-[#40403A]"><b><TS>Presupuesto del cliente:</TS></b> <TS>{t.presupuesto}</TS></p>}
        {t.modalidad === "restringida" && (
          <p className="mt-3 text-sm text-[#40403A]"><TS>🔐 Licitación restringida: los planos se comparten sólo con los talleres que el cliente autoriza.</TS></p>
        )}

        <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-[#E7E4DC] pt-5 sm:grid-cols-2">
          {DETALLES.filter(([k]) => t[k]).map(([k, etiqueta]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6B675C]"><TS>{etiqueta}</TS></dt>
              <dd className="font-semibold text-[#142033]">{String(t[k])}</dd>
            </div>
          ))}
        </dl>
        {(t.preguntas || []).length > 0 && (
          <section className="mt-6 border-t border-[#E7E4DC] pt-5">
            <h2 className="text-base font-extrabold text-[#142033]"><TS>Preguntas de talleres y respuestas del cliente</TS></h2>
            <ul className="mt-3 grid gap-3">
              {(t.preguntas || []).map((q, i) => (
                <li key={i} className="rounded-xl bg-[#FAF9F5] p-3 text-sm">
                  <p className="text-[#142033]">
                    <span className="font-bold"><TS>Pregunta:</TS></span> <TS>{q.pregunta}</TS>
                  </p>
                  <p className="mt-1 text-[#40403A]">
                    <span className="font-bold text-[#1E7B3A]"><TS>Cliente:</TS></span> <TS>{q.respuesta}</TS>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-5 text-xs text-[#6B675C]">
          <TS>Los datos del cliente y sus archivos sólo los ven los talleres registrados, desde su panel.</TS>
        </p>
      </article>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-[#142033] p-6 text-white">
          <h2 className="text-lg font-extrabold"><TS>¿Eres taller?</TS></h2>
          <p className="mt-1 text-sm text-white/75">
            <TS>{abierta
              ? "Manda tu precio y tiempo de entrega. Si el cliente te elige, te paga directo a tu Mercado Pago o PayPal (o por HETNA si no los conectas)."
              : "Este ya cerró, pero cada semana llegan trabajos nuevos. Regístrate gratis y te avisamos."}</TS>
          </p>
          {/* Quien llega desde el anuncio en redes casi nunca tiene cuenta: primero el registro */}
          <LocalizedClientLink
            href="/talleres/unete"
            className="mt-4 inline-block rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110"
          >
            <TS>{abierta ? "Regístrate gratis y cotiza" : "Regístrate gratis"}</TS>
          </LocalizedClientLink>
          <a href="/seller/solicitudes" className="mt-3 block text-sm font-semibold text-white/85 underline hover:text-white">
            <TS>{abierta ? "¿Ya tienes cuenta? Cotizar este trabajo" : "¿Ya tienes cuenta? Ver trabajos en mi panel"}</TS>
          </a>
        </section>
        <section className="rounded-2xl border border-[#E7E4DC] bg-[#FBFAF6] p-6">
          <h2 className="text-lg font-extrabold text-[#142033]"><TS>¿Necesitas algo parecido?</TS></h2>
          <p className="mt-1 text-sm text-[#44433D]">
            <TS>Publica tu trabajo gratis. Los talleres te mandan propuestas, comparas y pagas protegido en HETNA.</TS>
          </p>
          <LocalizedClientLink
            href={`/cotizar${t.servicio ? `?servicio=${encodeURIComponent(t.servicio)}` : ""}`}
            className="mt-4 inline-block rounded-xl border-2 border-[#C2560A] px-5 py-2.5 font-semibold text-[#C2560A] hover:bg-[#FFF3EC]"
          >
            <TS>Publicar mi trabajo</TS>
          </LocalizedClientLink>
        </section>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
