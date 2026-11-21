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

export const metadata: Metadata = {
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
      actualizado="21 de noviembre de 2026"
    >
      <h2>1. Qué cubre esta política</h2>
      <ul>
        <li>Compras de la tienda (productos físicos, diseños digitales, cursos y servicios con precio) y trabajos de fabricación pagados dentro de HETNA.</li>
        <li>
          Los trabajos de solicitudes de fabricación que cliente y taller acuerdan pagar o entregar <strong>fuera</strong> de la plataforma no tienen esta
          protección: el trato es directo entre ellos. HETNA sí recibe reportes de fraude o mala conducta, que pueden causar la suspensión de la cuenta y quedar
          en la reputación del taller.
        </li>
      </ul>

      <h2>2. Cómo presentar una reclamación</h2>
      <ol>
        <li>
          <strong>Antes de confirmar que recibiste.</strong> En un trabajo de fabricación, repórtalo desde la liga de tu solicitud antes de marcarlo como
          recibido; mientras haya un problema abierto, HETNA no libera el pago retenido al taller.
        </li>
        <li>
          <strong>Con evidencia.</strong> Fotos o video de la pieza, medidas, guía de envío, mensajes y, si existe, el acuerdo SafeDeal. Mientras más clara la
          evidencia, más rápida la decisión.
        </li>
        <li>
          <strong>En compras de la tienda</strong>, escríbenos por {medioContacto()} con tu número de pedido, fotos y el motivo. Los plazos de devolución están
          en la <LocalizedClientLink href="/devoluciones">Política de devoluciones</LocalizedClientLink>.
        </li>
      </ol>

      <h2>3. Cómo media HETNA</h2>
      <ol>
        <li>Recibimos la reclamación y avisamos a la otra parte.</li>
        <li>Pedimos evidencia a las dos partes y les damos oportunidad de responder.</li>
        <li>Proponemos un arreglo: corregir o volver a fabricar, reembolso parcial o reembolso total.</li>
        <li>
          Si no hay acuerdo, HETNA decide en un objetivo de {DIAS_HABILES_DECISION_DISPUTA} días hábiles (un caso complejo puede tardar más y se avisa). La
          decisión queda registrada en el pedido y en el historial de reclamos del taller.
        </li>
      </ol>
      <p>
        Este procedimiento no limita tu derecho de acudir a la PROFECO o a los tribunales. Atendemos en horario: {EMPRESA.horario}.
      </p>

      <h2>4. Casos más comunes</h2>
      <h3>Pieza con defectos o distinta a lo acordado</h3>
      <p>
        Se compara la pieza contra la propuesta aceptada (medidas, tolerancia, material, cantidad, acabado). Si no cumple por causa del taller, el taller la
        corrige o la vuelve a fabricar sin costo; si no puede, se reembolsa lo que corresponda.
      </p>
      <h3>Retraso en la entrega</h3>
      <p>
        Si pasan {DIAS_RETRASO_CANCELACION} días de la fecha de entrega prometida en la propuesta sin que el pedido se entregue, el cliente puede cancelar con
        reembolso. Los retrasos cuentan en la puntualidad del taller.
      </p>
      <h3>Cancelación del proyecto</h3>
      <p>
        Si el cliente cancela antes de que el taller reporte avance de fabricación, recupera el 100 % de lo que pagó. Después, aplica su acuerdo SafeDeal o,
        si no lo hay, HETNA decide según el avance y los materiales ya comprados (reembolso parcial).
      </p>
      <h3>Reembolso parcial</h3>
      <p>
        Procede cuando sólo una parte del pedido falla (algunas piezas de un lote, un acabado) o cuando el trabajo se canceló con avance. Se calcula sobre lo
        que no se entregó conforme a lo acordado.
      </p>
      <h3>Archivo defectuoso</h3>
      <ul>
        <li>
          <strong>Archivo del cliente</strong> (en un trabajo de fabricación): el cliente es responsable de que sus archivos y medidas sean correctos. Si la pieza
          sale igual al archivo que mandó, no es defecto del taller. El taller debe avisar antes de fabricar si ve un error evidente.
        </li>
        <li>
          <strong>Archivo comprado en la tienda</strong> (diseño digital): si está dañado, no abre o no corresponde a la descripción, el vendedor lo corrige o
          se reembolsa. Una vez descargado no hay devolución por cambio de opinión.
        </li>
      </ul>
      <h3>Garantía de fabricación</h3>
      <p>
        Cada propuesta de un taller indica obligatoriamente su garantía. HETNA hace cumplir la garantía escrita en la propuesta aceptada; en la tienda, la
        garantía la otorga el vendedor que aparece en la ficha del producto.
      </p>

      <h2>5. Cuándo se libera el pago al taller</h2>
      <ul>
        <li>Cuando el cliente confirma que recibió.</li>
        <li>
          Si el cliente no confirma ni reporta un problema, {DIAS_CIERRE_AUTOMATICO} días después de que el taller marca el pedido como entregado.
        </li>
        <li>Con una reclamación abierta no se libera nada hasta que HETNA decide.</li>
        <li>
          Si el cliente pagó directo a la cuenta del taller, HETNA no retiene ese dinero: el reembolso que corresponda lo hace el taller, y HETNA puede
          suspender la cuenta del taller que no lo haga.
        </li>
      </ul>

      <p className="text-sm text-[#6B675C]">
        Esta política complementa los <LocalizedClientLink href="/terminos-y-condiciones">Términos y condiciones</LocalizedClientLink> (cláusulas 4 y 6) y la{" "}
        <LocalizedClientLink href="/devoluciones">Política de devoluciones</LocalizedClientLink>; si hubiera diferencia, prevalece lo más favorable para el
        cliente consumidor.
      </p>
    </PaginaInfo>
  )
}
