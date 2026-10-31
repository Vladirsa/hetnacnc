import { ProductPageAccordion } from "@/components/molecules/ProductPageAccordion/ProductPageAccordion"
import { htmlSeguro } from "@/lib/seguridad/html-seguro"

// Descripción del producto: abierta por defecto (es lo primero que busca quien compra)
export const ProductPageDetails = ({ details }: { details: string }) => {
  if (!details) return null

  return (
    <ProductPageAccordion heading="Descripción del producto" icono="📝" defaultOpen data-testid="product-details-section">
      <div
        className="product-details"
        dangerouslySetInnerHTML={{
          // La escribe el taller: se limpia para que no pueda meter código
          __html: htmlSeguro(details),
        }}
        data-testid="product-details-content"
      />
    </ProductPageAccordion>
  )
}
