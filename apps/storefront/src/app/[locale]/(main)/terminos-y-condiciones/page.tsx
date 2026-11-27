import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto, responsableLegal } from "@/lib/hetna/empresa"
import { DIAS_CIERRE_AUTOMATICO, DIAS_HABILES_DECISION_DISPUTA, DIAS_RETRASO_CANCELACION } from "@/lib/hetna/promesas"

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/terminos-y-condiciones" },
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de HETNA CNC para clientes, vendedores y talleres.",
}

export default function Terminos() {
  return (
    <PaginaInfo etiqueta="Legal" titulo="Términos y condiciones" resumen="Las reglas para usar HETNA CNC." actualizado="20 de noviembre de 2026">
      <h2><TS>1. Quiénes somos</TS></h2>
      <p>
        {EMPRESA.nombreComercial} ({EMPRESA.sitio}<TS>) es una plataforma operada por</TS> {responsableLegal("es")}<TS>, con domicilio en</TS> {EMPRESA.domicilioCompleto}<TS>, donde clientes, vendedores y
        talleres compran, venden y contratan productos y servicios relacionados con CNC. Al usar el sitio aceptas estos
        términos.</TS>
      </p>

      <h2><TS>2. Cuentas</TS></h2>
      <ul>
        <li><TS>Debes dar datos verdaderos y mantener segura tu contraseña.</TS></li>
        <li><TS>Podemos suspender cuentas que den datos falsos, cometan fraude o incumplan estos términos.</TS></li>
      </ul>

      <h2><TS>3. Compras</TS></h2>
      <ul>
        <li><TS>Los precios están en pesos mexicanos. El costo del envío se muestra antes de pagar.</TS></li>
        <li><TS>Cada producto lo vende el vendedor o taller que aparece en su ficha, que es responsable de su descripción, calidad y garantía.</TS></li>
        <li><TS>Las devoluciones se rigen por nuestra</TS> <LocalizedClientLink href="/devoluciones"><TS>política de devoluciones</TS></LocalizedClientLink>.</li>
      </ul>

      <h2><TS>4. Cotizaciones y trabajos a la medida</TS></h2>
      <ul>
        <li><TS>Las solicitudes de cotización se atienden a través de HETNA. Cada cotización indica precio, tiempo de entrega, condiciones y vigencia.</TS></li>
        <li><TS>El trabajo comienza cuando aceptas la cotización y se recibe el pago o anticipo indicado.</TS></li>
        <li><TS>Es responsabilidad del cliente revisar que sus archivos y medidas sean correctos.</TS></li>
      </ul>

      <h2><TS>5. Vendedores y talleres</TS></h2>
      <ul>
        <li><TS>Deben publicar información real de sus productos, servicios, capacidades y tiempos de entrega.</TS></li>
        <li>
          <strong><TS>Qué cobra HETNA, según cómo se hace el negocio:</TS></strong>
          <ul>
            <li>
              <strong><TS>Venta de productos en la tienda</TS></strong> <TS>(máquinas, herramientas, materiales, piezas, diseños y archivos) y de la Academia (cursos y
              libros): se cobran dentro de la plataforma y HETNA descuenta al vendedor la comisión de la</TS>{" "}
              <LocalizedClientLink href="/terminos-vendedores#tarifas"><TS>lista de precios para vendedores</TS></LocalizedClientLink><TS>. No está permitido
              compartir datos de contacto para cerrar estas ventas fuera de la plataforma; hacerlo puede causar la suspensión de la cuenta.</TS>
            </li>
            <li>
              <strong><TS>Contratación directa de servicios publicados en la tienda</TS></strong> <TS>(un servicio con precio, como diseño, preparación para CAM o
              maquila): se tratan igual que una venta de la tienda, con la misma comisión y las mismas reglas.</TS>
            </li>
            <li>
              <strong><TS>Trabajos que vienen de una solicitud de fabricación (licitación):</TS></strong> <TS>son una conexión entre cliente y taller y no pagan
              comisión a HETNA; HETNA cobra a los talleres sus planes de suscripción. Antes de que el cliente elija una propuesta, la comunicación va
              por HETNA y los datos de contacto se ocultan; al elegir, el cliente decide si comparte su contacto con el taller elegido y pueden
              acordar el pago dentro o fuera de la plataforma.</TS>
            </li>
            <li>
              <strong><TS>Protección del pago (pagar dentro de HETNA, incluido el pago a HETNA como respaldo y el acuerdo SafeDeal):</TS></strong> <TS>es opcional
              en las licitaciones y no tiene costo adicional de HETNA; sólo aplica la tarifa del medio de pago cuando el cliente paga directo a la
              cuenta del taller. Lo que se paga fuera de la plataforma no tiene esta protección (cláusula 6).</TS>
            </li>
            <li>
              <strong><TS>Cobros en línea que un taller hace a sus propios clientes con la app del Cotizador:</TS></strong> <TS>pagan la comisión por cobro que
              indica la lista de precios según el plan del taller, con tope por cobro.</TS>
            </li>
          </ul>
        </li>
        <li><TS>Deben cumplir sus propias obligaciones fiscales.</TS></li>
        <li>
          <TS>Además de estos términos, a los vendedores les aplican los</TS>{" "}
          <LocalizedClientLink href="/terminos-vendedores"><TS>Términos para vendedores</TS></LocalizedClientLink>.
        </li>
      </ul>

      <h2><TS>6. Pagos y protección</TS></h2>
      <ul>
        <li><TS>Los pagos dentro de HETNA se hacen por los medios que indica la plataforma. Sólo esos pagos tienen la protección de HETNA: el pago queda registrado, se puede pagar a HETNA como respaldo para que lo libere al taller cuando el cliente confirma que recibió, aplica la Política de devoluciones y, si cliente y taller lo firman, el acuerdo HETNA SafeDeal.</TS></li>
        <li>
          <strong><TS>Anticipos y pagos parciales.</TS></strong> <TS>Cada propuesta indica si pide anticipo y de qué porcentaje. Si el
          cliente paga a HETNA, HETNA retiene el anticipo y los pagos siguientes hasta que el trabajo termina; si paga directo
          a la cuenta del taller conectada a HETNA, el dinero llega al taller en el momento y aplican las reglas de esta
          cláusula para reportar problemas.</TS>
        </li>
        <li>
          <strong><TS>Cancelación.</TS></strong> <TS>Si el cliente cancela antes de que el taller reporte avance de fabricación, recupera
          el 100 % de lo que pagó. Después, aplica lo que diga su acuerdo SafeDeal o, si no lo hay, lo que decida HETNA según
          el avance y los materiales comprados.</TS>
        </li>
        <li>
          <strong><TS>Retrasos.</TS></strong> <TS>Si pasan</TS> {DIAS_RETRASO_CANCELACION} <TS>días de la fecha de entrega prometida en la
          propuesta sin que el pedido se entregue, el cliente puede cancelar con reembolso.</TS>
        </li>
        <li>
          <strong><TS>Piezas defectuosas y desacuerdos.</TS></strong> <TS>El cliente reporta el problema desde la liga de su solicitud,
          antes de confirmar que recibió. Si pagó a HETNA, HETNA retiene el pago; en todo caso pide evidencia a las dos partes (fotos, guía de envío,
          mensajes, acuerdo SafeDeal), les da oportunidad de responder y busca resolver en</TS> {DIAS_HABILES_DECISION_DISPUTA} <TS>días
          hábiles (es un objetivo de atención: un caso complejo puede tardar más, y se te avisa): liberar el pago al taller,
          reembolso parcial o reembolso total. La decisión queda registrada. Este procedimiento no limita tu derecho de
          acudir a la PROFECO o a los tribunales.</TS>
        </li>
        <li>
          <strong><TS>Liberación del pago al taller.</TS></strong> <TS>HETNA le paga al taller lo retenido cuando el cliente confirma que
          recibió o, si el cliente no confirma ni reporta un problema,</TS> {DIAS_CIERRE_AUTOMATICO} <TS>días después de que el
          taller marca el pedido como entregado. Con un problema abierto no se libera nada hasta que HETNA decide.</TS>
        </li>
        <li>
          <strong><TS>Pago directo al taller.</TS></strong> <TS>Si el cliente pagó directo a la cuenta del taller conectada a HETNA,
          HETNA no retiene ese dinero: el reembolso que corresponda según esta cláusula lo hace el taller, y HETNA puede
          suspender la cuenta del taller que no lo haga.</TS>
        </li>
        <li><TS>Si en una solicitud de fabricación cliente y taller acuerdan el pago o la entrega fuera de la plataforma, el trato es directamente entre ellos: HETNA no retiene ese pago ni responde por pagos, entregas o calidad acordados por fuera. Sí recibe reportes de fraude o mala conducta, que pueden causar la suspensión de la cuenta y quedar en la reputación del taller.</TS></li>
      </ul>

      <h2><TS>7. Envíos</TS></h2>
      <p>
        <TS>Los envíos se realizan con Envíos HETNA mediante paqueterías externas. Los tiempos son estimados y pueden variar por
        causas ajenas a HETNA.</TS>
      </p>

      <h2><TS>8. Propiedad intelectual</TS></h2>
      <p>
        <TS>Cada diseño digital se vende con una licencia (personal, comercial limitada o comercial ampliada) que se indica en
        su ficha antes de pagar y se explica en</TS>{" "}
        <LocalizedClientLink href="/licencias-disenos"><TS>Licencias de diseños digitales</TS></LocalizedClientLink><TS>. Con ninguna
        se permite revender ni compartir los archivos. Quien publica un diseño declara tener derecho a venderlo con la
        licencia que elige.</TS>
      </p>

      <h2><TS>9. Limitación de responsabilidad</TS></h2>
      <p>
        <TS>HETNA actúa como plataforma entre clientes y vendedores. Hacemos lo posible por verificar a los talleres y resolver
        problemas de compras hechas dentro de la plataforma, pero cada vendedor responde por sus productos y trabajos.</TS>
      </p>

      <h2><TS>10. Contacto y cambios</TS></h2>
      <p>
        <TS>Para cualquier duda escríbenos por</TS> {medioContacto()}<TS>. Podemos actualizar estos términos; la versión vigente es la
        publicada en esta página. Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Tus datos personales
        se tratan como explica el</TS> <LocalizedClientLink href="/aviso-de-privacidad"><TS>Aviso de privacidad</TS></LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
