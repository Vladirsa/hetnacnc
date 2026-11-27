import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, medioContacto } from "@/lib/hetna/empresa"
import { DIAS_CIERRE_AUTOMATICO, DIAS_HABILES_DECISION_DISPUTA, DIAS_RETRASO_CANCELACION } from "@/lib/hetna/promesas"

// Reclamaciones, disputas y mediación (auditoría legal del 20 nov 2026, punto
// D). Junta en un solo lugar las reglas que ya estaban repartidas en los
// Términos (cláusulas 4 y 6) y en Devoluciones; los plazos salen de
// lib/hetna/promesas.ts, igual que en los Términos, para que nunca digan otra
// cosa. Pendiente de revisión jurídica y fiscal antes de operar fuera de México.

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/reclamaciones" },
  title: "Reclamaciones y mediación",
  description:
    "Cómo reclamar en HETNA CNC: piezas con defectos, retrasos, cancelaciones, reembolsos parciales, archivos defectuosos, garantías y cómo media HETNA entre cliente y taller.",
}

export default function Reclamaciones() {
  return (
    <PaginaInfo
      etiqueta="Ayuda"
      titulo="Reclamaciones y mediación"
      resumen="Qué hacer si algo sale mal con una compra o un trabajo de fabricación, y cómo decide HETNA."
      actualizado="25 de noviembre de 2026"
    >
      <h2><TS>1. Qué cubre esta política</TS></h2>
      <ul>
        <li><TS>Compras de la tienda (productos físicos, diseños digitales, cursos y servicios con precio) y trabajos de fabricación pagados dentro de HETNA.</TS></li>
        <li>
          <TS>Los trabajos de solicitudes de fabricación que cliente y taller acuerdan pagar o entregar</TS> <strong><TS>fuera</TS></strong> <TS>de la plataforma no tienen esta
          protección: el trato es directo entre ellos. HETNA sí recibe reportes de fraude o mala conducta, que pueden causar la suspensión de la cuenta y quedar
          en la reputación del taller.</TS>
        </li>
      </ul>

      <h2><TS>2. Cómo presentar una reclamación</TS></h2>
      <ol>
        <li>
          <strong><TS>Antes de confirmar que recibiste.</TS></strong> <TS>En un trabajo de fabricación, repórtalo desde la liga de tu solicitud antes de marcarlo como
          recibido; mientras haya un problema abierto, HETNA no libera el pago retenido al taller.</TS>
        </li>
        <li>
          <strong><TS>Con evidencia.</TS></strong> <TS>Fotos o video de la pieza, medidas, guía de envío, mensajes y, si existe, el acuerdo SafeDeal. Mientras más clara la
          evidencia, más rápida la decisión.</TS>
        </li>
        <li>
          <strong><TS>En compras de la tienda</TS></strong><TS>, desde</TS> <LocalizedClientLink href="/user/orders"><TS>Mis compras</TS></LocalizedClientLink><TS>: abre el pedido y toca
          «Tengo un problema», elige el motivo, explícalo y sube fotos o video. Puedes hacerlo hasta</TS> <TS>{EMPRESA.diasDevolucion}</TS> <TS>días naturales después de la
          entrega (después, sólo garantía). Si no puedes entrar a tu cuenta, escríbenos por</TS> {medioContacto()}<TS>. Los plazos de devolución están en la</TS><TS>{" "}</TS>
          <LocalizedClientLink href="/devoluciones"><TS>Política de devoluciones</TS></LocalizedClientLink>.
        </li>
      </ol>

      <h2><TS>3. Cómo media HETNA</TS></h2>
      <ol>
        <li><TS>Recibimos la reclamación y avisamos a la otra parte.</TS></li>
        <li>
          <TS>Pedimos evidencia a las dos partes y les damos oportunidad de responder. En compras de la tienda, el vendedor tiene 3 días hábiles para responder
          desde su panel; si no responde, el caso se resuelve a favor del cliente.</TS>
        </li>
        <li><TS>Proponemos un arreglo: corregir o volver a fabricar, reembolso parcial o reembolso total.</TS></li>
        <li>
          <TS>Si no hay acuerdo, HETNA decide en un objetivo de</TS> {DIAS_HABILES_DECISION_DISPUTA} <TS>días hábiles (un caso complejo puede tardar más y se avisa). La
          decisión queda registrada en el pedido y en el historial de reclamos del taller.</TS>
        </li>
      </ol>
      <p>
        <TS>Este procedimiento no limita tu derecho de acudir a la PROFECO o a los tribunales. Atendemos en horario:</TS> <TS>{EMPRESA.horario}</TS>.
      </p>

      <h2><TS>4. Casos más comunes</TS></h2>
      <h3><TS>Pieza con defectos o distinta a lo acordado</TS></h3>
      <p>
        <TS>Se compara la pieza contra la propuesta aceptada (medidas, tolerancia, material, cantidad, acabado). Si no cumple por causa del taller, el taller la
        corrige o la vuelve a fabricar sin costo; si no puede, se reembolsa lo que corresponda.</TS>
      </p>
      <h3><TS>Retraso en la entrega</TS></h3>
      <p>
        <TS>Si pasan</TS> {DIAS_RETRASO_CANCELACION} <TS>días de la fecha de entrega prometida en la propuesta sin que el pedido se entregue, el cliente puede cancelar con
        reembolso. Los retrasos cuentan en la puntualidad del taller.</TS>
      </p>
      <h3><TS>Cancelación del proyecto</TS></h3>
      <p>
        <TS>Si el cliente cancela antes de que el taller reporte avance de fabricación, recupera el 100 % de lo que pagó. Después, aplica su acuerdo SafeDeal o,
        si no lo hay, HETNA decide según el avance y los materiales ya comprados (reembolso parcial).</TS>
      </p>
      <h3><TS>Reembolso parcial</TS></h3>
      <p>
        <TS>Procede cuando sólo una parte del pedido falla (algunas piezas de un lote, un acabado) o cuando el trabajo se canceló con avance. Se calcula sobre lo
        que no se entregó conforme a lo acordado.</TS>
      </p>
      <h3><TS>Archivo defectuoso</TS></h3>
      <ul>
        <li>
          <strong><TS>Archivo del cliente</TS></strong> <TS>(en un trabajo de fabricación): el cliente es responsable de que sus archivos y medidas sean correctos. Si la pieza
          sale igual al archivo que mandó, no es defecto del taller. El taller debe avisar antes de fabricar si ve un error evidente.</TS>
        </li>
        <li>
          <strong><TS>Archivo comprado en la tienda</TS></strong> <TS>(diseño digital): si está dañado, no abre o no corresponde a la descripción, el vendedor lo corrige o
          se reembolsa. Una vez descargado no hay devolución por cambio de opinión.</TS>
        </li>
      </ul>
      <h3><TS>Garantía de fabricación</TS></h3>
      <p>
        <TS>Cada propuesta de un taller indica obligatoriamente su garantía. HETNA hace cumplir la garantía escrita en la propuesta aceptada; en la tienda, la
        garantía la otorga el vendedor que aparece en la ficha del producto.</TS>
      </p>

      <h2><TS>5. Cuándo se libera el pago al taller</TS></h2>
      <h3><TS>Compras de la tienda</TS></h3>
      <ul>
        <li><TS>Cuando el cliente toca «Todo bien, liberar pago» en su compra: confirma que llegó completo y en buen estado.</TS></li>
        <li><TS>Si el cliente no hace nada,</TS> <TS>{EMPRESA.diasLiberacion}</TS> <TS>días después de la entrega.</TS></li>
        <li>
          <TS>Si el cliente reporta un problema, el pago se congela hasta que HETNA decide. Si el reclamo llega cuando el pago ya se liberó (hasta el día</TS><TS>{" "}</TS>
          <TS>{EMPRESA.diasDevolucion}</TS><TS>) y procede, el reembolso y la guía de regreso a cargo del vendedor se descuentan de sus siguientes ventas.</TS>
        </li>
        <li><TS>La guía de regreso la paga el vendedor si la culpa fue suya, y el cliente si se arrepintió de la compra.</TS></li>
      </ul>
      <h3><TS>Trabajos de fabricación</TS></h3>
      <ul>
        <li><TS>Cuando el cliente confirma que recibió.</TS></li>
        <li>
          <TS>Si el cliente no confirma ni reporta un problema,</TS> {DIAS_CIERRE_AUTOMATICO} <TS>días después de que el taller marca el pedido como entregado.</TS>
        </li>
        <li><TS>Con una reclamación abierta no se libera nada hasta que HETNA decide.</TS></li>
        <li>
          <TS>Si el cliente pagó directo a la cuenta del taller, HETNA no retiene ese dinero: el reembolso que corresponda lo hace el taller, y HETNA puede
          suspender la cuenta del taller que no lo haga.</TS>
        </li>
      </ul>

      <p className="text-sm text-[#6B675C]">
        <TS>Esta política complementa los</TS> <LocalizedClientLink href="/terminos-y-condiciones"><TS>Términos y condiciones</TS></LocalizedClientLink> <TS>(cláusulas 4 y 6) y la</TS><TS>{" "}</TS>
        <LocalizedClientLink href="/devoluciones"><TS>Política de devoluciones</TS></LocalizedClientLink><TS>; si hubiera diferencia, prevalece lo más favorable para el
        cliente consumidor.</TS>
      </p>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
