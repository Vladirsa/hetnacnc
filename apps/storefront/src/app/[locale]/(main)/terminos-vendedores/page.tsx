import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto, responsableLegal } from "@/lib/hetna/empresa"
import { TablaTarifas } from "@/components/hetna/TablaTarifas"
import { DIAS_CIERRE_AUTOMATICO, DIAS_HABILES_DECISION_DISPUTA, DIAS_RETRASO_CANCELACION } from "@/lib/hetna/promesas"

// Términos y condiciones para vendedores y talleres (contrato del marketplace).
// Versión 1.5 · 12 nov 2026 (cancelaciones, retrasos, disputas y liberación de pagos en solicitudes de fabricación, cláusula 8).
// Versión 1.4 · 12 nov 2026 (licitaciones como conexión sin comisión y protección sólo en pagos dentro, cláusula 8).
// Versión 1.3 · 4 nov 2026 (aceptación expresa en el panel y verificación de tarjeta, cláusulas 2 y 3).
// Versión 1.2 · 3 nov 2026 (libros y PDF de la Academia y lista de precios, cláusula 8).
// Versión 1.1 · 1 nov 2026 (comisión de cursos de la Academia, cláusula 8).
// Versión 1.0 · 28 oct 2026. BORRADOR para revisión de abogado y contador:
// ver "Paquete legal HETNA" (preguntas abiertas). Al cambiarlo, sube la versión
// y avisa a los vendedores con 15 días de anticipación (cláusula 17).
// La misma versión va en TERMINOS_VERSION de packages/api/src/lib/requisitos-vendedor.ts:
// al cambiarla, cada vendedor la vuelve a aceptar en su panel.
const VERSION = "1.3"
const VIGENCIA = "4 de noviembre de 2026"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/terminos-vendedores" },
  title: "Términos para vendedores",
  description:
    "Términos y condiciones para vendedores y talleres de HETNA CNC: publicaciones, comisiones, pagos, impuestos, envíos, devoluciones, datos personales y baja.",
}

export default function TerminosVendedores() {
  return (
    <PaginaInfo
      etiqueta="Legal"
      titulo="Términos para vendedores"
      resumen="Las reglas para vender productos y servicios en HETNA CNC."
    >
      <p className="text-sm text-[#6B6A63]">
        Versión {VERSION} · Vigentes desde el {VIGENCIA}
      </p>

      <h2>1. Quiénes somos y qué acuerdan estos términos</h2>
      <p>
        HETNA CNC ({EMPRESA.sitio}) es una plataforma operada por {responsableLegal("es")}, con domicilio en{" "}
        {EMPRESA.domicilioCompleto} (en adelante, «HETNA»). En HETNA, talleres, fabricantes y comercios (cada uno, el
        «Vendedor») publican y venden productos, diseños y servicios de CNC a clientes.
      </p>
      <p>
        Estos términos son el contrato entre HETNA y el Vendedor. Se suman a los{" "}
        <LocalizedClientLink href="/terminos-y-condiciones">Términos y condiciones</LocalizedClientLink> generales y al{" "}
        <LocalizedClientLink href="/aviso-de-privacidad">Aviso de privacidad</LocalizedClientLink>. Si algo se contradice, para
        el Vendedor mandan estos términos.
      </p>
      <p>
        HETNA actúa como intermediario: pone la plataforma, cobra al cliente por cuenta del Vendedor y le entrega su pago. La
        venta de cada producto o servicio la hace el Vendedor, que es responsable frente al cliente por lo que vende.
      </p>

      <h2>2. Aceptación</h2>
      <p>
        Aceptas estos términos al marcar la casilla «He leído y acepto» en la entrada de tu panel de vendedor o en «Activa tu
        cuenta». HETNA guarda la versión que aceptaste, la fecha y la dirección IP. Cuando publiquemos una versión nueva te la
        pediremos de nuevo antes de publicar o cotizar. Si no estás de acuerdo, no uses la cuenta.
      </p>

      <h2>3. Quién puede vender</h2>
      <ul>
        <li>Personas mayores de edad con capacidad legal para contratar, o empresas legalmente constituidas, representadas por alguien con facultades.</li>
        <li>Debes dar datos verdaderos y mantenerlos al día: nombre o razón social, contacto, domicilio del taller y, para recibir pagos y aplicar retenciones, tu RFC y tus datos bancarios.</li>
        <li>Eres responsable de lo que se haga con tu cuenta y de mantener segura tu contraseña. Si invitas a otras personas a tu cuenta, respondes por ellas.</li>
        <li>Para publicar productos, cursos o libros y para cotizar solicitudes debes tener sesión iniciada y verificar una tarjeta de débito o crédito a tu nombre o de tu negocio, con Mercado Pago o PayPal. Se hace un cargo de $10 MXN que se devuelve al momento; sólo sirve para comprobar que la cuenta es real. HETNA no ve ni guarda el número de la tarjeta y no la usa para otros cobros.</li>
      </ul>

      <h2>4. Verificación del taller</h2>
      <ul>
        <li>La verificación es voluntaria. Para obtener la insignia «Taller verificado» subes tu identificación oficial y fotos de tu taller desde tu panel (Verificación).</li>
        <li>Tus documentos son privados y se tratan solo para verificarte, como explica el Aviso de privacidad. Se borran automáticamente en los plazos que ahí se indican.</li>
        <li>HETNA puede negar o retirar la insignia si los documentos no coinciden, son falsos o el taller deja de cumplir estos términos. La insignia confirma que el taller existe; no es una garantía de cada trabajo.</li>
      </ul>

      <h2>5. Publicaciones</h2>
      <ul>
        <li>Tus productos y cambios se publican de inmediato, sin revisión previa de HETNA. Por eso eres el único responsable de que cada publicación sea verdadera, completa y legal.</li>
        <li>Describe con precisión: material, medidas, estado (nuevo o usado), tiempo de entrega, existencias, garantía y lo que incluye. Las fotos deben ser del producto real, con fondo blanco.</li>
        <li>Los precios se publican en pesos mexicanos y deben incluir los impuestos aplicables. El precio publicado es el que pagará el cliente; no puedes cobrar cargos adicionales fuera de la plataforma.</li>
        <li>HETNA puede ocultar o retirar, sin aviso previo, publicaciones que incumplan estos términos o la ley, y te avisará el motivo.</li>
      </ul>

      <h2>6. Productos y servicios prohibidos</h2>
      <p>No puedes publicar ni vender, entre otros:</p>
      <ul>
        <li>Armas, partes o accesorios de armas, y archivos o servicios para fabricarlos.</li>
        <li>Productos ilegales, robados, falsificados o que infrinjan marcas, patentes o derechos de autor (incluidos diseños DXF, SVG o STL de otras personas sin permiso).</li>
        <li>Productos que deban cumplir una Norma Oficial Mexicana o un permiso y no lo cumplan.</li>
        <li>Bases de datos o datos personales de terceros.</li>
        <li>Cualquier cosa cuya venta prohíba la ley o que ponga en riesgo la salud o la seguridad de las personas.</li>
      </ul>

      <h2>7. Propiedad intelectual</h2>
      <ul>
        <li>Declaras que tienes derecho a vender lo que publicas y a usar las fotos, textos, marcas y diseños de tus publicaciones.</li>
        <li>Das a HETNA permiso gratuito, no exclusivo y mientras dure tu cuenta, para mostrar ese contenido en el sitio, en sus redes sociales y en su publicidad, con el fin de promover tus productos y la plataforma.</li>
        <li>
          Videos y fotos de tus trabajos: si los subes en &quot;Promociona tu taller&quot; y marcas la casilla de autorización, das a HETNA permiso gratuito y no
          exclusivo para publicarlos en el sitio, en sus redes sociales y en su publicidad, siempre con el nombre de tu taller y la liga a tu perfil. Puedes
          retirarlos cuando quieras desde tu panel: HETNA deja de usarlos y quita en un plazo razonable lo que ya haya publicado. Al subirlos declaras que
          son tuyos, que no incluyen música, marcas ni imágenes de terceros sin permiso y que tienes permiso de tu cliente para mostrar la pieza, o que en
          ellos no se reconoce su diseño ni información confidencial.
        </li>
        <li>Si alguien reclama que una publicación infringe sus derechos, HETNA puede retirarla mientras se aclara, y te pedirá tu respuesta. Los reclamos se envían por {medioContacto()}.</li>
      </ul>

      <h2>8. Ventas, comisiones y pagos</h2>
      <ul>
        <li>El cliente paga dentro de la plataforma (PayPal, Mercado Pago u otros medios que indique HETNA). HETNA recibe el pago por tu cuenta.</li>
        <li>HETNA te paga el importe de cada venta menos la comisión vigente y, en su caso, las retenciones de impuestos (cláusula 9) y los costos de envío que correspondan. La comisión depende del tipo de producto y está en la lista de precios de esta misma cláusula (abajo) y en tu panel, en Mi tablero. Publicar es gratis: sólo se cobra cuando vendes.</li>
        <li>Cuándo se libera tu pago: los diseños y archivos digitales, en cuanto se confirma el pago del cliente; los productos físicos, 3 días después de que el pedido se entrega (lo marca el rastreo de la guía o el cliente al confirmar que lo recibió). Ves tu saldo pendiente, disponible y pagado en tu panel, en Mi saldo.</li>
        <li>Si después hay una devolución, un contracargo o un reclamo procedente dentro del plazo que tiene el cliente, el importe se descuenta de tu siguiente pago. HETNA puede retener pagos relacionados con una devolución, un contracargo, un reclamo o una sospecha de fraude, mientras se resuelve.</li>
        <li>Cursos, libros y PDF de la Academia HETNA: publicarlos es gratis. Si los cobras, HETNA cobra la comisión que indica la lista de precios (abajo) sobre el precio de cada venta y el resto se abona a tu saldo en cuanto se confirma el pago. Lo que publicas gratis no paga comisión.</li>
        <li>Al publicar un libro, PDF o curso declaras que el contenido es tuyo o que tienes permiso para venderlo. HETNA puede retirar el que infrinja derechos de terceros (cláusula 7).</li>
        <li>Los cambios de comisión o de plan se avisan con al menos 15 días de anticipación y no afectan pedidos ya pagados.</li>
        <li>Ventas de la tienda y de la Academia: está prohibido cerrarlas fuera de la plataforma o pedir al cliente que pague por otro medio. Hacerlo puede causar la suspensión de la cuenta.</li>
        <li>Solicitudes de fabricación (licitaciones): son una conexión con el cliente y no pagan comisión a HETNA; lo que pagas son tus planes de suscripción (lista de precios, abajo). Antes de que el cliente te elija, la comunicación va por HETNA y no puedes pedir ni dar datos de contacto. Si te elige y comparte su contacto, pueden acordar el pago dentro o fuera de la plataforma. Sólo el pago hecho dentro de HETNA (directo a tu Mercado Pago o PayPal conectado, o a HETNA como respaldo, que te lo libera cuando el cliente confirma que recibió) queda registrado y protegido; lo acordado por fuera es directamente entre tú y el cliente.</li>
        <li>
          Protección en solicitudes de fabricación pagadas dentro de HETNA: si el cliente cancela antes de que marques el
          trabajo "en producción", se le devuelve el 100 % de lo que pagó a HETNA. Si pasan {DIAS_RETRASO_CANCELACION} días de la
          fecha de entrega que prometiste sin entregar, el cliente puede cancelar con reembolso de lo retenido. Si el cliente
          reporta un problema (pieza defectuosa, distinta a lo acordado u otro), HETNA retiene el pago, te pide tu versión y tu
          evidencia, y decide en un máximo de {DIAS_HABILES_DECISION_DISPUTA} días hábiles: liberarte el pago, reembolso parcial
          o total. Lo que retiene HETNA se te libera cuando el cliente confirma que recibió o {DIAS_CIERRE_AUTOMATICO} días
          después de que marcas el pedido como entregado, si no hay un problema abierto. Si te pagó directo a tu cuenta
          conectada, respondes tú del reembolso que decida HETNA; no hacerlo puede causar la suspensión de la cuenta.
        </li>
      </ul>

      <h3 id="tarifas">Lista de precios y comisiones</h3>
      <p>Lo que cuesta cada servicio de HETNA. La misma lista aparece en la portada de tu panel de vendedor.</p>
      <TablaTarifas />

      <h2>9. Impuestos</h2>
      <ul>
        <li>Cada Vendedor cumple sus propias obligaciones fiscales y emite los comprobantes (CFDI) que le correspondan por sus ventas.</li>
        <li>Cuando la ley obligue a HETNA, como plataforma digital de intermediación, a retener impuestos (ISR e IVA) de los pagos que te hace, HETNA los retendrá, los enterará al SAT y te entregará el comprobante de retenciones. Si no proporcionas tu RFC, la ley puede obligar a retenciones mayores.</li>
      </ul>

      <h2>10. Envíos y entregas</h2>
      <ul>
        <li>Debes preparar y entregar cada pedido en el tiempo publicado, bien empacado para que llegue en buen estado.</li>
        <li>Si usas Envíos HETNA, la guía se genera desde tu panel; si entregas por tu cuenta, debes registrar el número de rastreo.</li>
        <li>
          Si usas Envíos HETNA, la guía se cotiza con el peso y las medidas de tus productos. Antes de comprarla confirmas que la caja ya
          embalada mide y pesa eso o menos. Si la paquetería reporta más (sobrepeso), ese cobro es tuyo: puedes pagarlo con la liga que te
          mandamos o se descuenta de tu siguiente pago de ventas. Mientras tengas un sobrepeso por pagar no podrás generar nuevas guías.
        </li>
        <li>
          Con la etiqueta pegada y antes de entregar la caja, sube en tu panel (Guías) 4 fotos con la guía visible: alto, largo y ancho con
          cinta métrica y la caja en la báscula. Son la prueba para disputar un sobrepeso. Si pasan 24 horas sin subirlas, no podrás generar
          otra guía hasta que lo hagas, y sin ellas el sobrepeso se cobra completo.
        </li>
        <li>Si no puedes cumplir un pedido, avisa al cliente y a HETNA de inmediato; el cliente podrá cancelar y recibir su reembolso.</li>
      </ul>

      <h2>11. Devoluciones, garantías y atención al cliente</h2>
      <ul>
        <li>Debes respetar la <LocalizedClientLink href="/devoluciones">Política de devoluciones</LocalizedClientLink> de HETNA y las garantías que ofreces en tus publicaciones, así como la Ley Federal de Protección al Consumidor.</li>
        <li>Debes responder las preguntas y reclamos de los clientes dentro de la plataforma, en un plazo máximo de 3 días hábiles.</li>
        <li>Si una devolución o reembolso procede por causa tuya, el importe se descuenta de tus pagos.</li>
      </ul>

      <h2>12. Datos personales de los clientes</h2>
      <ul>
        <li>Para cumplir un pedido recibes algunos datos del cliente (nombre, dirección de entrega, teléfono). Los recibes como responsable independiente: debes usarlos solo para fabricar, enviar y dar garantía de ese pedido, y cumplir la ley de protección de datos que te aplique.</li>
        <li>No puedes usarlos para enviar publicidad sin el consentimiento del cliente, venderlos, compartirlos ni contactar al cliente para hacer tratos fuera de HETNA. En las solicitudes de fabricación, el contacto que el cliente decide compartirte al elegirte sólo puedes usarlo para ese trabajo.</li>
        <li>Debes protegerlos y borrarlos cuando ya no los necesites. Si sufres una pérdida o robo de esos datos, avisa a HETNA de inmediato.</li>
        <li>Tus propios datos como Vendedor (incluidos los bancarios y los de verificación) se tratan como explica el Aviso de privacidad.</li>
      </ul>

      <h2>13. Conducta</h2>
      <ul>
        <li>Trato respetuoso con clientes, otros vendedores y el equipo de HETNA.</li>
        <li>No manipular reseñas, calificaciones ni posiciones en el sitio (por ejemplo, con compras o reseñas falsas).</li>
        <li>No usar la plataforma para enviar spam, malware o intentar acceder a cuentas o datos ajenos.</li>
      </ul>

      <h2>14. Suspensión y baja</h2>
      <ul>
        <li>HETNA puede suspender o dar de baja una cuenta que incumpla estos términos o la ley. Salvo en casos graves (fraude, productos prohibidos, riesgo para personas), primero te avisará el motivo y te dará la oportunidad de corregirlo.</li>
        <li>Puedes darte de baja cuando quieras desde tu panel o escribiendo por {medioContacto()}. Debes terminar los pedidos que ya estén pagados.</li>
        <li>Al terminar la relación, HETNA te pagará los saldos pendientes una vez concluidos los plazos de devolución y los reclamos abiertos.</li>
      </ul>

      <h2>15. Responsabilidad</h2>
      <ul>
        <li>Respondes por tus productos, servicios, publicaciones y por el cumplimiento de tus obligaciones legales y fiscales.</li>
        <li>Te comprometes a sacar en paz y a salvo a HETNA, y a reembolsarle los gastos razonables, frente a reclamaciones de clientes, autoridades o terceros causadas por tus productos, tus publicaciones o tu incumplimiento de estos términos.</li>
        <li>HETNA hace lo razonable para que la plataforma funcione, pero no responde por interrupciones, fallas de terceros (bancos, procesadores de pago, paqueterías) ni por ventas que no se concreten. Nada de esto limita los derechos que la ley da a los consumidores.</li>
      </ul>

      <h2>16. Relación entre las partes</h2>
      <p>
        HETNA y el Vendedor son independientes. Estos términos no crean una sociedad, relación laboral, de agencia ni de
        franquicia.
      </p>

      <h2>17. Cambios a estos términos</h2>
      <p>
        HETNA puede actualizar estos términos. Te avisará por correo o en tu panel con al menos 15 días de anticipación. Si
        sigues vendiendo después de esa fecha, aceptas los nuevos términos; si no estás de acuerdo, puedes darte de baja.
      </p>

      <h2>18. Ley aplicable y tribunales</h2>
      <p>
        Estos términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Para cualquier controversia, las
        partes se someten a los tribunales competentes de Apizaco, Tlaxcala, y renuncian a cualquier otro fuero que pudiera
        corresponderles por su domicilio presente o futuro.
      </p>

      <h2>19. Contacto</h2>
      <p>Para dudas sobre estos términos escríbenos por {medioContacto()}.</p>
    </PaginaInfo>
  )
}
