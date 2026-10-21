import { ProductGallery } from "@/components/organisms"
import { ProductDetails, ProductDetallesLargos } from "@/components/organisms/ProductDetails/ProductDetails"
import { listProducts } from "@/lib/data/products"
import { listOffers } from "@/lib/data/offers"
import { getBuyboxWinner, getOfferAmount, getOfferStock, rankOffers, StoreOffer } from "@/lib/helpers/buybox"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { TrackEvent } from "@/components/analytics/TrackEvent"
import { JsonLd } from "@/components/hetna/JsonLd"
import { baseSitio, migas, productoSchema } from "@/lib/hetna/schema"
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
  const vendedor = winnerOffer?.seller || prod.seller

  // Migas de pan: Inicio > Categoría (si el producto tiene) > Producto
  const base = baseSitio()
  const categoria = (prod as { categories?: { name?: string | null; handle?: string | null }[] }).categories?.[0]
  const rutaMigas = [
    { nombre: "Inicio", ruta: `${base}/${locale}` },
    ...(categoria?.name && categoria?.handle
      ? [{ nombre: categoria.name, ruta: `${base}/${locale}/categories/${categoria.handle}` }]
      : []),
    { nombre: prod.title },
  ]

  return (
    <>
      <TrackEvent
        event="view_item"
        currency={eventCurrency}
        item={{ item_id: prod.id, item_name: prod.title, price: eventPrice }}
      />
      {/* Datos para Google: producto con precio, existencia, especificaciones y devoluciones */}
      <JsonLd
        id="ld-product"
        datos={productoSchema({
          producto: prod as never,
          locale,
          precio: schemaPrice ?? 0,
          moneda: schemaCurrency,
          hayExistencia: inStock,
          vendedor: { nombre: vendedor?.name, handle: vendedor?.handle },
        })}
      />
      <JsonLd id="ld-migas" datos={migas(rutaMigas)} />
      <div
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-10"
        data-testid="product-details-page"
      >
        <div className="min-w-0" data-testid="product-gallery-container">
          <ProductGallery images={prod?.images || []} title={prod.title} />
          {/* La ficha larga va debajo de las fotos, no en la columna de la
              compra: así el bloque de compra cabe en la pantalla y se puede
              quedar pegado mientras se lee todo esto. */}
          <div className="mt-8 hidden lg:block">
            <ProductDetallesLargos
              product={prod}
              locale={locale}
              taller={{ name: vendedor?.name, handle: vendedor?.handle }}
            />
          </div>
        </div>

        <div data-testid="product-details-container">
          <div className="lg:sticky lg:top-6">
            <ProductDetails
              product={prod}
              locale={locale}
              offers={offers as StoreOffer[]}
            />
          </div>
        </div>

        {/* En celular no hay dos columnas, así que la ficha larga va al final
            y no entre las fotos y el botón de comprar. */}
        <div className="lg:hidden">
          <ProductDetallesLargos
            product={prod}
            locale={locale}
            taller={{ name: vendedor?.name, handle: vendedor?.handle }}
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
