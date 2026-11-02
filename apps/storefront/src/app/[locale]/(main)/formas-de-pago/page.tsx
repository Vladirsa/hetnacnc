import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/formas-de-pago" },
  title: "Formas de pago",
  description: "Paga tus compras en HETNA CNC con Mercado Pago o transferencia SPEI para pedidos grandes y trabajos cotizados.",
}

export default function FormasDePago() {
  return (
    <PaginaInfo etiqueta="Ayuda" titulo="Formas de pago" resumen="Pagos seguros dentro de HETNA, en pesos mexicanos.">
      <h2>Mercado Pago</h2>
      <p>
        Todas las compras de la tienda se pagan con Mercado Pago: tarjeta de débito o crédito y los demás medios que
        Mercado Pago te muestre al pagar. Tus datos bancarios los procesa Mercado Pago; HETNA no los ve ni los guarda.
      </p>

      <h2>Transferencia SPEI</h2>
      <p>
        Para compras grandes (por ejemplo, máquinas) y trabajos cotizados, también puedes pagar por transferencia SPEI.
        Escríbenos y te damos los datos de la cuenta de HETNA CNC. Paga siempre a la cuenta que te indique HETNA dentro de
        la plataforma o por nuestro WhatsApp oficial.
      </p>

      <h2>Trabajos fabricados a la medida</h2>
      <p>
        Cada cotización indica si se paga completa al aceptarla o con anticipo y el resto cuando el trabajo está listo,
        antes de enviarlo.
      </p>

      <h2>Paga siempre dentro de HETNA</h2>
      <p>
        Los pagos hechos dentro de la plataforma quedan registrados y te dan respaldo si hay algún problema. HETNA no se
        hace responsable de pagos o tratos hechos por fuera de la plataforma.
      </p>

      <p>
        ¿Dudas? Revisa las <LocalizedClientLink href="/preguntas-frecuentes">preguntas frecuentes</LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}
