import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto, responsableLegal } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de HETNA CNC para clientes, vendedores y talleres.",
}

export default function Terminos() {
  return (
    <PaginaInfo etiqueta="Legal" titulo="Términos y condiciones" resumen="Las reglas para usar HETNA CNC." actualizado>
      <h2>1. Quiénes somos</h2>
      <p>
        {EMPRESA.nombreComercial} ({EMPRESA.sitio}) es una plataforma operada por {responsableLegal("es")}, con domicilio en {EMPRESA.domicilioCompleto}, donde clientes, vendedores y
        talleres compran, venden y contratan productos y servicios relacionados con CNC. Al usar el sitio aceptas estos
        términos.
      </p>

      <h2>2. Cuentas</h2>
      <ul>
        <li>Debes dar datos verdaderos y mantener segura tu contraseña.</li>
        <li>Podemos suspender cuentas que den datos falsos, cometan fraude o incumplan estos términos.</li>
      </ul>

      <h2>3. Compras</h2>
      <ul>
        <li>Los precios están en pesos mexicanos. El costo del envío se muestra antes de pagar.</li>
        <li>Cada producto lo vende el vendedor o taller que aparece en su ficha, que es responsable de su descripción, calidad y garantía.</li>
        <li>Las devoluciones se rigen por nuestra <LocalizedClientLink href="/devoluciones">política de devoluciones</LocalizedClientLink>.</li>
      </ul>

      <h2>4. Cotizaciones y trabajos a la medida</h2>
      <ul>
        <li>Las solicitudes de cotización se atienden a través de HETNA. Cada cotización indica precio, tiempo de entrega, condiciones y vigencia.</li>
        <li>El trabajo comienza cuando aceptas la cotización y se recibe el pago o anticipo indicado.</li>
        <li>Es responsabilidad del cliente revisar que sus archivos y medidas sean correctos.</li>
      </ul>

      <h2>5. Vendedores y talleres</h2>
      <ul>
        <li>Deben publicar información real de sus productos, servicios, capacidades y tiempos de entrega.</li>
        <li>Las ventas y trabajos obtenidos por HETNA se cobran y gestionan dentro de la plataforma, con la comisión vigente.</li>
        <li>No está permitido compartir datos de contacto para cerrar tratos fuera de la plataforma; hacerlo puede causar la suspensión de la cuenta.</li>
        <li>Deben cumplir sus propias obligaciones fiscales.</li>
        <li>
          Además de estos términos, a los vendedores les aplican los{" "}
          <LocalizedClientLink href="/terminos-vendedores">Términos para vendedores</LocalizedClientLink>.
        </li>
      </ul>

      <h2>6. Pagos dentro de la plataforma</h2>
      <p>
        Los pagos se hacen por los medios que indica HETNA. HETNA no se hace responsable de pagos, tratos o entregas
        acordados fuera de la plataforma.
      </p>

      <h2>7. Envíos</h2>
      <p>
        Los envíos se realizan con Envíos HETNA mediante paqueterías externas. Los tiempos son estimados y pueden variar por
        causas ajenas a HETNA.
      </p>

      <h2>8. Propiedad intelectual</h2>
      <p>
        Los diseños digitales se venden para uso según su descripción. No se permite revenderlos ni compartirlos como
        archivos. Quien publica un diseño declara tener derecho a venderlo.
      </p>

      <h2>9. Limitación de responsabilidad</h2>
      <p>
        HETNA actúa como plataforma entre clientes y vendedores. Hacemos lo posible por verificar a los talleres y resolver
        problemas de compras hechas dentro de la plataforma, pero cada vendedor responde por sus productos y trabajos.
      </p>

      <h2>10. Contacto y cambios</h2>
      <p>
        Para cualquier duda escríbenos por {medioContacto()}. Podemos actualizar estos términos; la versión vigente es la
        publicada en esta página. Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Tus datos personales
        se tratan como explica el <LocalizedClientLink href="/aviso-de-privacidad">Aviso de privacidad</LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}
