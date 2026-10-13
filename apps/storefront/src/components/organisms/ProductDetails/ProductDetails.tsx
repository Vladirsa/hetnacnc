import {
  ProductDetailsFooter,
  ProductDetailsHeader,
  ProductDetailsSeller,
  ProductDetailsShipping,
  ProductPageDetails,
  ProductAdditionalAttributes,
} from "@/components/cells"
import BotonPreguntarTaller from "@/components/hetna/chat/BotonPreguntarTaller"

import { retrieveCustomer } from "@/lib/data/customer"
import {
  getBuyboxWinner,
  rankOffers,
  StoreOffer,
} from "@/lib/helpers/buybox"
import { AdditionalAttributeProps } from "@/types/product"
import { HttpTypes } from "@medusajs/types"

export const ProductDetails = async ({
  product,
  locale,
  offers = [],
}: {
  product: HttpTypes.StoreProduct & {
    attribute_values?: AdditionalAttributeProps[]
  }
  locale: string
  offers?: StoreOffer[]
}) => {
  const user = await retrieveCustomer()

  // Master products have no seller; the seller shown comes from the buybox
  // winning offer.
  const seller = getBuyboxWinner(rankOffers(offers))?.seller

  return (
    <div>
      <ProductDetailsHeader
        product={product}
        locale={locale}
        user={user}
        offers={offers}
        seller={seller}
      />
      <ProductPageDetails details={product?.description || ""} />
      <ProductAdditionalAttributes
        attributes={product?.attribute_values || []}
      />
      <ProductDetailsShipping />
      {/* Chat con el taller que vende este producto (el taller se valida en el servidor) */}
      {seller?.handle && (
        <div className="my-4">
          <BotonPreguntarTaller
            tallerHandle={seller.handle}
            tallerNombre={seller.name || "el taller"}
            productoHandle={product?.handle}
            productoTitulo={product?.title}
            className="inline-flex h-12 w-full items-center justify-center rounded-lg border-2 border-[#C2560A] px-5 text-base font-semibold text-[#C2560A] hover:bg-[#C2560A] hover:text-white"
          />
        </div>
      )}
      <ProductDetailsSeller seller={seller} />
      <ProductDetailsFooter
        tags={product?.tags || []}
        posted={product?.created_at}
      />
    </div>
  )
}
