import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { LICENCIAS, ORDEN_LICENCIAS, PIEZAS_POR_OMISION, REGLAS_COMUNES } from "@/lib/hetna/licencias"

// Las tres licencias de diseños digitales (respuesta jurídica del 14 nov 2026,
// pregunta 8). El texto sale de lib/hetna/licencias.ts, el mismo que ve la
// ficha de cada diseño.
export const metadata: Metadata = {
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
        Cada diseño de la tienda trae una de estas tres licencias, elegida por quien lo vende. La ves en la ficha del
        diseño, antes de pagar. Si un diseño no indica otra, se vende con la licencia personal.
      </p>

      {ORDEN_LICENCIAS.map((k) => {
        const l = LICENCIAS[k]
        return (
          <section key={k}>
            <h2>Licencia {l.nombre}</h2>
            <p>{l.resumen}</p>
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
                El número de piezas lo pone el vendedor en cada diseño y lo ves en la ficha. Si no indica otro, son{" "}
                {PIEZAS_POR_OMISION} piezas en total.
              </p>
            )}
          </section>
        )
      })}

      <h2>Reglas para las tres</h2>
      <ul>
        {REGLAS_COMUNES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <h2>Si necesitas más</h2>
      <p>
        ¿Quieres producir más piezas de las que permite la licencia, o usar el diseño de otra forma? Pregúntale al
        vendedor desde la ficha del diseño, con el botón «Preguntar al taller», antes de comprar.
      </p>
      <p>
        Las devoluciones de archivos siguen la{" "}
        <LocalizedClientLink href="/devoluciones">política de devoluciones</LocalizedClientLink>, y el uso de la tienda los{" "}
        <LocalizedClientLink href="/terminos-y-condiciones">términos y condiciones</LocalizedClientLink> (cláusula 8).
      </p>
    </PaginaInfo>
  )
}
