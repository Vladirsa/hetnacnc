import { ProductGallery } from "@/components/organisms/ProductGallery/ProductGallery"
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
import { ProductosCompactos } from "@/components/hetna/ProductosCompactos"
import { FichaProducto } from "@/components/hetna/FichaProducto"
import { notFound } from "next/navigation"
import { productoExtra } from "@/lib/hetna/producto-extra"
import { VideoProducto } from "@/components/hetna/VenderMas"
import { esFichaDescarga } from "@/lib/hetna/tipo-ficha"
import { GaleriaDescarga } from "@/components/hetna/fichas/descarga/GaleriaDescarga"
import { AbajoDescarga, vistasGaleria } from "@/components/hetna/fichas/descarga/FichaDescarga"

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
  const resultado = await listProducts({
    countryCode: locale,
    queryParams: {
      handle: [handle],
      limit: 1,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.options," +
        "*attribute_values,*attribute_values.attribute,*categories,*tags,*type,+metadata",
    },
  })
  const prod = resultado.response.products[0]

  // Si el API no contestó y no hay copia guardada, NO es un 404: es una falla
  // temporal. Un 404 le dice a Google que la ficha ya no existe; un error
  // (500) le dice que vuelva luego.
  if (!prod && resultado.fallo) {
    throw new Error(`Ficha ${handle}: el API no contestó`)
  }

  // `notFound()` y no `return null`: devolver null dibujaba encabezado, una
  // franja en blanco y pie, con estado 200. Para el cliente es una página rota
  // sin explicación, y para Google es un "soft 404" -- la indexa como válida
  // porque el servidor dijo que todo salió bien.
  //
  // Esto se descubrió el 25 de octubre: una ficha real en producción se veía
  // vacía, y además era la razón de que el contador de vistas nunca registrara
  // nada (sin ficha dibujada, no hay componente que avise).
  if (!prod) {
    notFound()
  }

  // Misma razón para el taller suspendido: antes renderizaba la pantalla de
  // "no encontrado" pero con estado 200.
  if (prod.seller?.store_status === "SUSPENDED") {
    notFound()
  }

  // Ofertas, reseñas y relacionados no dependen entre sí: se piden a la vez.
  // Antes iban uno tras otro y cada uno sumaba su espera a la de la ficha.
  const categoriaId = (prod as { categories?: { id?: string }[] }).categories?.[0]?.id
  const [{ offers }, resenas, pendientes, relacionados, extra, recientes] = await Promise.all([
    listOffers({ productId: prod.id, countryCode: locale }),
    resenasDeProducto(prod.id),
    resenasPendientes(),
    categoriaId
      ? listProducts({ countryCode: locale, category_id: categoriaId, queryParams: { limit: 8 } })
          .then(({ response }) => response.products.filter((p) => p.id !== prod.id))
          .catch(() => [])
      : Promise.resolve([]),
    // Visitas de la semana y el video de redes del producto (no frena la ficha: 2.5 s máximo y caché)
    productoExtra(prod.id),
    // Lo más nuevo de toda la tienda, para cerrar la ficha invitando a ver más
    listProducts({ countryCode: locale, queryParams: { limit: 16, order: "-created_at" } as never })
      .then(({ response }) => response.products)
      .catch(() => []),
  ])
  // Sin repetir lo que ya sale en "Más de este taller" o en los similares
  const yaMostrados = new Set([prod.id, ...relacionados.map((p) => p.id), ...((prod.seller?.products ?? []) as { id: string }[]).map((p) => p.id)])
  const masProductos = recientes.filter((p) => !yaMostrados.has(p.id)).slice(0, 12)

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

  const pendienteDeEste = pendientes.find((p) => p.product_id === prod.id)

  // Diseño para descargar: galería con esquema, "Cómo funciona", pestañas y
  // preguntas (components/hetna/fichas/descarga). Sin existencias ni envíos.
  const descarga = esFichaDescarga(prod)
  const largosDescarga = descarga ? (
    <div className="flex flex-col gap-6">
      <AbajoDescarga product={prod as never} fotosCompradores={(resenas?.resenas || []).flatMap((r) => r.fotos || [])} />
      <ResenasProducto datos={resenas} productId={prod.id} pendiente={pendienteDeEste} />
    </div>
  ) : null

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
          {descarga ? (
            <GaleriaDescarga vistas={vistasGaleria(prod as never)} titulo={prod.title} />
          ) : (
            <ProductGallery images={prod?.images || []} title={prod.title} />
          )}
          {/* La ficha larga va debajo de las fotos, no en la columna de la
              compra: así el bloque de compra cabe en la pantalla y se puede
              quedar pegado mientras se lee todo esto. */}
          <div className="mt-8 hidden lg:block">
            {largosDescarga}
            {!descarga && <ProductDetallesLargos
              product={prod}
              locale={locale}
              taller={{ name: vendedor?.name, handle: vendedor?.handle }}
            />}
            {!descarga && <div className="mt-4">
              <ResenasProducto
                datos={resenas}
                productId={prod.id}
                pendiente={pendienteDeEste}
              />
            </div>}
          </div>
        </div>

        <div data-testid="product-details-container">
          <div className="lg:sticky lg:top-6">
            <ProductDetails
              product={prod}
              locale={locale}
              offers={offers as StoreOffer[]}
              vistas={extra.vistas_7d}
            />
          </div>
        </div>

        {/* En celular no hay dos columnas, así que la ficha larga va al final
            y no entre las fotos y el botón de comprar. */}
        <div className="lg:hidden">
          {largosDescarga}
          {!descarga && <ProductDetallesLargos
            product={prod}
            locale={locale}
            taller={{ name: vendedor?.name, handle: vendedor?.handle }}
          />}
          {!descarga && <div className="mt-4">
            <ResenasProducto
              datos={resenas}
              productId={prod.id}
              pendiente={pendienteDeEste}
            />
          </div>}
        </div>
      </div>
      {/* Compatibilidad, videos, archivos y preguntas frecuentes del producto
          (product.metadata; ver lib/helpers/product-metadata.ts). Si no trae
          nada, no se dibuja. */}
      <FichaProducto
        metadata={prod.metadata as Record<string, unknown> | null | undefined}
        titulo={prod.title}
        omitirFaq={descarga}
      />
      {extra.video && <VideoProducto url={extra.video} titulo={prod.title} />}

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
            heading={descarga ? "Otros diseños" : "Productos similares"}
            products={relacionados as never}
            locale={locale}
          />
        </div>
      )}

      {/* Al final de la ficha: más productos para seguir viendo */}
      {masProductos.length > 0 && (
        <div className="mt-4">
          <ProductosCompactos titulo="Descubre más productos" productos={masProductos as never} />
        </div>
      )}
    </>
  )
}
