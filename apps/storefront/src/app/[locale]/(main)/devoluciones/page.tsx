import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto } from "@/lib/hetna/empresa"

// Política de devoluciones y reembolsos (reescrita el 25 nov 2026 a pedido del
// dueño: más casos, siempre cuidando a la plataforma). Idea central: HETNA es
// el intermediario; quien devuelve, cambia o reembolsa es el vendedor o taller,
// y el dinero del cliente queda retenido hasta que recibe bien, así que el
// reembolso sale de ese pago y no de HETNA. Debe coincidir con /reclamaciones
// (mediación, liberación del pago) y con los Términos y condiciones.
// 25 nov 2026 (tarde): el reporte ya se hace desde la compra ("Tengo un
// problema", packages/api/src/lib/reclamos-pedido.ts) y el pago se libera
// con "Todo bien, liberar pago" o solo a los 3 días de la entrega (opción C:
// lo que se devuelva entre el día 4 y el 7 se le descuenta al vendedor).

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/devoluciones" },
  title: "Devoluciones y reembolsos",
  description:
    "Qué puedes devolver en HETNA CNC, en qué plazo, quién paga el envío y cómo te reembolsan: productos físicos, importación, trabajos a la medida y diseños digitales.",
}

const HORAS_REPORTE = 48 // horas desde la entrega para reportar daño, faltantes o algo distinto
const DIAS_RESPUESTA = 3 // días hábiles que tiene el vendedor para contestar (Términos para vendedores, cláusula 11)

export default function Devoluciones() {
  return (
    <PaginaInfo
      etiqueta="Ayuda"
      titulo="Devoluciones y reembolsos"
      resumen="Qué puedes devolver, en qué plazo, quién paga el envío y cómo te reembolsan."
      actualizado="25 de noviembre de 2026"
    >
      <h2><TS>En resumen</TS></h2>
      <ul>
        <li>
          <strong><TS>Tu pago está protegido.</TS></strong> <TS>Cuando compras dentro de HETNA, el vendedor o taller no recibe tu dinero hasta que
          tocas «Todo bien, liberar pago» en tu compra. Si no haces nada, se libera solo</TS> {EMPRESA.diasLiberacion} <TS>días después de la entrega.</TS>
        </li>
        <li>
          <strong><TS>Quien resuelve es el vendedor o taller.</TS></strong> <TS>Cada producto lo vende y lo envía un vendedor o taller registrado: es
          quien hace la devolución, el cambio o el reembolso. HETNA es la plataforma que intermedia, revisa la evidencia y, si no se ponen
          de acuerdo, decide.</TS>
        </li>
        <li>
          <strong><TS>Reporta rápido y con pruebas.</TS></strong> <TS>Daños, faltantes o algo distinto, dentro de las</TS> {HORAS_REPORTE} <TS>horas siguientes a la
          entrega, con fotos o video. Te recomendamos grabar el desempaque.</TS>
        </li>
        <li>
          <strong><TS>Reporta antes de liberar el pago.</TS></strong> <TS>Al tocar «Todo bien, liberar pago» confirmas que llegó completo y en buen estado:
          después sólo queda la garantía.</TS>
        </li>
      </ul>

      <h2><TS>Motivos y qué procede</TS></h2>

      <h3><TS>Llegó dañado o roto</TS></h3>
      <p>
        <TS>Procede cambio o reembolso total. El envío de regreso lo paga el vendedor. Repórtalo en</TS> {HORAS_REPORTE} <TS>horas con fotos del producto,
        de la caja y de la guía, y conserva el empaque: si el daño fue de la paquetería, el vendedor hace el reclamo con ella.</TS>
      </p>

      <h3><TS>Llegó incompleto o faltan piezas</TS></h3>
      <p>
        <TS>El vendedor envía lo que falta o reembolsa la parte faltante. Repórtalo en</TS> {HORAS_REPORTE} <TS>horas con fotos de lo que sí llegó.</TS>
      </p>

      <h3><TS>Es distinto a lo publicado</TS></h3>
      <p>
        <TS>Otro modelo, medida, material, color o cantidad que no corresponde a la ficha o a la cotización aceptada: cambio o reembolso total,
        con el envío de regreso a cargo del vendedor.</TS>
      </p>

      <h3><TS>No llegó</TS></h3>
      <p>
        <TS>Si pasa la fecha máxima de entrega y la guía no muestra la entrega, el vendedor reenvía o se te reembolsa el total. Si la guía
        dice «entregado» y no lo recibiste, avísanos en</TS> {HORAS_REPORTE} <TS>horas: se revisa con la paquetería y la evidencia de entrega.</TS>
      </p>

      <h3><TS>Defecto de funcionamiento (herramientas, máquinas, refacciones)</TS></h3>
      <p>
        <TS>Lo cubre la garantía que da el vendedor en la ficha del producto: reparación, cambio o reembolso según esa garantía y la ley.</TS>
      </p>

      <h3><TS>Cambio de opinión o compra equivocada</TS></h3>
      <ul>
        <li>
          <TS>Productos físicos nuevos: tienes</TS> <strong>{EMPRESA.diasDevolucion} <TS>días naturales</TS></strong> <TS>desde que lo recibes. Debe estar sin uso,
          completo, con etiquetas y en su empaque original.</TS>
        </li>
        <li><TS>El envío de regreso lo pagas tú. Al recibirlo y revisarlo, el vendedor te reembolsa el precio del producto.</TS></li>
        <li>
          <TS>No aplica a: piezas o trabajos hechos a la medida, productos personalizados o grabados con tus datos, diseños digitales ya
          descargados, consumibles abiertos o usados (fresas, brocas, filamento, resinas, insumos) y productos de importación.</TS>
        </li>
      </ul>

      <h3><TS>Cobro duplicado o error en el pago</TS></h3>
      <p><TS>Si se te cobró dos veces el mismo pedido, se reembolsa completo el cobro de más, por el mismo medio de pago.</TS></p>

      <h3><TS>Dirección equivocada o pedido no recogido</TS></h3>
      <p>
        <TS>Si el paquete regresa porque la dirección estaba mal o no se recogió, puedes pedir que se reenvíe (pagas el nuevo envío) o que se
        te reembolse el producto menos los envíos ya hechos.</TS>
      </p>

      <h3><TS>Lo que no se puede devolver</TS></h3>
      <ul>
        <li><TS>Daños por mal uso, instalación incorrecta, golpes o modificaciones hechas después de recibirlo.</TS></li>
        <li><TS>Desgaste normal (filos de fresas y brocas, consumibles).</TS></li>
        <li><TS>Reportes fuera de plazo o sin evidencia, salvo lo que la ley te garantice.</TS></li>
      </ul>

      <h2><TS>Productos de importación</TS></h2>
      <p>
        <TS>Son los que un proveedor envía desde otro país, puerta a puerta y con los impuestos ya pagados. En la ficha dicen «Producto de
        importación», desde qué país se envían y en cuántos días llegan.</TS>
      </p>
      <ul>
        <li>
          <TS>Si</TS> <strong><TS>no llega, llega dañado, incompleto o es distinto</TS></strong> <TS>a lo publicado, se te devuelve tu dinero completo y el
          proveedor paga el regreso. Repórtalo dentro de los</TS> {EMPRESA.diasDevolucion} <TS>días naturales siguientes a la entrega, con fotos.</TS>
        </li>
        <li>
          <TS>No se aceptan devoluciones por cambio de opinión, salvo en los casos que la ley lo exija. En ese caso el producto se regresa al
          país de origen y el envío internacional de regreso corre por tu cuenta.</TS>
        </li>
        <li><TS>El proveedor no recibe tu dinero hasta que el pedido se entrega bien.</TS></li>
      </ul>

      <h2><TS>Trabajos fabricados a la medida</TS></h2>
      <ul>
        <li><TS>No tienen devolución por cambio de opinión: se fabricaron con tus archivos y especificaciones.</TS></li>
        <li>
          <TS>Si la pieza no cumple con lo acordado en la propuesta aceptada (medidas, tolerancia, material, cantidad o acabado), el taller la
          corrige o la vuelve a fabricar sin costo; si no puede, se reembolsa lo que corresponda.</TS>
        </li>
        <li>
          <TS>Si la pieza sale igual al archivo que mandaste, no es defecto del taller: tú eres responsable de que tus archivos y medidas sean
          correctos (el taller debe avisarte antes de fabricar si ve un error evidente).</TS>
        </li>
        <li>
          <TS>Cancelación: antes de que el taller reporte avance, recuperas el 100 %. Después, se reembolsa según el avance y los materiales ya
          comprados. Los detalles están en</TS>{" "}
          <LocalizedClientLink href="/reclamaciones"><TS>Reclamaciones y mediación</TS></LocalizedClientLink>.
        </li>
      </ul>

      <h2><TS>Diseños digitales</TS></h2>
      <p>
        <TS>Los archivos digitales (DXF, SVG, STL y otros) no tienen devolución una vez descargados. Si el archivo está dañado, no abre o no
        corresponde a la descripción, el vendedor lo corrige o se te reembolsa.</TS>
      </p>

      <h2><TS>Cómo se reembolsa</TS></h2>
      <ul>
        <li><TS>Por el mismo medio con el que pagaste. Puede ser total, parcial (sólo lo que falló) o un reenvío o reposición.</TS></li>
        <li>
          {`Se realiza en un máximo de ${EMPRESA.diasReembolso} días naturales`} <TS>después de que el vendedor recibe y revisa el producto (o de
          que se resuelve el caso, si no hay que regresar nada). Tu banco puede tardar unos días más en reflejarlo.</TS>
        </li>
        <li>
          <TS>Cuando el problema es del vendedor (dañado, incompleto, distinto, no llegó), el reembolso sale del pago que HETNA tiene retenido y
          el vendedor cubre los envíos.</TS>
        </li>
        <li>
          <TS>Si reportas cuando el pago ya se le liberó al vendedor (hasta el día</TS> {EMPRESA.diasDevolucion} <TS>después de la entrega) y el reclamo
          procede, igual se te reembolsa: HETNA se lo descuenta al vendedor de sus siguientes ventas.</TS>
        </li>
      </ul>

      <h2><TS>Cómo solicitarla</TS></h2>
      <ol>
        <li>
          <TS>Entra a</TS> <LocalizedClientLink href="/user/orders"><TS>Mis compras</TS></LocalizedClientLink><TS>, abre el pedido y toca «Tengo un problema».
          Elige el motivo, explica qué pasó y sube fotos o video (obligatorio, salvo si no te llegó).</TS>
        </li>
        <li>
          <TS>Congelamos el pago y avisamos al vendedor o taller, que tiene</TS> {DIAS_RESPUESTA} <TS>días hábiles para responder con su versión y su
          evidencia. Si no responde a tiempo, el caso se resuelve a tu favor.</TS>
        </li>
        <li>
          <TS>HETNA revisa la evidencia de los dos y decide: liberar el pago al vendedor, reembolso parcial o reembolso total. Te avisamos por
          correo y lo ves en tu compra.</TS>
        </li>
      </ol>
      <p><TS>Si no puedes entrar a tu cuenta, escríbenos por</TS> {medioContacto()} <TS>con tu número de pedido.</TS></p>
      <p><TS>Atendemos en horario:</TS> {EMPRESA.horario}.</p>

      <h2><TS>Garantía</TS></h2>
      <p>
        <TS>La garantía de cada producto o trabajo la da el vendedor o taller que aparece en la ficha o en la propuesta aceptada. HETNA hace
        cumplir lo que esa garantía dice cuando la compra se pagó dentro de la plataforma.</TS>
      </p>

      <h2><TS>Compras fuera de HETNA y uso indebido</TS></h2>
      <ul>
        <li>
          <TS>Si pagaste directo al vendedor o taller fuera de la plataforma, HETNA no tiene tu dinero: el trato y el reembolso son entre ustedes.
          Sí recibimos el reporte y podemos suspender al vendedor.</TS>
        </li>
        <li>
          <TS>HETNA puede negar solicitudes con evidencia falsa o alterada, y limitar las cuentas con devoluciones repetidas sin motivo.</TS>
        </li>
      </ul>

      <p className="text-sm text-[#6B675C]">
        <TS>Esta política no limita los derechos que te da la Ley Federal de Protección al Consumidor ni tu derecho de acudir a la PROFECO; si
        hubiera diferencia, prevalece lo más favorable para ti como consumidor. Consulta también los</TS>{" "}
        <LocalizedClientLink href="/terminos-y-condiciones"><TS>Términos y condiciones</TS></LocalizedClientLink> y{" "}
        <LocalizedClientLink href="/reclamaciones"><TS>Reclamaciones y mediación</TS></LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
