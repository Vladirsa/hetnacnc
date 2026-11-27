// /mx/tienda — "¿Qué necesitas hoy?": la entrada a todo lo que se compra,
// se contrata o se cotiza en HETNA. Conteos y precios salen de la base en el
// momento (lib/hetna/tienda.ts); nada escrito a mano.
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import "@/components/hetna/tienda/fuentes-tienda.css"
import { JsonLd } from "@/components/hetna/JsonLd"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { TiendaVista } from "@/components/hetna/tienda/TiendaVista"
import AnunciosEspacio from "@/components/hetna/publicidad/AnunciosEspacio"
import { catalogoTienda, PROCESOS } from "@/lib/hetna/tienda"
import { IMAGEN_OG } from "@/lib/helpers/seo"
import { migas } from "@/lib/hetna/schema"

export const revalidate = 60

async function generateMetadataEs(): Promise<Metadata> {
  return {
    title: "Tienda CNC: diseños DXF, servicios CAM y fabricación a medida",
    description:
      "Compra diseños DXF y STL con descarga inmediata, contrata programación CAM de 3 a 5 ejes o cotiza corte láser, plasma, router y maquinado con talleres de México.",
    // Todas las versiones por país (/us, /pe…) son la misma tienda: la oficial es /mx
    alternates: { canonical: "https://hetnacnc.com/mx/tienda" },
    openGraph: { title: "Tienda HETNA CNC", images: [IMAGEN_OG] },
  }
}

export default async function TiendaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const catalogo = await catalogoTienda(locale)

  return (
    <main className="w-full bg-[#E9ECEF] text-[#1E2329]">
      <JsonLd datos={[migas([{ nombre: "Inicio", ruta: `https://hetnacnc.com/${locale}` }, { nombre: "Tienda" }])]} />
      <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <nav aria-label="Migas" className="text-[13px] text-[#5B6370]">
          <ol className="flex items-center gap-2">
            <li>
              <LocalizedClientLink href="/" className="hover:text-[#1E2329] hover:underline">
                <TS>Inicio</TS>
              </LocalizedClientLink>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-[#1E2329]">
              <TS>Tienda</TS>
            </li>
          </ol>
        </nav>

        <header className="mt-4">
          <h1 className="fuente-condensada text-[44px] font-bold uppercase leading-[0.9] sm:text-[64px]"><TS>¿Qué necesitas hoy?</TS></h1>
          <ul className="mt-4 grid gap-2 text-[15px] text-[#3A414B] sm:grid-cols-3 sm:gap-4">
            <li className="border-l-4 border-[#1E2329] pl-3">
              <b className="text-[#1E2329]"><TS>Comprar un diseño listo.</TS></b> <TS>Pagas y descargas el archivo al momento.</TS>
            </li>
            <li className="border-l-4 border-[#1E2329] pl-3">
              <b className="text-[#1E2329]"><TS>Pedir un servicio.</TS></b> <TS>Un especialista programa o revisa tu trabajo CAM.</TS>
            </li>
            <li className="border-l-4 border-[#E85D04] pl-3">
              <b className="text-[#1E2329]"><TS>Fabricar a medida.</TS></b> <TS>Cotizas tu pieza y los talleres te mandan su precio.</TS>
            </li>
          </ul>
        </header>

        <TiendaVista catalogo={catalogo} procesos={PROCESOS} publicidad={<AnunciosEspacio espacio="tienda_banner" className="mt-8" />} />
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
