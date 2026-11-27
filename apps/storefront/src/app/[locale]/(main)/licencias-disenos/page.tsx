import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { LICENCIAS, ORDEN_LICENCIAS, PIEZAS_POR_OMISION, REGLAS_COMUNES } from "@/lib/hetna/licencias"

// Las tres licencias de diseños digitales (respuesta jurídica del 14 nov 2026,
// pregunta 8). El texto sale de lib/hetna/licencias.ts, el mismo que ve la
// ficha de cada diseño.
const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/licencias-disenos" },
  title: "Licencias de diseños digitales",
  description:
    "Qué puedes fabricar y vender con un diseño DXF, SVG o STL comprado en HETNA CNC: licencia personal, comercial limitada y comercial ampliada.",
}

export default function LicenciasDisenos() {
  return (
    <PaginaInfo
      etiqueta="Legal"
      titulo="Licencias de diseños digitales"
      resumen="Antes de comprar, cada diseño te dice qué puedes fabricar y vender con él."
      actualizado="14 de noviembre de 2026"
    >
      <p>
        <TS>Cada diseño de la tienda trae una de estas tres licencias, elegida por quien lo vende. La ves en la ficha del
        diseño, antes de pagar. Si un diseño no indica otra, se vende con la licencia personal.</TS>
      </p>

      {ORDEN_LICENCIAS.map((k) => {
        const l = LICENCIAS[k]
        return (
          <section key={k}>
            <h2><TS>Licencia</TS> {l.nombre}</h2>
            <p><TS>{l.resumen}</TS></p>
            <ul>
              {l.permisos.map((p) => (
                <li key={p.que}>
                  {p.si ? "Sí" : "No"}: {p.que.toLowerCase()}
                  {p.nota ? ` (${p.nota})` : ""}.
                </li>
              ))}
            </ul>
            {k === "comercial_limitada" && (
              <p>
                <TS>El número de piezas lo pone el vendedor en cada diseño y lo ves en la ficha. Si no indica otro, son</TS>{" "}
                {PIEZAS_POR_OMISION} <TS>piezas en total.</TS>
              </p>
            )}
          </section>
        )
      })}

      <h2><TS>Reglas para las tres</TS></h2>
      <ul>
        {REGLAS_COMUNES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <h2><TS>Si necesitas más</TS></h2>
      <p>
        <TS>¿Quieres producir más piezas de las que permite la licencia, o usar el diseño de otra forma? Pregúntale al
        vendedor desde la ficha del diseño, con el botón «Preguntar al taller», antes de comprar.</TS>
      </p>
      <p>
        <TS>Las devoluciones de archivos siguen la</TS>{" "}
        <LocalizedClientLink href="/devoluciones"><TS>política de devoluciones</TS></LocalizedClientLink><TS>, y el uso de la tienda los</TS>{" "}
        <LocalizedClientLink href="/terminos-y-condiciones"><TS>términos y condiciones</TS></LocalizedClientLink> <TS>(cláusula 8).</TS>
      </p>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
