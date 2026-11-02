import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, ligaWhatsApp, ubicacionEmpresa } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
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
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]">WhatsApp</p>
          <p className="mt-1 text-lg font-bold text-[#142033]">{EMPRESA.whatsappVisible}</p>
          <a href={ligaWhatsApp("Hola HETNA CNC")} target="_blank" rel="noopener noreferrer">
            Abrir WhatsApp →
          </a>
        </div>
        <div className={TARJETA}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]">Teléfono</p>
          <p className="mt-1 text-lg font-bold text-[#142033]">{EMPRESA.telefonoVisible}</p>
          <a href={`tel:+${EMPRESA.telefono}`}>Llamar →</a>
        </div>
        {EMPRESA.correo && (
          <div className={TARJETA}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]">Correo</p>
            <p className="mt-1 text-lg font-bold text-[#142033]">{EMPRESA.correo}</p>
            <a href={`mailto:${EMPRESA.correo}`}>Escribir correo →</a>
          </div>
        )}
        <div className={TARJETA}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]">Horario</p>
          <p className="mt-1 font-semibold text-[#142033]">{EMPRESA.horario}</p>
        </div>
        <div className={TARJETA}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]">Ubicación</p>
          <p className="mt-1 font-semibold text-[#142033]">{EMPRESA.domicilioCompleto || ubicacionEmpresa()}</p>
          <p className="text-sm text-[#6B675C]">Envíos a toda la República Mexicana</p>
          {EMPRESA.razonSocial && <p className="mt-2 text-sm text-[#6B675C]">Responsable: {EMPRESA.razonSocial}</p>}
        </div>
      </div>

      <h2>¿Necesitas una cotización?</h2>
      <p>
        Para trabajos de corte, grabado o maquinado usa <LocalizedClientLink href="/cotizar">Solicitar cotización</LocalizedClientLink>:
        así tu solicitud queda registrada y te respondemos por correo.
      </p>

      <h2>Síguenos</h2>
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
