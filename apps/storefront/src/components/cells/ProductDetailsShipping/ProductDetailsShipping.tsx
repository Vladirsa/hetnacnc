import { ProductPageAccordion } from '@/components/molecules/ProductPageAccordion/ProductPageAccordion'
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { EMPRESA } from '@/lib/hetna/empresa';

export const ProductDetailsShipping = () => {
  return (
    <ProductPageAccordion
      heading="Envíos y devoluciones"
      icono="🚚"
      defaultOpen={false}
    >
      <div className="product-details">
        <ul>
          <li>
            Envío a todo México. El costo y los días de entrega se calculan con tu
            dirección, antes de pagar. Los archivos digitales se entregan en cuanto se
            confirma el pago.
          </li>
          <li>
            {EMPRESA.diasDevolucion} días hábiles para devolver un producto físico sin
            uso. Si llegó dañado, incompleto o distinto, el envío de regreso no te
            cuesta.{' '}
            <LocalizedClientLink href="/devoluciones">
              Ver la política completa
            </LocalizedClientLink>
            .
          </li>
          <li>
            Archivos digitales: no tienen devolución una vez entregados, salvo que el
            archivo no corresponda a lo anunciado (otro diseño, dañado o que no abre).
            En ese caso lo revisamos y te lo cambiamos o te devolvemos tu dinero.
          </li>
          <li>
            {/* Antes aquí decía "escríbenos por WhatsApp". Se cambió por el chat de
                la plataforma: es donde queda registro de lo acordado si después hay
                una aclaración o una devolución. */}
            ¿Algo no salió bien? Escríbele al taller con el botón de arriba, o a
            nosotros desde{' '}
            <LocalizedClientLink href="/contacto">Contacto</LocalizedClientLink>.
          </li>
        </ul>
      </div>
    </ProductPageAccordion>
  );
};
