import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto, responsableLegal } from "@/lib/hetna/empresa"
import { DIAS_CIERRE_AUTOMATICO, DIAS_HABILES_DECISION_DISPUTA, DIAS_RETRASO_CANCELACION } from "@/lib/hetna/promesas"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/terminos-y-condiciones" },
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de HETNA CNC para clientes, vendedores y talleres.",
}

export default function Terminos() {
  return (
    <PaginaInfo etiqueta="Legal" titulo="Términos y condiciones" resumen="Las reglas para usar HETNA CNC." actualizado="14 de noviembre de 2026">
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
        <li>Las ventas de la tienda y de la Academia (productos, diseños, cursos y libros) se cobran y gestionan dentro de la plataforma, con la comisión vigente de la lista de precios para vendedores. En ellas no está permitido compartir datos de contacto para cerrar la venta fuera de la plataforma; hacerlo puede causar la suspensión de la cuenta.</li>
        <li>Las solicitudes de fabricación (licitaciones) son una conexión entre cliente y taller y no pagan comisión a HETNA: HETNA cobra a los talleres sus planes de suscripción. Antes de que el cliente elija una propuesta, la comunicación va por HETNA y los datos de contacto se ocultan; al elegir, el cliente decide si comparte su contacto con el taller elegido y pueden acordar el pago dentro o fuera de la plataforma.</li>
        <li>Deben cumplir sus propias obligaciones fiscales.</li>
        <li>
          Además de estos términos, a los vendedores les aplican los{" "}
          <LocalizedClientLink href="/terminos-vendedores">Términos para vendedores</LocalizedClientLink>.
        </li>
      </ul>

      <h2>6. Pagos y protección</h2>
      <ul>
        <li>Los pagos dentro de HETNA se hacen por los medios que indica la plataforma. Sólo esos pagos tienen la protección de HETNA: el pago queda registrado, se puede pagar a HETNA como respaldo para que lo libere al taller cuando el cliente confirma que recibió, aplica la Política de devoluciones y, si cliente y taller lo firman, el acuerdo HETNA SafeDeal.</li>
        <li>
          <strong>Anticipos y pagos parciales.</strong> Cada propuesta indica si pide anticipo y de qué porcentaje. Si el
          cliente paga a HETNA, HETNA retiene el anticipo y los pagos siguientes hasta que el trabajo termina; si paga directo
          a la cuenta del taller conectada a HETNA, el dinero llega al taller en el momento y aplican las reglas de esta
          cláusula para reportar problemas.
        </li>
        <li>
          <strong>Cancelación.</strong> Si el cliente cancela antes de que el taller reporte avance de fabricación, recupera
          el 100 % de lo que pagó. Después, aplica lo que diga su acuerdo SafeDeal o, si no lo hay, lo que decida HETNA según
          el avance y los materiales comprados.
        </li>
        <li>
          <strong>Retrasos.</strong> Si pasan {DIAS_RETRASO_CANCELACION} días de la fecha de entrega prometida en la
          propuesta sin que el pedido se entregue, el cliente puede cancelar con reembolso.
        </li>
        <li>
          <strong>Piezas defectuosas y desacuerdos.</strong> El cliente reporta el problema desde la liga de su solicitud,
          antes de confirmar que recibió. Si pagó a HETNA, HETNA retiene el pago; en todo caso pide evidencia a las dos partes (fotos, guía de envío,
          mensajes, acuerdo SafeDeal), les da oportunidad de responder y busca resolver en {DIAS_HABILES_DECISION_DISPUTA} días
          hábiles (es un objetivo de atención: un caso complejo puede tardar más, y se te avisa): liberar el pago al taller,
          reembolso parcial o reembolso total. La decisión queda registrada. Este procedimiento no limita tu derecho de
          acudir a la PROFECO o a los tribunales.
        </li>
        <li>
          <strong>Liberación del pago al taller.</strong> HETNA le paga al taller lo retenido cuando el cliente confirma que
          recibió o, si el cliente no confirma ni reporta un problema, {DIAS_CIERRE_AUTOMATICO} días después de que el
          taller marca el pedido como entregado. Con un problema abierto no se libera nada hasta que HETNA decide.
        </li>
        <li>
          <strong>Pago directo al taller.</strong> Si el cliente pagó directo a la cuenta del taller conectada a HETNA,
          HETNA no retiene ese dinero: el reembolso que corresponda según esta cláusula lo hace el taller, y HETNA puede
          suspender la cuenta del taller que no lo haga.
        </li>
        <li>Si en una solicitud de fabricación cliente y taller acuerdan el pago o la entrega fuera de la plataforma, el trato es directamente entre ellos: HETNA no retiene ese pago ni responde por pagos, entregas o calidad acordados por fuera. Sí recibe reportes de fraude o mala conducta, que pueden causar la suspensión de la cuenta y quedar en la reputación del taller.</li>
      </ul>

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
