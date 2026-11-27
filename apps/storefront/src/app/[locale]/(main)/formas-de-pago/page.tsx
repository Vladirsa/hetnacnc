import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/formas-de-pago" },
  title: "Formas de pago",
  description: "Paga tus compras en HETNA CNC con Mercado Pago o transferencia SPEI para pedidos grandes y trabajos cotizados.",
}

export default function FormasDePago() {
  return (
    <PaginaInfo etiqueta="Ayuda" titulo="Formas de pago" resumen="Pagos seguros dentro de HETNA, en pesos mexicanos.">
      <h2><TS>Mercado Pago</TS></h2>
      <p>
        <TS>Todas las compras de la tienda se pagan con Mercado Pago: tarjeta de débito o crédito y los demás medios que
        Mercado Pago te muestre al pagar. Tus datos bancarios los procesa Mercado Pago; HETNA no los ve ni los guarda.</TS>
      </p>

      <h2><TS>Transferencia SPEI</TS></h2>
      <p>
        <TS>Para compras grandes (por ejemplo, máquinas) y trabajos cotizados, también puedes pagar por transferencia SPEI.
        Escríbenos y te damos los datos de la cuenta de HETNA CNC. Paga siempre a la cuenta que te indique HETNA dentro de
        la plataforma o por nuestro WhatsApp oficial.</TS>
      </p>

      <h2><TS>Trabajos fabricados a la medida</TS></h2>
      <p>
        <TS>Cada cotización indica si se paga completa al aceptarla o con anticipo y el resto cuando el trabajo está listo,
        antes de enviarlo. Las solicitudes de fabricación se pagan con Mercado Pago o con PayPal, a HETNA o directo a la
        cuenta del taller conectada a HETNA, según lo que muestre la propuesta.</TS>
      </p>

      <h2><TS>Suscripciones del Cotizador para talleres</TS></h2>
      <p><TS>Los planes del Cotizador se pagan cada mes con Mercado Pago o con PayPal.</TS></p>

      <h2><TS>Paga siempre dentro de HETNA</TS></h2>
      <p>
        <TS>Los pagos hechos dentro de la plataforma quedan registrados y te dan respaldo si hay algún problema. En una
        solicitud de fabricación puedes acordar con el taller pagarle por fuera, pero entonces HETNA no puede proteger ese
        pago: no se hace responsable de pagos o tratos hechos por fuera de la plataforma.</TS>
      </p>

      <p>
        <TS>¿Dudas? Revisa las</TS> <LocalizedClientLink href="/preguntas-frecuentes"><TS>preguntas frecuentes</TS></LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
