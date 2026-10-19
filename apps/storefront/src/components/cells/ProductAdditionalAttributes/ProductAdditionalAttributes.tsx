import { ProductPageAccordion } from "@/components/molecules"
import { AdditionalAttributeProps } from "@/types/product"

// Especificaciones técnicas: tabla de dos columnas (dato / valor), abierta por defecto.
// Los datos son los atributos que el taller captura al publicar el producto.
export const ProductAdditionalAttributes = ({
  attributes,
}: {
  attributes: AdditionalAttributeProps[]
}) => {
  if (!attributes?.length) return null

  const conDatos = attributes.filter((a) => !!a && a.id && a.attribute?.name && a.value)
  if (!conDatos.length) return null

  return (
    <ProductPageAccordion heading="Especificaciones técnicas" defaultOpen data-testid="product-additional-attributes-section">
      <dl className="overflow-hidden rounded-md border border-[#E7E4DC] text-sm">
        {conDatos.map((a, n) => (
          <div
            key={a.id}
            className={`grid grid-cols-[40%_60%] ${n % 2 === 0 ? "bg-[#F7F5EF]" : "bg-white"}`}
            data-testid={`product-attribute-${a.attribute?.name?.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <dt className="px-3 py-2.5 font-semibold text-[#142033]">{a.attribute?.name}</dt>
            <dd className="px-3 py-2.5 text-[#40403A]">{a.value}</dd>
          </div>
        ))}
      </dl>
    </ProductPageAccordion>
  )
}
