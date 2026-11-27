import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GeneradorModelos3D } from "@/components/hetna/generador/GeneradorModelos3D"
import { ContarUsoHerramienta } from "@/components/hetna/estudio/ContarUsoHerramienta"
import { JsonLd } from "@/components/hetna/JsonLd"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CATEGORIAS, MODELOS, modeloPorId, type Modelo3D } from "@/lib/generador/modelos3d"
import { migas } from "@/lib/hetna/schema"

// Una página por modelo 3D paramétrico (25 nov 2026): cada uno es una entrada
// desde Google ("soporte nema 17 stl", "tapón para ptr imprimir 3d"...). El
// generador abre ya en ese modelo; abajo, en el HTML del servidor, qué es,
// qué medidas se cambian y los modelos parecidos.
const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; modelo: string }> }

// Se arma al momento, como las demás herramientas del estudio: el marco del
// estudio lee datos de la visita y una página pregenerada (generateStaticParams)
// daba error 500 en producción.

const rango = (p: Modelo3D["params"][number]) => `${p.min} a ${p.max}${p.unidad ?? " mm"}`
const url = (m: Modelo3D) => `${SITIO}/mx/disenar/modelos-3d/${m.id}`

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const { modelo } = await params
  const m = modeloPorId(modelo)
  if (!m) return {}
  const title = `${m.nombre}: STL gratis a tu medida para imprimir en 3D`
  const description = `${m.texto} Ajusta ${m.params.slice(0, 3).map((p) => p.nombre.toLowerCase()).join(", ")} y descarga el STL gratis, listo para imprimir. O pide que un taller te lo imprima.`.slice(0, 300)
  return {
    title,
    description,
    alternates: { canonical: url(m), languages: { "es-MX": url(m) } },
    openGraph: { type: "website", locale: "es_MX", siteName: "HETNA CNC", title, description, url: url(m) },
    twitter: { card: "summary", title, description },
  }
}

const datos = (m: Modelo3D) => [
  {
    "@context": "https://schema.org",
    "@type": "3DModel",
    "@id": `${url(m)}#modelo`,
    name: m.nombre,
    description: m.texto,
    url: url(m),
    encodingFormat: "model/stl",
    isAccessibleForFree: true,
    inLanguage: "es-MX",
    keywords: m.claves,
    creator: { "@type": "Organization", "@id": `${SITIO}/#organization`, name: "HETNA CNC", url: SITIO },
  },
  migas([
    { nombre: "Inicio", ruta: `${SITIO}/mx` },
    { nombre: "Diseñar", ruta: `${SITIO}/mx/disenar` },
    { nombre: "Modelos 3D", ruta: `${SITIO}/mx/disenar/modelos-3d` },
    { nombre: m.nombre },
  ]),
]

export default async function PaginaModelo3D({ params }: Props) {
  const { modelo } = await params
  const m = modeloPorId(modelo)
  if (!m) notFound()
  const categoria = CATEGORIAS.find((c) => c.id === m.categoria)
  const parecidos = MODELOS.filter((o) => o.categoria === m.categoria && o.id !== m.id)
  return (
    <>
      <JsonLd datos={datos(m)} />
      <ContarUsoHerramienta herramienta="modelos-3d" />
      <div className="tema-estudio flex-1">
        <GeneradorModelos3D inicial={m.id} />
      </div>
      <section aria-labelledby="acerca-modelo" className="border-t border-[#2B3648] bg-[#0D1015] px-4 py-6 text-[#C9CED6] lg:px-8">
        <div className="mx-auto max-w-[920px]">
          <h2 id="acerca-modelo" className="m-0 text-[16px] font-semibold text-white"><TS>{m.nombre}</TS> <TS>para imprimir en 3D</TS></h2>
          <p className="m-0 mt-1.5 text-[14px] leading-relaxed"><TS>{m.texto}</TS></p>
          <h3 className="m-0 mt-4 text-[14px] font-semibold text-white"><TS>Medidas que puedes cambiar</TS></h3>
          <ul className="m-0 mt-1.5 list-disc pl-5 text-[14px] leading-relaxed">
            {m.params.map((p) => (
              <li key={p.k}>
                <TS>{p.nombre}</TS><TS>: de</TS> {rango(p)} <TS>(de fábrica,</TS> <TS>{p.def}</TS><TS>{p.unidad ?? " mm"}</TS>)
              </li>
            ))}
          </ul>
          <p className="m-0 mt-3 text-[14px] leading-relaxed">
            <TS>El STL sale cerrado y apoyado en la cama, sin errores de malla. Imprímelo en PLA o PETG; para piezas de taller, 3 perímetros y
            30% de relleno. Descargarlo es gratis.</TS>
          </p>
          <p className="m-0 mt-1.5 text-[14px]">
            <LocalizedClientLink href="/cnc/impresion-3d" className="font-semibold text-[#FF8A47] hover:text-white">
              <TS>¿No tienes impresora? Un taller de HETNA te lo imprime, con precio al instante →</TS>
            </LocalizedClientLink>
          </p>
          {parecidos.length > 0 && (
            <>
              <h3 className="m-0 mt-4 text-[14px] font-semibold text-white"><TS>Más modelos:</TS> {categoria?.nombre.toLowerCase()}</h3>
              <nav aria-label="Modelos parecidos" className="mt-2 flex flex-wrap gap-2 text-[13px]">
                {parecidos.map((o) => (
                  <LocalizedClientLink key={o.id} href={`/disenar/modelos-3d/${o.id}`} className="rounded-full border border-[#2B3648] px-3 py-1 hover:border-[#FF6A1A] hover:text-white">
                    <TS>{o.nombre}</TS>
                  </LocalizedClientLink>
                ))}
                <LocalizedClientLink href="/disenar/modelos-3d" className="rounded-full border border-[#2B3648] px-3 py-1 hover:border-[#FF6A1A] hover:text-white">
                  <TS>Todos los modelos</TS>
                </LocalizedClientLink>
              </nav>
            </>
          )}
        </div>
      </section>
    </>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
