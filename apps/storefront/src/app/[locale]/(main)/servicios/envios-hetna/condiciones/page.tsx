import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { medioContacto } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  title: "Condiciones de Envíos HETNA",
  description: "Condiciones del servicio Envíos HETNA: medidas y peso, sobrepeso, evidencia fotográfica, protección del envío, artículos prohibidos y reclamos.",
}

// Condiciones del servicio de envíos. Lo que el cliente acepta al marcar las
// casillas del formulario de solicitud. La protección sigue la política
// "SOS Protección" de Skydropx (actualización del 25 de junio de 2025).

const H2 = "mt-10 text-xl font-extrabold text-[#142033]"
const P = "mt-3 leading-relaxed text-[#40403A]"
const LI = "leading-relaxed text-[#40403A]"

export default function CondicionesEnvios() {
  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-10 lg:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]">Envíos HETNA</p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#142033]">Condiciones del servicio</h1>
      <p className={P}>
        Envíos HETNA cotiza, cobra y genera guías de paquetería a través de Skydropx. Al solicitar un envío aceptas estas condiciones.
      </p>

      <h2 className={H2}>1. Medidas y peso</h2>
      <p className={P}>
        La cotización se hace con las medidas y el peso que tú declaras. Deben ser los del paquete <strong>ya embalado</strong>: con la caja,
        el relleno, la cinta y, si va en tarima, con la tarima. Las paqueterías cobran por el mayor entre el peso real y el peso volumétrico
        (largo × ancho × alto en cm entre 5,000).
      </p>

      <h2 className={H2}>2. Sobrepeso y cobros extra</h2>
      <p className={P}>
        La paquetería vuelve a pesar y medir cada paquete. Si encuentra más peso o medidas que las cotizadas, cobra la diferencia
        (sobrepeso). <strong>Ese cobro lo paga quien envía.</strong> Te avisaremos con el reporte de la paquetería y una liga de pago; mientras
        esté pendiente no podremos generar nuevas guías a tu nombre.
      </p>

      <h2 className={H2}>3. Evidencia fotográfica</h2>
      <p className={P}>Antes de entregar el paquete a la paquetería, con la guía ya pegada, toma y sube en Mis envíos estas 4 fotos:</p>
      <ol className="mt-3 grid gap-1 pl-5">
        <li className={LI}>Alto, con la cinta métrica de la base a la parte más alta.</li>
        <li className={LI}>Largo, con la cinta métrica de extremo a extremo.</li>
        <li className={LI}>Ancho, con la cinta métrica de extremo a extremo.</li>
        <li className={LI}>El paquete en la báscula, que se lea el peso.</li>
      </ol>
      <p className={P}>
        En todas debe verse la guía, con buena luz y enfocadas. Es la única prueba con la que se puede disputar un sobrepeso o reclamar la
        protección: <strong>sin evidencia subida antes de la entrega no podemos pelear el cobro</strong> y el sobrepeso se cobra completo.
      </p>

      <h2 className={H2}>4. Protección del envío</h2>
      <p className={P}>
        Es opcional y se contrata al solicitar el envío. <strong>No es un seguro</strong>: es la SOS Protección de Skydropx, un mecanismo de
        compensación que cubre daño, faltante, extravío o robo durante el traslado hasta el valor declarado (máximo $100,000 MXN), según sus
        condiciones. Cuesta 1.5% del valor declarado.
      </p>
      <ul className="mt-3 grid list-disc gap-1 pl-5">
        <li className={LI}>Declara el valor real, sin IVA, que puedas comprobar con factura. El reembolso es por lo menor entre lo declarado y la factura.</li>
        <li className={LI}>
          <strong>No cubre:</strong> artículos usados, seminuevos o de segunda mano; celulares, tablets, laptops y computadoras; mobiliario médico
          y equipo científico; artículos prohibidos por la paquetería; artículos sin legal estancia en México; documentos; paquetes con
          embalaje insuficiente (caja débil, sin relleno, mal sellada o con etiquetas confusas).
        </li>
        <li className={LI}>Por eso, al solicitar, te preguntamos si lo que envías es nuevo o usado: si es usado, la protección no está disponible.</li>
        <li className={LI}>Debe quedar contratada antes de la recolección o de la entrega en sucursal; después ya no se puede agregar.</li>
      </ul>

      <h2 className={H2}>5. Si el paquete llega dañado, incompleto o no llega</h2>
      <ul className="mt-3 grid list-disc gap-1 pl-5">
        <li className={LI}>Si el empaque viene abierto o alterado, rechaza la entrega con la paquetería y que quede constancia.</li>
        <li className={LI}>Toma fotos y video del paquete con la guía visible, del embalaje y del contenido.</li>
        <li className={LI}>
          Escríbenos con tu folio (ENV-…) y la factura del producto dentro de las <strong>48 horas hábiles</strong> después de recibirlo. Si se
          aceptó la entrega, sólo vale la factura timbrada por el SAT.
        </li>
        <li className={LI}>Si no llega: cuando el rastreo diga extraviado o pasen 15 días hábiles sin movimiento.</li>
        <li className={LI}>
          Nosotros hacemos el reclamo con Skydropx. Si procede, puede pedir que el contenido se mande a revisión a Monterrey. El reembolso
          depende de su resolución (daño leve 25%, moderado o funcional 50%, irreparable o extravío 100% de lo comprobado, sin IVA ni costo de
          guía) y te lo regresamos en cuanto lo acreditan.
        </li>
      </ul>

      <h2 className={H2}>6. Artículos prohibidos</h2>
      <p className={P}>
        No se envían materiales peligrosos (inflamables, químicos, gases, baterías sueltas), armas, dinero, ni nada que prohíba la paquetería.
        Si la paquetería detecta un artículo prohibido, los cargos, devoluciones o multas son de quien envía.
      </p>

      <h2 className={H2}>7. Pago y guía</h2>
      <p className={P}>
        Pagas en línea con Mercado Pago. Con el pago confirmado generamos la guía y te la mandamos por correo. La cotización es válida por 12
        horas.
      </p>

      <h2 className={H2}>8. Contacto</h2>
      <p className={P}>Para dudas, sobrepesos o reclamos escríbenos por {medioContacto()}, siempre con tu folio.</p>

      <div className="mt-10 flex flex-wrap gap-3">
        <LocalizedClientLink href="/servicios/envios-hetna#cotizar-envio" className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white">
          Cotizar envío
        </LocalizedClientLink>
        <LocalizedClientLink href="/user/envios" className="rounded-xl border border-[#E7E4DC] px-5 py-3 font-semibold text-[#142033]">
          Mis envíos
        </LocalizedClientLink>
      </div>
    </main>
  )
}
