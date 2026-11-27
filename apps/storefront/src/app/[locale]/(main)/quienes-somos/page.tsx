import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, ubicacionEmpresa } from "@/lib/hetna/empresa"

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/quienes-somos" },
  title: "Quiénes somos",
  description:
    "HETNA CNC es un marketplace mexicano de CNC: tienda, diseños, servicios de fabricación y una red de talleres en todo México.",
}

const CADENA = [
  ["¿Solo quieres el diseño?", "Te lo vendemos listo para cortar."],
  ["¿No quieres diseñar?", "Te lo diseñamos."],
  ["¿No tienes máquina?", "Te lo maquilamos con talleres de la red."],
]

export default function QuienesSomos() {
  return (
    <PaginaInfo
      etiqueta="HETNA CNC"
      titulo="Quiénes somos"
      resumen="Un marketplace hecho por y para quienes trabajan con CNC en México."
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        url: "https://hetnacnc.com/mx/quienes-somos",
        name: "Quiénes somos | HETNA CNC",
        inLanguage: "es-MX",
        mainEntity: {
          "@type": "Organization",
          "@id": "https://hetnacnc.com/#organization",
          name: EMPRESA.nombreComercial,
          url: EMPRESA.sitio,
          logo: `${EMPRESA.sitio}/Logo.png`,
          address: { "@type": "PostalAddress", addressLocality: EMPRESA.ciudad, addressRegion: EMPRESA.estado, addressCountry: "MX" },
          telephone: `+${EMPRESA.telefono}`,
          email: EMPRESA.correo,
          areaServed: { "@type": "Country", name: "México" },
          sameAs: EMPRESA.redes.filter((r) => !r.url.includes("/groups/") && !r.url.includes("linkedin.com/in/")).map((r) => r.url),
        },
      }}
    >
      <p className="text-lg font-semibold text-[#142033]">
        <TS>“No quieres hacer nada, yo te vendo el diseño. No quieres diseñar, yo te lo diseño. Quieres maquilarlo y no tienes
        cómo, yo te lo maquilo.”</TS>
      </p>

      <h2><TS>Qué hacemos</TS></h2>
      <p>
        <TS>HETNA CNC nace en</TS> {ubicacionEmpresa()} <TS>para resolver toda la cadena de la fabricación digital en un solo lugar:
        máquinas, herramientas, materiales, diseños listos para cortar y servicios de fabricación con talleres de todo
        México.</TS>
      </p>

      <div className="my-5 grid gap-3 sm:grid-cols-3">
        {CADENA.map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-[#F3F1EA] p-4">
            <p className="font-bold text-[#142033]"><TS>{t}</TS></p>
            <p className="mt-1 text-sm"><TS>{d}</TS></p>
          </div>
        ))}
      </div>

      <h2><TS>Para talleres</TS></h2>
      <p>
        <TS>Los talleres de la red ofrecen sus servicios en el</TS> <LocalizedClientLink href="/talleres"><TS>directorio de talleres</TS></LocalizedClientLink><TS>,
        reciben solicitudes de cotización y venden con Envíos HETNA, sin contratar paqueterías por su cuenta. Además tienen
        herramientas para cotizar desde el celular.</TS>
      </p>

      <h2><TS>Comunidad</TS></h2>
      <p>
        <TS>Somos parte de la comunidad CNC de México: administramos el grupo de Facebook “Router CNC México” y compartimos
        contenido en</TS> <LocalizedClientLink href="/servicios/aprendizaje-cnc"><TS>Aprendizaje CNC</TS></LocalizedClientLink>.
      </p>

      <h2><TS>Nuestro compromiso</TS></h2>
      <ul>
        <li><TS>Precios claros en pesos y envío calculado antes de pagar.</TS></li>
        <li><TS>Información clara de cada taller: servicios, máquinas, materiales y tiempos de entrega.</TS></li>
        <li><TS>Pagos y tratos dentro de la plataforma, para que tu compra quede respaldada.</TS></li>
        <li><TS>Atención en español:</TS> <TS>{EMPRESA.horario}</TS>.</li>
      </ul>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
