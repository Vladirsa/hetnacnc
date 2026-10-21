import {
  ProductAdditionalAttributes,
  ProductDetailsFooter,
  ProductDetailsHeader,
  ProductDetailsSeller,
  ProductDetailsShipping,
  ProductPageDetails,
} from "@/components/cells"
import BotonPreguntarTaller from "@/components/hetna/chat/BotonPreguntarTaller"
import ConfianzaProducto from "@/components/hetna/ConfianzaProducto"
import { retrieveCustomer } from "@/lib/data/customer"
import { getBuyboxWinner, rankOffers, StoreOffer } from "@/lib/helpers/buybox"
import { AdditionalAttributeProps } from "@/types/product"
import { HttpTypes } from "@medusajs/types"

type Props = {
  product: HttpTypes.StoreProduct & {
    attribute_values?: AdditionalAttributeProps[]
  }
  locale: string
  offers?: StoreOffer[]
}

// La columna de la derecha: sólo lo que hace falta para decidir la compra.
//
// La descripción, las medidas y el envío se fueron abajo, a todo lo ancho
// (ProductDetallesLargos). No es sólo acomodo: esta columna queda pegada al
// scroll mientras se lee la ficha, y un bloque pegajoso más alto que la
// pantalla nunca se ve pegado. Con la descripción adentro medía el doble de la
// ventana.
export const ProductDetails = async ({ product, locale, offers = [] }: Props) => {
  const user = await retrieveCustomer()

  // Los productos maestros no tienen vendedor: el que se enseña sale de la
  // oferta que gana el buybox.
  const seller = getBuyboxWinner(rankOffers(offers))?.seller

  return (
    <div className="flex flex-col gap-4">
      <ProductDetailsHeader
        product={product}
        locale={locale}
        user={user}
        offers={offers}
        seller={seller}
      />

      <ConfianzaProducto />

      {seller?.handle && (
        <BotonPreguntarTaller
          tallerHandle={seller.handle}
          tallerNombre={seller.name || "el taller"}
          productoHandle={product?.handle}
          productoTitulo={product?.title}
          className="inline-flex h-12 w-full items-center justify-center rounded-lg border-2 border-[#C2560A] px-5 text-base font-semibold text-[#C2560A] hover:bg-[#C2560A] hover:text-white"
        />
      )}

      <ProductDetailsSeller seller={seller} />
    </div>
  )
}

// Lo que se lee DESPUÉS de decidir: descripción, medidas, envío y etiquetas.
export const ProductDetallesLargos = ({ product }: { product: Props["product"] }) => (
  <div className="flex flex-col gap-4">
    <ProductPageDetails details={product?.description || ""} />
    <ProductAdditionalAttributes attributes={product?.attribute_values || []} />
    <ProductDetailsShipping />
    <ProductDetailsFooter tags={product?.tags || []} posted={product?.created_at} />
  </div>
)
