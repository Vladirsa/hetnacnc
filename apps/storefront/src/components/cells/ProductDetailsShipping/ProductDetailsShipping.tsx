import { ProductPageAccordion } from '@/components/molecules';

export const ProductDetailsShipping = () => {
  return (
    <ProductPageAccordion
      heading='Envíos y devoluciones'
      defaultOpen={false}
    >
      <div className='product-details'>
        <ul>
          <li>
            Envío a todo México. El costo y tiempo de entrega se calculan al finalizar la compra. Los archivos digitales se entregan de inmediato.
</li>
          <li>
            ¿Algún problema con tu pedido? Escríbenos por WhatsApp y lo resolvemos.
</li>
        </ul>
      </div>
    </ProductPageAccordion>
  );
};
