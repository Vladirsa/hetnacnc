import { ProductPageAccordion } from "@/components/molecules/ProductPageAccordion/ProductPageAccordion"
import { AdditionalAttributeProps } from "@/types/product"

// Tabla de especificaciones en DOS pares por renglón, como la de AliExpress.
//
// Antes era un par por renglón: con 19 datos técnicos -- diámetro, material,
// recubrimiento, dureza, longitud de filo -- se volvía una columna larguísima
// que nadie recorre. En dos pares cabe el doble en la misma altura, y en una
// fresa esos números son justo lo que decide la compra.
export const ProductAdditionalAttributes = ({
  attributes,
}: {
  attributes: AdditionalAttributeProps[]
}) => {
  if (!attributes?.length) return null

  const conDatos = attributes.filter((a) => !!a && a.id && a.attribute?.name && a.value)
  if (!conDatos.length) return null

  return (
    <ProductPageAccordion
      heading="Especificaciones técnicas"
      icono="📐"
      defaultOpen
      data-testid="product-additional-attributes-section"
    >
      <dl className="grid grid-cols-1 overflow-hidden rounded-[10px] border border-[#E7E4DC] text-[13px] lg:grid-cols-2">
        {conDatos.map((a, n) => (
          <div
            key={a.id}
            // El zebrado se calcula por PAR, no por celda: si se hiciera por
            // celda, en dos columnas quedaría un tablero de ajedrez.
            className={`grid grid-cols-[42%_58%] border-b border-[#EDEAE2] last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0 ${
              Math.floor(n / 2) % 2 === 0 ? "bg-[#F7F5EF]" : "bg-white"
            } ${n % 2 === 0 ? "lg:border-r lg:border-r-[#EDEAE2]" : ""}`}
            data-testid={`product-attribute-${a.attribute?.name
              ?.toLowerCase()
              .replace(/\s+/g, "-")}`}
          >
            <dt className="px-3 py-2.5 font-semibold leading-snug text-[#142033]">
              {a.attribute?.name}
            </dt>
            <dd className="px-3 py-2.5 leading-snug text-[#40403A]">{a.value}</dd>
          </div>
        ))}
      </dl>
    </ProductPageAccordion>
  )
}
