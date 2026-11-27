import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { medioContacto } from "@/lib/hetna/empresa"

const metadataEs: Metadata = {
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
      <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]"><TS>Envíos HETNA</TS></p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#142033]"><TS>Condiciones del servicio</TS></h1>
      <p className={P}>
        <TS>Envíos HETNA cotiza, cobra y genera guías de paquetería a través de Skydropx. Al solicitar un envío aceptas estas condiciones.</TS>
      </p>

      <h2 className={H2}><TS>1. Medidas y peso</TS></h2>
      <p className={P}>
        <TS>La cotización se hace con las medidas y el peso que tú declaras. Deben ser los del paquete</TS> <strong><TS>ya embalado</TS></strong><TS>: con la caja,
        el relleno, la cinta y, si va en tarima, con la tarima. Las paqueterías cobran por el mayor entre el peso real y el peso volumétrico
        (largo × ancho × alto en cm entre 5,000).</TS>
      </p>

      <h2 className={H2}><TS>2. Sobrepeso y cobros extra</TS></h2>
      <p className={P}>
        <TS>La paquetería vuelve a pesar y medir cada paquete. Si encuentra más peso o medidas que las cotizadas, cobra la diferencia
        (sobrepeso).</TS> <strong><TS>Ese cobro lo paga quien envía.</TS></strong> <TS>Te avisaremos con el reporte de la paquetería y una liga de pago; mientras
        esté pendiente no podremos generar nuevas guías a tu nombre.</TS>
      </p>

      <h2 className={H2}><TS>3. Evidencia fotográfica</TS></h2>
      <p className={P}><TS>Antes de entregar el paquete a la paquetería, con la guía ya pegada, toma y sube en Mis envíos estas 4 fotos:</TS></p>
      <ol className="mt-3 grid gap-1 pl-5">
        <li className={LI}><TS>Alto, con la cinta métrica de la base a la parte más alta.</TS></li>
        <li className={LI}><TS>Largo, con la cinta métrica de extremo a extremo.</TS></li>
        <li className={LI}><TS>Ancho, con la cinta métrica de extremo a extremo.</TS></li>
        <li className={LI}><TS>El paquete en la báscula, que se lea el peso.</TS></li>
      </ol>
      <p className={P}>
        <TS>En todas debe verse la guía, con buena luz y enfocadas. Es la única prueba con la que se puede disputar un sobrepeso o reclamar la
        protección:</TS> <strong><TS>sin evidencia subida antes de la entrega no podemos pelear el cobro</TS></strong> <TS>y el sobrepeso se cobra completo.</TS>
      </p>

      <h2 className={H2}><TS>4. Protección del envío</TS></h2>
      <p className={P}>
        <TS>Es opcional y se contrata al solicitar el envío.</TS> <strong><TS>No es un seguro</TS></strong><TS>: es la SOS Protección de Skydropx, un mecanismo de
        compensación que cubre daño, faltante, extravío o robo durante el traslado hasta el valor declarado (máximo $100,000 MXN), según sus
        condiciones. Cuesta 1.5% del valor declarado.</TS>
      </p>
      <ul className="mt-3 grid list-disc gap-1 pl-5">
        <li className={LI}><TS>Declara el valor real, sin IVA, que puedas comprobar con factura. El reembolso es por lo menor entre lo declarado y la factura.</TS></li>
        <li className={LI}>
          <strong><TS>No cubre:</TS></strong> <TS>artículos usados, seminuevos o de segunda mano; celulares, tablets, laptops y computadoras; mobiliario médico
          y equipo científico; artículos prohibidos por la paquetería; artículos sin legal estancia en México; documentos; paquetes con
          embalaje insuficiente (caja débil, sin relleno, mal sellada o con etiquetas confusas).</TS>
        </li>
        <li className={LI}><TS>Por eso, al solicitar, te preguntamos si lo que envías es nuevo o usado: si es usado, la protección no está disponible.</TS></li>
        <li className={LI}><TS>Debe quedar contratada antes de la recolección o de la entrega en sucursal; después ya no se puede agregar.</TS></li>
      </ul>

      <h2 className={H2}><TS>5. Si el paquete llega dañado, incompleto o no llega</TS></h2>
      <ul className="mt-3 grid list-disc gap-1 pl-5">
        <li className={LI}><TS>Si el empaque viene abierto o alterado, rechaza la entrega con la paquetería y que quede constancia.</TS></li>
        <li className={LI}><TS>Toma fotos y video del paquete con la guía visible, del embalaje y del contenido.</TS></li>
        <li className={LI}>
          <TS>Escríbenos con tu folio (ENV-…) y la factura del producto dentro de las</TS> <strong><TS>48 horas hábiles</TS></strong> <TS>después de recibirlo. Si se
          aceptó la entrega, sólo vale la factura timbrada por el SAT.</TS>
        </li>
        <li className={LI}><TS>Si no llega: cuando el rastreo diga extraviado o pasen 15 días hábiles sin movimiento.</TS></li>
        <li className={LI}>
          <TS>Nosotros hacemos el reclamo con Skydropx. Si procede, puede pedir que el contenido se mande a revisión a Monterrey. El reembolso
          depende de su resolución (daño leve 25%, moderado o funcional 50%, irreparable o extravío 100% de lo comprobado, sin IVA ni costo de
          guía) y te lo regresamos en cuanto lo acreditan.</TS>
        </li>
      </ul>

      <h2 className={H2}><TS>6. Artículos prohibidos</TS></h2>
      <p className={P}>
        <TS>No se envían materiales peligrosos (inflamables, químicos, gases, baterías sueltas), armas, dinero, ni nada que prohíba la paquetería.
        Si la paquetería detecta un artículo prohibido, los cargos, devoluciones o multas son de quien envía.</TS>
      </p>

      <h2 className={H2}><TS>7. Pago y guía</TS></h2>
      <p className={P}>
        <TS>Pagas en línea con Mercado Pago. Con el pago confirmado generamos la guía y te la mandamos por correo. La cotización es válida por 12
        horas.</TS>
      </p>

      <h2 className={H2}><TS>8. Contacto</TS></h2>
      <p className={P}><TS>Para dudas, sobrepesos o reclamos escríbenos por</TS> {medioContacto()}<TS>, siempre con tu folio.</TS></p>

      <div className="mt-10 flex flex-wrap gap-3">
        <LocalizedClientLink href="/servicios/envios-hetna#cotizar-envio" className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white">
          <TS>Cotizar envío</TS>
        </LocalizedClientLink>
        <LocalizedClientLink href="/user/envios" className="rounded-xl border border-[#E7E4DC] px-5 py-3 font-semibold text-[#142033]">
          <TS>Mis envíos</TS>
        </LocalizedClientLink>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
