import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, ligaWhatsApp, ubicacionEmpresa } from "@/lib/hetna/empresa"

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/contacto" },
  title: "Contacto",
  description: "Contacta a HETNA CNC por WhatsApp, teléfono o correo. Atención de lunes a viernes de 9:00 a 18:00 h.",
}

const TARJETA = "rounded-2xl border border-[#E7E4DC] p-5"

export default function Contacto() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: EMPRESA.nombreComercial,
    url: EMPRESA.sitio,
    logo: `${EMPRESA.sitio}/Logo.png`,
    telephone: `+${EMPRESA.telefono}`,
    ...(EMPRESA.correo ? { email: EMPRESA.correo } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: EMPRESA.ciudad,
      addressRegion: EMPRESA.estado,
      addressCountry: "MX",
    },
    sameAs: EMPRESA.redes.map((r) => r.url),
  }

  return (
    <PaginaInfo etiqueta="HETNA CNC" titulo="Contacto" resumen="Estamos para ayudarte con compras, cotizaciones y envíos." jsonLd={jsonLd}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={TARJETA}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]"><TS>WhatsApp</TS></p>
          <p className="mt-1 text-lg font-bold text-[#142033]">{EMPRESA.whatsappVisible}</p>
          <a href={ligaWhatsApp("Hola HETNA CNC")} target="_blank" rel="noopener noreferrer">
            <TS>Abrir WhatsApp →</TS>
          </a>
        </div>
        <div className={TARJETA}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]"><TS>Teléfono</TS></p>
          <p className="mt-1 text-lg font-bold text-[#142033]">{EMPRESA.telefonoVisible}</p>
          <a href={`tel:+${EMPRESA.telefono}`}><TS>Llamar →</TS></a>
        </div>
        {EMPRESA.correo && (
          <div className={TARJETA}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]"><TS>Correo</TS></p>
            <p className="mt-1 text-lg font-bold text-[#142033]">{EMPRESA.correo}</p>
            <a href={`mailto:${EMPRESA.correo}`}><TS>Escribir correo →</TS></a>
          </div>
        )}
        <div className={TARJETA}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]"><TS>Horario</TS></p>
          <p className="mt-1 font-semibold text-[#142033]">{EMPRESA.horario}</p>
        </div>
        <div className={TARJETA}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]"><TS>Ubicación</TS></p>
          <p className="mt-1 font-semibold text-[#142033]">{EMPRESA.domicilioCompleto || ubicacionEmpresa()}</p>
          <p className="text-sm text-[#6B675C]"><TS>Envíos a toda la República Mexicana</TS></p>
          {EMPRESA.razonSocial && <p className="mt-2 text-sm text-[#6B675C]"><TS>Responsable:</TS> {EMPRESA.razonSocial}</p>}
        </div>
      </div>

      <h2><TS>¿Necesitas una cotización?</TS></h2>
      <p>
        <TS>Para trabajos de corte, grabado o maquinado usa</TS> <LocalizedClientLink href="/cotizar"><TS>Solicitar cotización</TS></LocalizedClientLink><TS>:
        así tu solicitud queda registrada y te respondemos por correo.</TS>
      </p>

      <h2><TS>Síguenos</TS></h2>
      <ul>
        {EMPRESA.redes.map((r) => (
          <li key={r.nombre}>
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {r.nombre}
            </a>
          </li>
        ))}
      </ul>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
