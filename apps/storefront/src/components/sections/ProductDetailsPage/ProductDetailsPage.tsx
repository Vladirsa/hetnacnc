import { ProductGallery } from "@/components/organisms"
import { ProductDetails, ProductDetallesLargos } from "@/components/organisms/ProductDetails/ProductDetails"
import { listProducts } from "@/lib/data/products"
import { listOffers } from "@/lib/data/offers"
import { getBuyboxWinner, getOfferAmount, getOfferStock, rankOffers, StoreOffer } from "@/lib/helpers/buybox"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { TrackEvent } from "@/components/analytics/TrackEvent"
import { JsonLd } from "@/components/hetna/JsonLd"
import { ResenasProducto } from "@/components/hetna/resenas/ResenasProducto"
import { resenasDeProducto, resenasPendientes } from "@/lib/resenas/acciones"
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
  // Se piden las categorías por nombre: de ahí salen las migas de pan y los
  // productos "que te pueden interesar". La cadena repite los campos que usa
  // la lista porque `fields` REEMPLAZA, no agrega: dejarlo sólo en
  // "*categories" tiraría los precios calculados.
  const prod = await listProducts({
    countryCode: locale,
    queryParams: {
      handle: [handle],
      limit: 1,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.options," +
        "*attribute_values,*attribute_values.attribute,*categories,*tags,*type",
    },
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

  // Las reseñas y, si el visitante compró esto y no lo ha reseñado, el pendiente
  // que abre el formulario. Lo segundo devuelve vacío sin sesión, así que no
  // hace falta preguntar antes si hay cliente.
  const [resenas, pendientes] = await Promise.all([
    resenasDeProducto(prod.id),
    resenasPendientes(),
  ])
  const pendienteDeEste = pendientes.find((p) => p.product_id === prod.id)

  // Productos de la misma categoría, para "también te puede interesar". Se
  // piden unos de más porque hay que sacar el que ya se está viendo.
  const categoriaId = (prod as { categories?: { id?: string }[] }).categories?.[0]?.id
  const relacionados = categoriaId
    ? await listProducts({
        countryCode: locale,
        category_id: categoriaId,
        queryParams: { limit: 8 },
      })
        .then(({ response }) => response.products.filter((p) => p.id !== prod.id))
        .catch(() => [])
    : []

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
            <div className="mt-4">
              <ResenasProducto
                datos={resenas}
                productId={prod.id}
                pendiente={pendienteDeEste}
              />
            </div>
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
          <div className="mt-4">
            <ResenasProducto
              datos={resenas}
              productId={prod.id}
              pendiente={pendienteDeEste}
            />
          </div>
        </div>
      </div>
      {/* Dos listas distintas y con el nombre que les toca. La de abajo decía
          "Productos similares" pero enseñaba los del MISMO taller, que no es
          lo mismo: una sirve para seguir comprándole a quien ya te convenció,
          y la otra para comparar contra lo demás de su categoría. */}
      {Boolean(prod.seller?.products?.length) && (
        <div className="mt-8">
          <HomeProductSection
            heading={
              vendedor?.name ? `Más de ${vendedor.name}` : "Más de este taller"
            }
            products={prod.seller?.products}
            locale={locale}
          />
        </div>
      )}

      {relacionados.length > 0 && (
        <div className="mt-4">
          <HomeProductSection
            heading="También te puede interesar"
            products={relacionados as never}
            locale={locale}
          />
        </div>
      )}
    </>
  )
}
