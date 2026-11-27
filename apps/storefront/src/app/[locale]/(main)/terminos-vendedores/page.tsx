import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto, responsableLegal } from "@/lib/hetna/empresa"
import { TablaTarifas } from "@/components/hetna/TablaTarifas"
import { DIAS_CIERRE_AUTOMATICO, DIAS_HABILES_DECISION_DISPUTA, DIAS_RETRASO_CANCELACION } from "@/lib/hetna/promesas"

// Términos y condiciones para vendedores y talleres (contrato del marketplace).
// Versión 1.7 · 25 nov 2026 (el cliente libera el pago o reporta un problema con evidencia; reclamos hasta 7 días con descuento al taller, cláusulas 8 y 11).
// Versión 1.6 · 19 nov 2026 (artículos de instructores en el blog bajan la comisión de cursos, cláusula 8).
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

const metadataEs: Metadata = {
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
        <TS>Versión</TS> {VERSION} <TS>· Vigentes desde el</TS> {VIGENCIA}
      </p>

      <h2><TS>1. Quiénes somos y qué acuerdan estos términos</TS></h2>
      <p>
        <TS>HETNA CNC (</TS>{EMPRESA.sitio}<TS>) es una plataforma operada por</TS> {responsableLegal("es")}<TS>, con domicilio en</TS>{" "}
        {EMPRESA.domicilioCompleto} <TS>(en adelante, «HETNA»). En HETNA, talleres, fabricantes y comercios (cada uno, el
        «Vendedor») publican y venden productos, diseños y servicios de CNC a clientes.</TS>
      </p>
      <p>
        <TS>Estos términos son el contrato entre HETNA y el Vendedor. Se suman a los</TS>{" "}
        <LocalizedClientLink href="/terminos-y-condiciones"><TS>Términos y condiciones</TS></LocalizedClientLink> <TS>generales y al</TS>{" "}
        <LocalizedClientLink href="/aviso-de-privacidad"><TS>Aviso de privacidad</TS></LocalizedClientLink><TS>. Si algo se contradice, para
        el Vendedor mandan estos términos.</TS>
      </p>
      <p>
        <TS>HETNA actúa como intermediario: pone la plataforma, cobra al cliente por cuenta del Vendedor y le entrega su pago. La
        venta de cada producto o servicio la hace el Vendedor, que es responsable frente al cliente por lo que vende.</TS>
      </p>

      <h2><TS>2. Aceptación</TS></h2>
      <p>
        <TS>Aceptas estos términos al marcar la casilla «He leído y acepto» en la entrada de tu panel de vendedor o en «Activa tu
        cuenta». HETNA guarda la versión que aceptaste, la fecha y la dirección IP. Cuando publiquemos una versión nueva te la
        pediremos de nuevo antes de publicar o cotizar. Si no estás de acuerdo, no uses la cuenta.</TS>
      </p>

      <h2><TS>3. Quién puede vender</TS></h2>
      <ul>
        <li><TS>Personas mayores de edad con capacidad legal para contratar, o empresas legalmente constituidas, representadas por alguien con facultades.</TS></li>
        <li><TS>Debes dar datos verdaderos y mantenerlos al día: nombre o razón social, contacto, domicilio del taller y, para recibir pagos y aplicar retenciones, tu RFC y tus datos bancarios.</TS></li>
        <li><TS>Eres responsable de lo que se haga con tu cuenta y de mantener segura tu contraseña. Si invitas a otras personas a tu cuenta, respondes por ellas.</TS></li>
        <li><TS>Para publicar productos, cursos o libros y para cotizar solicitudes debes tener sesión iniciada y verificar una tarjeta de débito o crédito a tu nombre o de tu negocio, con Mercado Pago o PayPal. Se hace un cargo de $10 MXN que se devuelve al momento; sólo sirve para comprobar que la cuenta es real. HETNA no ve ni guarda el número de la tarjeta y no la usa para otros cobros.</TS></li>
      </ul>

      <h2><TS>4. Verificación del taller</TS></h2>
      <ul>
        <li><TS>La verificación es voluntaria. Para obtener la insignia «Taller verificado» subes tu identificación oficial y fotos de tu taller desde tu panel (Verificación).</TS></li>
        <li><TS>Tus documentos son privados y se tratan solo para verificarte, como explica el Aviso de privacidad. Se borran automáticamente en los plazos que ahí se indican.</TS></li>
        <li><TS>HETNA puede negar o retirar la insignia si los documentos no coinciden, son falsos o el taller deja de cumplir estos términos. La insignia confirma que el taller existe; no es una garantía de cada trabajo.</TS></li>
      </ul>

      <h2><TS>5. Publicaciones</TS></h2>
      <ul>
        <li><TS>Tus productos y cambios se publican de inmediato, sin revisión previa de HETNA. Por eso eres el único responsable de que cada publicación sea verdadera, completa y legal.</TS></li>
        <li><TS>Describe con precisión: material, medidas, estado (nuevo o usado), tiempo de entrega, existencias, garantía y lo que incluye. Las fotos deben ser del producto real, con fondo blanco.</TS></li>
        <li><TS>Los precios se publican en pesos mexicanos y deben incluir los impuestos aplicables. El precio publicado es el que pagará el cliente; no puedes cobrar cargos adicionales fuera de la plataforma.</TS></li>
        <li><TS>HETNA puede ocultar o retirar, sin aviso previo, publicaciones que incumplan estos términos o la ley, y te avisará el motivo.</TS></li>
      </ul>

      <h2><TS>6. Productos y servicios prohibidos</TS></h2>
      <p><TS>No puedes publicar ni vender, entre otros:</TS></p>
      <ul>
        <li><TS>Armas, partes o accesorios de armas, y archivos o servicios para fabricarlos.</TS></li>
        <li><TS>Productos ilegales, robados, falsificados o que infrinjan marcas, patentes o derechos de autor (incluidos diseños DXF, SVG o STL de otras personas sin permiso).</TS></li>
        <li><TS>Productos que deban cumplir una Norma Oficial Mexicana o un permiso y no lo cumplan.</TS></li>
        <li><TS>Bases de datos o datos personales de terceros.</TS></li>
        <li><TS>Cualquier cosa cuya venta prohíba la ley o que ponga en riesgo la salud o la seguridad de las personas.</TS></li>
      </ul>

      <h2><TS>7. Propiedad intelectual</TS></h2>
      <ul>
        <li><TS>Declaras que tienes derecho a vender lo que publicas y a usar las fotos, textos, marcas y diseños de tus publicaciones.</TS></li>
        <li><TS>Das a HETNA permiso gratuito, no exclusivo y mientras dure tu cuenta, para mostrar ese contenido en el sitio, en sus redes sociales y en su publicidad, con el fin de promover tus productos y la plataforma.</TS></li>
        <li>
          <TS>Videos y fotos de tus trabajos: si los subes en &quot;Promociona tu taller&quot; y marcas la casilla de autorización, das a HETNA permiso gratuito y no
          exclusivo para publicarlos en el sitio, en sus redes sociales y en su publicidad, siempre con el nombre de tu taller y la liga a tu perfil. Puedes
          retirarlos cuando quieras desde tu panel: HETNA deja de usarlos y quita en un plazo razonable lo que ya haya publicado. Al subirlos declaras que
          son tuyos, que no incluyen música, marcas ni imágenes de terceros sin permiso y que tienes permiso de tu cliente para mostrar la pieza, o que en
          ellos no se reconoce su diseño ni información confidencial.</TS>
        </li>
        <li><TS>Si alguien reclama que una publicación infringe sus derechos, HETNA puede retirarla mientras se aclara, y te pedirá tu respuesta. Los reclamos se envían por</TS> {medioContacto()}.</li>
      </ul>

      <h2><TS>8. Ventas, comisiones y pagos</TS></h2>
      <ul>
        <li><TS>El cliente paga dentro de la plataforma (PayPal, Mercado Pago u otros medios que indique HETNA). HETNA recibe el pago por tu cuenta.</TS></li>
        <li><TS>HETNA te paga el importe de cada venta menos la comisión vigente y, en su caso, las retenciones de impuestos (cláusula 9) y los costos de envío que correspondan. La comisión depende del tipo de producto y está en la lista de precios de esta misma cláusula (abajo) y en tu panel, en Mi tablero. Publicar es gratis: sólo se cobra cuando vendes.</TS></li>
        <li><TS>Cuándo se libera tu pago: los diseños y archivos digitales, en cuanto se confirma el pago del cliente; los productos físicos, en cuanto el cliente toca «Todo bien, liberar pago» en su compra o, si no hace nada, 3 días después de que el pedido se entrega (lo marca el rastreo de la guía). Si el cliente toca «Tengo un problema», el pago se congela hasta que HETNA decide. Ves tu saldo pendiente, disponible y pagado en tu panel, en Mi saldo.</TS></li>
        <li><TS>El cliente puede reportar un problema hasta 7 días naturales después de la entrega. Si el reclamo procede cuando tu pago ya se liberó o ya se te pagó, el reembolso (y la guía de regreso, cuando la culpa es tuya) se descuenta de tus siguientes ventas. Lo mismo aplica a una devolución o un contracargo procedente. HETNA puede retener pagos relacionados con una devolución, un contracargo, un reclamo o una sospecha de fraude, mientras se resuelve.</TS></li>
        <li><TS>Cursos, libros y PDF de la Academia HETNA: publicarlos es gratis. Si los cobras, HETNA cobra la comisión que indica la lista de precios (abajo) sobre el precio de cada venta y el resto se abona a tu saldo en cuanto se confirma el pago. Lo que publicas gratis no paga comisión.</TS></li>
        <li><TS>Artículos en el blog: si eres instructor y escribes artículos propios en el blog de HETNA (desde tu panel, sección Blog), cada artículo que HETNA aprueba baja la comisión de tus cursos como indica la lista de precios, durante el tiempo que ahí se señala. Aplica a ventas nuevas. HETNA puede rechazar o retirar artículos copiados, publicitarios o que no aporten, y entonces dejan de contar.</TS></li>
        <li><TS>Al publicar un libro, PDF o curso declaras que el contenido es tuyo o que tienes permiso para venderlo. HETNA puede retirar el que infrinja derechos de terceros (cláusula 7).</TS></li>
        <li><TS>Los cambios de comisión o de plan se avisan con al menos 15 días de anticipación y no afectan pedidos ya pagados.</TS></li>
        <li><TS>Ventas de la tienda y de la Academia: está prohibido cerrarlas fuera de la plataforma o pedir al cliente que pague por otro medio. Hacerlo puede causar la suspensión de la cuenta.</TS></li>
        <li><TS>Solicitudes de fabricación (licitaciones): son una conexión con el cliente y no pagan comisión a HETNA; lo que pagas son tus planes de suscripción (lista de precios, abajo). Antes de que el cliente te elija, la comunicación va por HETNA y no puedes pedir ni dar datos de contacto. Si te elige y comparte su contacto, pueden acordar el pago dentro o fuera de la plataforma. Sólo el pago hecho dentro de HETNA (directo a tu Mercado Pago o PayPal conectado, o a HETNA como respaldo, que te lo libera cuando el cliente confirma que recibió) queda registrado y protegido; lo acordado por fuera es directamente entre tú y el cliente.</TS></li>
        <li>
          <TS>Protección en solicitudes de fabricación pagadas dentro de HETNA: si el cliente cancela antes de que reportes avance
          de fabricación en tu panel, se le devuelve el 100 % de lo que pagó. Si pasan</TS> {DIAS_RETRASO_CANCELACION} <TS>días de la
          fecha de entrega que prometiste sin entregar, el cliente puede cancelar con reembolso. Si el cliente
          reporta un problema (pieza defectuosa, distinta a lo acordado u otro), HETNA retiene lo que haya cobrado, te pide tu versión y tu
          evidencia, y decide en un máximo de</TS> {DIAS_HABILES_DECISION_DISPUTA} <TS>días hábiles: liberarte el pago, reembolso parcial
          o total. Lo que retiene HETNA se te libera cuando el cliente confirma que recibió o</TS> {DIAS_CIERRE_AUTOMATICO} <TS>días
          después de que marcas el pedido como entregado, si no hay un problema abierto. Si te pagó directo a tu cuenta
          conectada, respondes tú del reembolso que decida HETNA; no hacerlo puede causar la suspensión de la cuenta.</TS>
        </li>
      </ul>

      <h3 id="tarifas"><TS>Lista de precios y comisiones</TS></h3>
      <p><TS>Lo que cuesta cada servicio de HETNA. La misma lista aparece en la portada de tu panel de vendedor.</TS></p>
      <TablaTarifas />

      <h2><TS>9. Impuestos</TS></h2>
      <ul>
        <li><TS>Cada Vendedor cumple sus propias obligaciones fiscales y emite los comprobantes (CFDI) que le correspondan por sus ventas.</TS></li>
        <li><TS>Cuando la ley obligue a HETNA, como plataforma digital de intermediación, a retener impuestos (ISR e IVA) de los pagos que te hace, HETNA los retendrá, los enterará al SAT y te entregará el comprobante de retenciones. Si no proporcionas tu RFC, la ley puede obligar a retenciones mayores.</TS></li>
      </ul>

      <h2><TS>10. Envíos y entregas</TS></h2>
      <ul>
        <li><TS>Debes preparar y entregar cada pedido en el tiempo publicado, bien empacado para que llegue en buen estado.</TS></li>
        <li><TS>Si usas Envíos HETNA, la guía se genera desde tu panel; si entregas por tu cuenta, debes registrar el número de rastreo.</TS></li>
        <li>
          <TS>Si usas Envíos HETNA, la guía se cotiza con el peso y las medidas de tus productos. Antes de comprarla confirmas que la caja ya
          embalada mide y pesa eso o menos. Si la paquetería reporta más (sobrepeso), ese cobro es tuyo: puedes pagarlo con la liga que te
          mandamos o se descuenta de tu siguiente pago de ventas. Mientras tengas un sobrepeso por pagar no podrás generar nuevas guías.</TS>
        </li>
        <li>
          <TS>Con la etiqueta pegada y antes de entregar la caja, sube en tu panel (Guías) 4 fotos con la guía visible: alto, largo y ancho con
          cinta métrica y la caja en la báscula. Son la prueba para disputar un sobrepeso. Si pasan 24 horas sin subirlas, no podrás generar
          otra guía hasta que lo hagas, y sin ellas el sobrepeso se cobra completo.</TS>
        </li>
        <li><TS>Si no puedes cumplir un pedido, avisa al cliente y a HETNA de inmediato; el cliente podrá cancelar y recibir su reembolso.</TS></li>
      </ul>

      <h2><TS>11. Devoluciones, garantías y atención al cliente</TS></h2>
      <ul>
        <li><TS>Debes respetar la</TS> <LocalizedClientLink href="/devoluciones"><TS>Política de devoluciones</TS></LocalizedClientLink> <TS>de HETNA y las garantías que ofreces en tus publicaciones, así como la Ley Federal de Protección al Consumidor.</TS></li>
        <li><TS>Debes responder las preguntas y reclamos de los clientes dentro de la plataforma, en un plazo máximo de 3 días hábiles. Los reclamos de compras los respondes en tu panel, en Reclamos, con tu versión y tu evidencia (fotos del producto antes de enviarlo, del empaque, la guía). Si no respondes a tiempo, el reclamo se resuelve a favor del cliente.</TS></li>
        <li><TS>En una devolución, la guía de regreso la pagas tú si el producto llegó dañado, incompleto, distinto, con defecto o no llegó; la paga el cliente si se arrepintió de la compra.</TS></li>
        <li><TS>Si una devolución o reembolso procede por causa tuya, el importe se descuenta de tus pagos.</TS></li>
      </ul>

      <h2><TS>12. Datos personales de los clientes</TS></h2>
      <ul>
        <li><TS>Para cumplir un pedido recibes algunos datos del cliente (nombre, dirección de entrega, teléfono). Los recibes como responsable independiente: debes usarlos solo para fabricar, enviar y dar garantía de ese pedido, y cumplir la ley de protección de datos que te aplique.</TS></li>
        <li><TS>No puedes usarlos para enviar publicidad sin el consentimiento del cliente, venderlos, compartirlos ni contactar al cliente para hacer tratos fuera de HETNA. En las solicitudes de fabricación, el contacto que el cliente decide compartirte al elegirte sólo puedes usarlo para ese trabajo.</TS></li>
        <li><TS>Debes protegerlos y borrarlos cuando ya no los necesites. Si sufres una pérdida o robo de esos datos, avisa a HETNA de inmediato.</TS></li>
        <li><TS>Tus propios datos como Vendedor (incluidos los bancarios y los de verificación) se tratan como explica el Aviso de privacidad.</TS></li>
      </ul>

      <h2><TS>13. Conducta</TS></h2>
      <ul>
        <li><TS>Trato respetuoso con clientes, otros vendedores y el equipo de HETNA.</TS></li>
        <li><TS>No manipular reseñas, calificaciones ni posiciones en el sitio (por ejemplo, con compras o reseñas falsas).</TS></li>
        <li><TS>No usar la plataforma para enviar spam, malware o intentar acceder a cuentas o datos ajenos.</TS></li>
      </ul>

      <h2><TS>14. Suspensión y baja</TS></h2>
      <ul>
        <li><TS>HETNA puede suspender o dar de baja una cuenta que incumpla estos términos o la ley. Salvo en casos graves (fraude, productos prohibidos, riesgo para personas), primero te avisará el motivo y te dará la oportunidad de corregirlo.</TS></li>
        <li><TS>Puedes darte de baja cuando quieras desde tu panel o escribiendo por</TS> {medioContacto()}<TS>. Debes terminar los pedidos que ya estén pagados.</TS></li>
        <li><TS>Al terminar la relación, HETNA te pagará los saldos pendientes una vez concluidos los plazos de devolución y los reclamos abiertos.</TS></li>
      </ul>

      <h2><TS>15. Responsabilidad</TS></h2>
      <ul>
        <li><TS>Respondes por tus productos, servicios, publicaciones y por el cumplimiento de tus obligaciones legales y fiscales.</TS></li>
        <li><TS>Te comprometes a sacar en paz y a salvo a HETNA, y a reembolsarle los gastos razonables, frente a reclamaciones de clientes, autoridades o terceros causadas por tus productos, tus publicaciones o tu incumplimiento de estos términos.</TS></li>
        <li><TS>HETNA hace lo razonable para que la plataforma funcione, pero no responde por interrupciones, fallas de terceros (bancos, procesadores de pago, paqueterías) ni por ventas que no se concreten. Nada de esto limita los derechos que la ley da a los consumidores.</TS></li>
      </ul>

      <h2><TS>16. Relación entre las partes</TS></h2>
      <p>
        <TS>HETNA y el Vendedor son independientes. Estos términos no crean una sociedad, relación laboral, de agencia ni de
        franquicia.</TS>
      </p>

      <h2><TS>17. Cambios a estos términos</TS></h2>
      <p>
        <TS>HETNA puede actualizar estos términos. Te avisará por correo o en tu panel con al menos 15 días de anticipación. Si
        sigues vendiendo después de esa fecha, aceptas los nuevos términos; si no estás de acuerdo, puedes darte de baja.</TS>
      </p>

      <h2><TS>18. Ley aplicable y tribunales</TS></h2>
      <p>
        <TS>Estos términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Para cualquier controversia, las
        partes se someten a los tribunales competentes de Apizaco, Tlaxcala, y renuncian a cualquier otro fuero que pudiera
        corresponderles por su domicilio presente o futuro.</TS>
      </p>

      <h2><TS>19. Contacto</TS></h2>
      <p><TS>Para dudas sobre estos términos escríbenos por</TS> {medioContacto()}.</p>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
