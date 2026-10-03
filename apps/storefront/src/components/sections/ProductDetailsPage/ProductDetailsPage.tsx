import { ProductDetails, ProductGallery } from "@/components/organisms"
import { listProducts } from "@/lib/data/products"
import { listOffers } from "@/lib/data/offers"
import { getBuyboxWinner, getOfferAmount, getOfferStock, rankOffers, StoreOffer } from "@/lib/helpers/buybox"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { TrackEvent } from "@/components/analytics/TrackEvent"
import { HomeProductSection } from "../HomeProductSection/HomeProductSection"
import NotFound from "@/app/not-found"

export const ProductDetailsPage = async ({
  handle,
  locale,
}: {
  handle: string
  locale: string
}) => {
  const prod = await listProducts({
    countryCode: locale,
    queryParams: { handle: [handle], limit: 1 },
  }).then(({ response }) => response.products[0])

  if (!prod) return null

  if (prod.seller?.store_status === "SUSPENDED") {
    return NotFound()
  }

  const { offers } = await listOffers({
    productId: prod.id,
    countryCode: locale,
  })

  const { cheapestPrice } = getProductPrice({ product: prod })
  const eventPrice = cheapestPrice?.calculated_price_number ?? 0
  const eventCurrency = cheapestPrice?.currency_code || "mxn"

  // Ganador del buybox a nivel de producto (no de una variante en particular):
  // es la oferta que Google debe mostrar como precio/disponibilidad en los
  // resultados de búsqueda.
  const winnerOffer = getBuyboxWinner(rankOffers(offers as StoreOffer[]))
  const schemaPrice = winnerOffer ? getOfferAmount(winnerOffer) : eventPrice
  const schemaCurrency =
    winnerOffer?.calculated_price?.currency_code || eventCurrency
  const inStock = winnerOffer ? getOfferStock(winnerOffer) > 0 : false
  const sellerName = winnerOffer?.seller?.name || prod.seller?.name

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const productUrl = `${baseUrl}/${locale}/products/${prod.handle}`

  return (
    <>
      <TrackEvent
        event="view_item"
        currency={eventCurrency}
        item={{ item_id: prod.id, item_name: prod.title, price: eventPrice }}
      />
      {/* <script> plano (no next/script): necesario en el HTML inicial para
          crawlers que no esperan a la hidratación. */}
      <script
        id="ld-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: prod.title,
            description: prod.description || prod.title,
            image: (prod.images || []).map((img) => img.url),
            sku: prod.id,
            ...(sellerName ? { brand: { "@type": "Brand", name: sellerName } } : {}),
            offers: {
              "@type": "Offer",
              url: productUrl,
              priceCurrency: schemaCurrency.toUpperCase(),
              price: schemaPrice ?? 0,
              availability: inStock
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
              ...(sellerName
                ? { seller: { "@type": "Organization", name: sellerName } }
                : {}),
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <div className="flex flex-col md:flex-row lg:gap-12" data-testid="product-details-page">
        <div className="md:w-1/2 md:px-2" data-testid="product-gallery-container">
          <ProductGallery images={prod?.images || []} />
        </div>
        <div className="md:w-1/2 md:px-2" data-testid="product-details-container">
          <ProductDetails
            product={prod}
            locale={locale}
            offers={offers as StoreOffer[]}
          />
        </div>
      </div>
      <div className="my-8">
        <HomeProductSection
          heading="Productos similares"
          products={prod.seller?.products}
          locale={locale}
        />
      </div>
    </>
  )
}
