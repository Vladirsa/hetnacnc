import { ProductPageAccordion } from "@/components/molecules"

// Descripción del producto: abierta por defecto (es lo primero que busca quien compra)
export const ProductPageDetails = ({ details }: { details: string }) => {
  if (!details) return null

  return (
    <ProductPageAccordion heading="Descripción del producto" icono="📝" defaultOpen data-testid="product-details-section">
      <div
        className="product-details"
        dangerouslySetInnerHTML={{
          __html: details,
        }}
        data-testid="product-details-content"
      />
    </ProductPageAccordion>
  )
}
