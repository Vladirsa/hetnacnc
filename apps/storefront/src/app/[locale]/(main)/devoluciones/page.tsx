import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  title: "Devoluciones y reembolsos",
  description: "Política de devoluciones y reembolsos de HETNA CNC para productos físicos, trabajos a la medida y diseños digitales.",
}

export default function Devoluciones() {
  return (
    <PaginaInfo
      etiqueta="Ayuda"
      titulo="Devoluciones y reembolsos"
      resumen="Qué puedes devolver, en qué plazo y cómo te reembolsamos."
      actualizado
    >
      <h2>Productos físicos</h2>
      <ul>
        <li>
          Tienes <strong>{EMPRESA.diasDevolucion} días hábiles</strong> desde que recibes tu pedido para solicitar una devolución.
        </li>
        <li>El producto debe estar sin uso, completo y en su empaque original.</li>
        <li>Si el producto llegó dañado, incompleto o es distinto a lo que compraste, el envío de regreso no tiene costo para ti.</li>
        <li>Si la devolución es por cambio de opinión, el costo del envío de regreso lo cubre el cliente.</li>
      </ul>

      <h2>Trabajos fabricados a la medida</h2>
      <p>
        Las piezas fabricadas con tus archivos y especificaciones no tienen devolución por cambio de opinión. Si la pieza no
        cumple con lo acordado en la cotización (medidas, material, cantidad o acabado), el taller la corrige, la vuelve a
        fabricar o se te reembolsa lo que corresponda.
      </p>

      <h2>Diseños digitales</h2>
      <p>
        Los archivos digitales (DXF, SVG, STL y otros) no tienen devolución una vez descargados, salvo que el archivo esté
        dañado o no corresponda a la descripción.
      </p>

      <h2>Cómo solicitarla</h2>
      <ul>
        <li>Escríbenos por {medioContacto()} con tu número de pedido, fotos del producto y el motivo.</li>
        <li>Te respondemos en horario de atención: {EMPRESA.horario}.</li>
        <li>Una vez recibido y revisado el producto, el reembolso se hace por el mismo medio de pago.</li>
      </ul>

      <h2>Garantía</h2>
      <p>
        La garantía de los productos y trabajos la otorga cada vendedor o taller. HETNA te acompaña si hay algún problema con
        una compra hecha dentro de la plataforma.
      </p>

      <p className="text-sm text-[#6B675C]">
        Esta política no limita los derechos que te da la Ley Federal de Protección al Consumidor. Consulta también los{" "}
        <LocalizedClientLink href="/terminos-y-condiciones">Términos y condiciones</LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}
