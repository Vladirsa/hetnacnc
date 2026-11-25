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

export const metadata: Metadata = {
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
      <h2>En resumen</h2>
      <ul>
        <li>
          <strong>Tu pago está protegido.</strong> Cuando compras dentro de HETNA, el vendedor o taller no recibe tu dinero hasta que
          tocas «Todo bien, liberar pago» en tu compra. Si no haces nada, se libera solo {EMPRESA.diasLiberacion} días después de la entrega.
        </li>
        <li>
          <strong>Quien resuelve es el vendedor o taller.</strong> Cada producto lo vende y lo envía un vendedor o taller registrado: es
          quien hace la devolución, el cambio o el reembolso. HETNA es la plataforma que intermedia, revisa la evidencia y, si no se ponen
          de acuerdo, decide.
        </li>
        <li>
          <strong>Reporta rápido y con pruebas.</strong> Daños, faltantes o algo distinto, dentro de las {HORAS_REPORTE} horas siguientes a la
          entrega, con fotos o video. Te recomendamos grabar el desempaque.
        </li>
        <li>
          <strong>Reporta antes de liberar el pago.</strong> Al tocar «Todo bien, liberar pago» confirmas que llegó completo y en buen estado:
          después sólo queda la garantía.
        </li>
      </ul>

      <h2>Motivos y qué procede</h2>

      <h3>Llegó dañado o roto</h3>
      <p>
        Procede cambio o reembolso total. El envío de regreso lo paga el vendedor. Repórtalo en {HORAS_REPORTE} horas con fotos del producto,
        de la caja y de la guía, y conserva el empaque: si el daño fue de la paquetería, el vendedor hace el reclamo con ella.
      </p>

      <h3>Llegó incompleto o faltan piezas</h3>
      <p>
        El vendedor envía lo que falta o reembolsa la parte faltante. Repórtalo en {HORAS_REPORTE} horas con fotos de lo que sí llegó.
      </p>

      <h3>Es distinto a lo publicado</h3>
      <p>
        Otro modelo, medida, material, color o cantidad que no corresponde a la ficha o a la cotización aceptada: cambio o reembolso total,
        con el envío de regreso a cargo del vendedor.
      </p>

      <h3>No llegó</h3>
      <p>
        Si pasa la fecha máxima de entrega y la guía no muestra la entrega, el vendedor reenvía o se te reembolsa el total. Si la guía
        dice «entregado» y no lo recibiste, avísanos en {HORAS_REPORTE} horas: se revisa con la paquetería y la evidencia de entrega.
      </p>

      <h3>Defecto de funcionamiento (herramientas, máquinas, refacciones)</h3>
      <p>
        Lo cubre la garantía que da el vendedor en la ficha del producto: reparación, cambio o reembolso según esa garantía y la ley.
      </p>

      <h3>Cambio de opinión o compra equivocada</h3>
      <ul>
        <li>
          Productos físicos nuevos: tienes <strong>{EMPRESA.diasDevolucion} días naturales</strong> desde que lo recibes. Debe estar sin uso,
          completo, con etiquetas y en su empaque original.
        </li>
        <li>El envío de regreso lo pagas tú. Al recibirlo y revisarlo, el vendedor te reembolsa el precio del producto.</li>
        <li>
          No aplica a: piezas o trabajos hechos a la medida, productos personalizados o grabados con tus datos, diseños digitales ya
          descargados, consumibles abiertos o usados (fresas, brocas, filamento, resinas, insumos) y productos de importación.
        </li>
      </ul>

      <h3>Cobro duplicado o error en el pago</h3>
      <p>Si se te cobró dos veces el mismo pedido, se reembolsa completo el cobro de más, por el mismo medio de pago.</p>

      <h3>Dirección equivocada o pedido no recogido</h3>
      <p>
        Si el paquete regresa porque la dirección estaba mal o no se recogió, puedes pedir que se reenvíe (pagas el nuevo envío) o que se
        te reembolse el producto menos los envíos ya hechos.
      </p>

      <h3>Lo que no se puede devolver</h3>
      <ul>
        <li>Daños por mal uso, instalación incorrecta, golpes o modificaciones hechas después de recibirlo.</li>
        <li>Desgaste normal (filos de fresas y brocas, consumibles).</li>
        <li>Reportes fuera de plazo o sin evidencia, salvo lo que la ley te garantice.</li>
      </ul>

      <h2>Productos de importación</h2>
      <p>
        Son los que un proveedor envía desde otro país, puerta a puerta y con los impuestos ya pagados. En la ficha dicen «Producto de
        importación», desde qué país se envían y en cuántos días llegan.
      </p>
      <ul>
        <li>
          Si <strong>no llega, llega dañado, incompleto o es distinto</strong> a lo publicado, se te devuelve tu dinero completo y el
          proveedor paga el regreso. Repórtalo dentro de los {EMPRESA.diasDevolucion} días naturales siguientes a la entrega, con fotos.
        </li>
        <li>
          No se aceptan devoluciones por cambio de opinión, salvo en los casos que la ley lo exija. En ese caso el producto se regresa al
          país de origen y el envío internacional de regreso corre por tu cuenta.
        </li>
        <li>El proveedor no recibe tu dinero hasta que el pedido se entrega bien.</li>
      </ul>

      <h2>Trabajos fabricados a la medida</h2>
      <ul>
        <li>No tienen devolución por cambio de opinión: se fabricaron con tus archivos y especificaciones.</li>
        <li>
          Si la pieza no cumple con lo acordado en la propuesta aceptada (medidas, tolerancia, material, cantidad o acabado), el taller la
          corrige o la vuelve a fabricar sin costo; si no puede, se reembolsa lo que corresponda.
        </li>
        <li>
          Si la pieza sale igual al archivo que mandaste, no es defecto del taller: tú eres responsable de que tus archivos y medidas sean
          correctos (el taller debe avisarte antes de fabricar si ve un error evidente).
        </li>
        <li>
          Cancelación: antes de que el taller reporte avance, recuperas el 100 %. Después, se reembolsa según el avance y los materiales ya
          comprados. Los detalles están en{" "}
          <LocalizedClientLink href="/reclamaciones">Reclamaciones y mediación</LocalizedClientLink>.
        </li>
      </ul>

      <h2>Diseños digitales</h2>
      <p>
        Los archivos digitales (DXF, SVG, STL y otros) no tienen devolución una vez descargados. Si el archivo está dañado, no abre o no
        corresponde a la descripción, el vendedor lo corrige o se te reembolsa.
      </p>

      <h2>Cómo se reembolsa</h2>
      <ul>
        <li>Por el mismo medio con el que pagaste. Puede ser total, parcial (sólo lo que falló) o un reenvío o reposición.</li>
        <li>
          {`Se realiza en un máximo de ${EMPRESA.diasReembolso} días naturales`} después de que el vendedor recibe y revisa el producto (o de
          que se resuelve el caso, si no hay que regresar nada). Tu banco puede tardar unos días más en reflejarlo.
        </li>
        <li>
          Cuando el problema es del vendedor (dañado, incompleto, distinto, no llegó), el reembolso sale del pago que HETNA tiene retenido y
          el vendedor cubre los envíos.
        </li>
        <li>
          Si reportas cuando el pago ya se le liberó al vendedor (hasta el día {EMPRESA.diasDevolucion} después de la entrega) y el reclamo
          procede, igual se te reembolsa: HETNA se lo descuenta al vendedor de sus siguientes ventas.
        </li>
      </ul>

      <h2>Cómo solicitarla</h2>
      <ol>
        <li>
          Entra a <LocalizedClientLink href="/user/orders">Mis compras</LocalizedClientLink>, abre el pedido y toca «Tengo un problema».
          Elige el motivo, explica qué pasó y sube fotos o video (obligatorio, salvo si no te llegó).
        </li>
        <li>
          Congelamos el pago y avisamos al vendedor o taller, que tiene {DIAS_RESPUESTA} días hábiles para responder con su versión y su
          evidencia. Si no responde a tiempo, el caso se resuelve a tu favor.
        </li>
        <li>
          HETNA revisa la evidencia de los dos y decide: liberar el pago al vendedor, reembolso parcial o reembolso total. Te avisamos por
          correo y lo ves en tu compra.
        </li>
      </ol>
      <p>Si no puedes entrar a tu cuenta, escríbenos por {medioContacto()} con tu número de pedido.</p>
      <p>Atendemos en horario: {EMPRESA.horario}.</p>

      <h2>Garantía</h2>
      <p>
        La garantía de cada producto o trabajo la da el vendedor o taller que aparece en la ficha o en la propuesta aceptada. HETNA hace
        cumplir lo que esa garantía dice cuando la compra se pagó dentro de la plataforma.
      </p>

      <h2>Compras fuera de HETNA y uso indebido</h2>
      <ul>
        <li>
          Si pagaste directo al vendedor o taller fuera de la plataforma, HETNA no tiene tu dinero: el trato y el reembolso son entre ustedes.
          Sí recibimos el reporte y podemos suspender al vendedor.
        </li>
        <li>
          HETNA puede negar solicitudes con evidencia falsa o alterada, y limitar las cuentas con devoluciones repetidas sin motivo.
        </li>
      </ul>

      <p className="text-sm text-[#6B675C]">
        Esta política no limita los derechos que te da la Ley Federal de Protección al Consumidor ni tu derecho de acudir a la PROFECO; si
        hubiera diferencia, prevalece lo más favorable para ti como consumidor. Consulta también los{" "}
        <LocalizedClientLink href="/terminos-y-condiciones">Términos y condiciones</LocalizedClientLink> y{" "}
        <LocalizedClientLink href="/reclamaciones">Reclamaciones y mediación</LocalizedClientLink>.
      </p>
    </PaginaInfo>
  )
}
