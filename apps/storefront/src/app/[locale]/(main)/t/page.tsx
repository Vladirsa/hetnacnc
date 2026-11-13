import type { Metadata } from "next"

import { IMAGEN_OG } from "@/lib/helpers/seo"
import { leerDirectorio } from "@/lib/cotizador/taller-publico"

// Directorio de talleres con cotizador en línea (hetnacnc.com/t).
// Cada uno tiene su página /t/<slug> para subir archivo y pedir cotización.
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const titulo = "Talleres CNC que cotizan en línea"
  const descripcion = "Sube tu archivo DXF, SVG o STL y pide tu cotización de corte láser, router, plasma o impresión 3D directo a un taller."
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `https://hetnacnc.com/mx/t` },
    openGraph: { title: titulo, description: descripcion, images: [IMAGEN_OG] },
  }
}

export default async function DirectorioTalleresPage() {
  const talleres = await leerDirectorio()
  return (
    <main className="container py-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="m-0 text-[28px] font-bold leading-tight text-[#142033] md:text-[34px]">Talleres que cotizan en línea</h1>
        <p className="m-0 mt-2 max-w-2xl text-[16px] text-[#40403A]">
          Elige un taller, sube tu archivo y recibe tu cotización. Muchos te muestran un precio estimado al momento.
        </p>

        {talleres.length ? (
          <ul className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {talleres.map((t) => (
              <li key={t.slug}>
                <a
                  href={`/t/${t.slug}`}
                  className="flex h-full gap-3 rounded-[16px] border border-[#E7E4DC] bg-white p-4 transition hover:border-[#C2560A]"
                >
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo} alt={`Logo de ${t.nombre}`} className="h-12 w-12 shrink-0 rounded-[10px] object-contain" loading="lazy" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#F3F2EE] text-[20px]" aria-hidden="true">
                      🏭
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold text-[#1B1B18]">{t.nombre}</span>
                    {t.ciudad ? <span className="block text-[13px] text-[#7A776E]">{t.ciudad}</span> : null}
                    {t.descripcion ? <span className="mt-1 line-clamp-2 block text-[13px] text-[#40403A]">{t.descripcion}</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-6 rounded-[16px] border border-[#E7E4DC] bg-white p-5 text-[15px] text-[#40403A]">
            Pronto verás aquí los talleres. Mientras tanto puedes{" "}
            <a href="/cotizar" className="underline">
              publicar tu proyecto
            </a>{" "}
            y recibir cotizaciones de varios talleres.
          </p>
        )}

        <section className="mt-10 rounded-[18px] bg-[#142033] p-6 text-white">
          <h2 className="m-0 text-[20px] font-bold">¿Tienes un taller CNC?</h2>
          <p className="m-0 mt-2 max-w-2xl text-[15px] text-white/85">
            Con el Cotizador HETNA tienes tu propia página para que tus clientes suban su archivo y vean un precio al momento. Las solicitudes te llegan a la app.
          </p>
          <a
            href="/servicios/cotizador-cnc"
            className="mt-4 inline-flex rounded-[10px] bg-[#C2560A] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
          >
            Quiero mi cotizador en línea
          </a>
        </section>
      </div>
    </main>
  )
}
