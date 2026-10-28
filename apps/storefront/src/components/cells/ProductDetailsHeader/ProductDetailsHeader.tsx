"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { Button } from "@/components/atoms"
import BotonPreguntarTaller from "@/components/hetna/chat/BotonPreguntarTaller"
import { BotonFavorito } from "@/components/hetna/Favoritos"
import { DescargarGratis } from "@/components/hetna/descargas/DescargarGratis"
import { ProductVariants } from "@/components/molecules"
import { CompareOffersModal } from "@/components/organisms/CompareOffersModal/CompareOffersModal"
import { useCartContext } from "@/components/providers"
import useGetAllSearchParams from "@/hooks/useGetAllSearchParams"
import { trackAddToCart } from "@/lib/analytics/events"
import {
  getBuyboxWinner,
  getOfferAmount,
  getOfferStock,
  getVariantOffers,
  StoreOffer,
} from "@/lib/helpers/buybox"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { convertToLocale } from "@/lib/helpers/money"
import { toast } from "@/lib/helpers/toast"
import { HttpTypes } from "@medusajs/types"
import { SellerDTO } from "@mercurjs/types"

// A partir de cuántas piezas deja de ser urgente decirlo. Arriba de esto el
// número no cambia la decisión de nadie; abajo, sí.
const EXISTENCIAS_BAJAS = 10

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce(
    (
      acc: Record<string, string>,
      varopt: HttpTypes.StoreProductOptionValue
    ) => {
      acc[varopt.option?.title.toLowerCase() || ""] = varopt.value

      return acc
    },
    {}
  )
}

export const ProductDetailsHeader = ({
  product,
  locale,
  offers = [],
  seller,
}: {
  product: HttpTypes.StoreProduct
  locale: string
  offers?: StoreOffer[]
  seller?: SellerDTO
}) => {
  const { addToCart, onAddToCart, cart, isAddingItem } = useCartContext()
  const { allSearchParams } = useGetAllSearchParams()
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [cantidad, setCantidad] = useState(1)
  const [comprando, setComprando] = useState(false)
  const router = useRouter()

  const { cheapestVariant, cheapestPrice } = getProductPrice({ product })

  // Archivo gratis: no hay precio ni carrito, se baja con cuenta dentro del
  // cupo semanal. Lo decide el producto, no la oferta.
  const esGratis = (product.metadata as Record<string, unknown> | null)?.archivo_gratis === true

  const hasAnyPrice = cheapestPrice !== null && cheapestVariant !== null

  const selectedVariant = hasAnyPrice
    ? {
        ...optionsAsKeymap(cheapestVariant.options ?? null),
        ...allSearchParams,
      }
    : allSearchParams

  const variantId =
    product.variants?.find(({ options }: { options: any }) =>
      options?.every((option: any) =>
        selectedVariant[option.option?.title.toLowerCase() || ""]?.includes(
          option.value
        )
      )
    )?.id || ""

  const { variantPrice } = getProductPrice({ product, variantId })

  // Buybox: la oferta ganadora de la variante elegida manda el precio y es la
  // que se agrega al carrito. Los productos se venden por oferta, no por el
  // precio base de la variante.
  const variantOffers = getVariantOffers(offers, variantId)
  const winnerOffer = getBuyboxWinner(variantOffers)
  const otherOffersCount = Math.max(variantOffers.length - 1, 0)

  const offerAmount = winnerOffer ? getOfferAmount(winnerOffer) : null
  const offerCurrency =
    winnerOffer?.calculated_price?.currency_code ||
    variantPrice?.currency_code ||
    "mxn"
  const offerStock = winnerOffer ? getOfferStock(winnerOffer) : 0
  const hayOferta = !!winnerOffer && offerAmount !== null

  // `original_amount` es lo que costaría sin la promoción vigente. Medusa lo
  // manda junto al precio calculado; cuando no hay promoción vale lo mismo que
  // el calculado, y entonces no hay nada que tachar.
  const precios = winnerOffer?.calculated_price as
    | {
        calculated_amount?: number
        original_amount?: number
        calculated_amount_without_tax?: number
      }
    | undefined
  const precioLista = precios?.original_amount ?? null
  const hayDescuento =
    hayOferta && precioLista !== null && precioLista > (offerAmount as number)
  const porcentaje = hayDescuento
    ? Math.round(((precioLista! - (offerAmount as number)) / precioLista!) * 100)
    : 0

  // Si el precio con impuesto es mayor que el precio sin impuesto, el IVA ya va
  // incluido en lo que se enseña. Decirlo quita la duda de "¿y arriba me cobran
  // más?", que es de las que frenan una compra.
  const ivaIncluido =
    hayOferta &&
    typeof precios?.calculated_amount_without_tax === "number" &&
    (offerAmount as number) > precios.calculated_amount_without_tax

  const precioTexto = (amount: number) =>
    convertToLocale({ amount, currency_code: offerCurrency })

  const enCarrito =
    cart?.items?.find((item) => item.metadata?.offer_id === winnerOffer?.id)
      ?.quantity ?? 0
  const disponibles = Math.max(offerStock - enCarrito, 0)
  const cantidadValida = Math.min(Math.max(cantidad, 1), Math.max(disponibles, 1))

  const noSePuedeComprar = !hayOferta || disponibles === 0

  const agregar = async (): Promise<boolean> => {
    if (!winnerOffer || noSePuedeComprar) return false

    const total = (offerAmount as number) * cantidadValida
    const sinImpuesto =
      (precios?.calculated_amount_without_tax ?? (offerAmount as number)) * cantidadValida

    onAddToCart(
      {
        thumbnail: product.thumbnail || "",
        product_title: product.title,
        quantity: cantidadValida,
        subtotal: sinImpuesto,
        total,
        tax_total: total - sinImpuesto,
        variant_id: variantId,
        product_id: product.id,
        variant: product.variants?.find(({ id }) => id === variantId),
        metadata: { offer_id: winnerOffer.id },
      },
      offerCurrency
    )

    try {
      await addToCart({
        offerId: winnerOffer.id,
        quantity: cantidadValida,
        countryCode: locale,
      })
      trackAddToCart(
        {
          item_id: product.id,
          item_name: product.title,
          price: offerAmount as number,
          quantity: cantidadValida,
        },
        offerCurrency
      )
      return true
    } catch (error) {
      toast.error({
        title: "No se pudo agregar al carrito",
        description:
          error instanceof Error ? error.message : "Esta oferta no tiene inventario suficiente.",
      })
      return false
    }
  }

  // "Comprar ahora" es lo mismo que agregar y caminar al carrito, sin pedirle
  // al cliente que encuentre el carrito. Es un atajo, no un segundo cobro.
  const comprarAhora = async () => {
    setComprando(true)
    const listo = await agregar()
    setComprando(false)
    if (listo) router.push(`/${locale}/cart`)
  }

  return (
    <div
      className="rounded-[14px] border border-[#E7E4DC] bg-white p-5"
      data-testid="product-details-header"
    >
      {seller?.name && (
        <p className="mb-2 text-[13px] text-[#6B6A63]">
          Vendido por{" "}
          <a
            href={`/${locale}/sellers/${seller.handle}`}
            className="font-semibold text-[#B34D07] hover:underline"
          >
            {seller.name}
          </a>
        </p>
      )}

      <h1 className="text-[22px] font-bold leading-snug text-[#1B1B18] lg:text-[26px]" data-testid="product-title">
        {product.title}
      </h1>

      {esGratis ? (
        <DescargarGratis productId={product.id} />
      ) : (
      <>
      <div
        className={`mt-4 rounded-[12px] px-4 py-3 ${
          hayDescuento ? "bg-[#FFF3EC]" : "bg-[#F7F5EF]"
        }`}
        data-testid="product-price-container"
      >
        {hayOferta ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="text-[30px] font-bold leading-none text-[#1B1B18]"
                data-testid="product-price-current"
              >
                {precioTexto(offerAmount as number)}
              </span>
              {hayDescuento && (
                <>
                  <span className="text-[15px] text-[#8A8780] line-through">
                    {precioTexto(precioLista as number)}
                  </span>
                  <span className="rounded bg-[#9B3225] px-1.5 py-0.5 text-[12px] font-bold text-white">
                    −{porcentaje}%
                  </span>
                </>
              )}
            </div>
            {ivaIncluido && (
              <p className="mt-1 text-[12px] text-[#6B6A63]">IVA incluido</p>
            )}
          </>
        ) : hayAnyPrecio(hasAnyPrice, variantPrice) ? (
          <span className="text-[30px] font-bold leading-none text-[#1B1B18]" data-testid="product-price-current">
            {variantPrice!.calculated_price}
          </span>
        ) : (
          <span className="text-[14px] text-[#6B6A63]" data-testid="product-price-unavailable">
            No disponible en tu región
          </span>
        )}

        {hayOferta && disponibles > 0 && disponibles <= EXISTENCIAS_BAJAS && (
          <p className="mt-2 text-[13px] font-bold text-[#9B3225]">
            {disponibles === 1 ? "Queda 1 pieza" : `Solo quedan ${disponibles} piezas`}
          </p>
        )}
        {hayOferta && disponibles === 0 && (
          <p className="mt-2 text-[13px] font-bold text-[#9B3225]">
            {enCarrito > 0
              ? "Ya tienes en el carrito todo lo que hay"
              : "Agotado por ahora"}
          </p>
        )}
      </div>

      {hasAnyPrice && (
        <ProductVariants product={product} selectedVariant={selectedVariant} />
      )}

      {hayOferta && disponibles > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[14px] font-semibold text-[#4A4943]">Cantidad</span>
          <div className="flex items-center overflow-hidden rounded-[8px] border border-[#E7E4DC]">
            <button
              type="button"
              aria-label="Quitar uno"
              className="flex h-9 w-9 items-center justify-center text-[18px] leading-none text-[#4A4943] hover:bg-[#F4F2EC] disabled:text-[#C7C4BC]"
              disabled={cantidadValida <= 1}
              onClick={() => setCantidad(cantidadValida - 1)}
            >
              −
            </button>
            <span className="w-10 text-center text-[15px] font-semibold text-[#1B1B18]">
              {cantidadValida}
            </span>
            <button
              type="button"
              aria-label="Agregar uno"
              className="flex h-9 w-9 items-center justify-center text-[18px] leading-none text-[#4A4943] hover:bg-[#F4F2EC] disabled:text-[#C7C4BC]"
              disabled={cantidadValida >= disponibles}
              onClick={() => setCantidad(cantidadValida + 1)}
            >
              +
            </button>
          </div>
          <span className="text-[12px] text-[#6B6A63]">
            {disponibles} {disponibles === 1 ? "disponible" : "disponibles"}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Button
          onClick={comprarAhora}
          disabled={noSePuedeComprar || isAddingItem}
          loading={comprando}
          className="w-full py-3.5 text-[16px] font-bold"
          data-testid="product-buy-now-button"
        >
          {noSePuedeComprar ? "No disponible" : "Comprar ahora"}
        </Button>

        <button
          type="button"
          onClick={() => void agregar()}
          disabled={noSePuedeComprar || isAddingItem}
          className="w-full rounded-sm border-2 border-[#C2560A] py-3 text-[15px] font-bold text-[#C2560A] hover:bg-[#FFF3EC] disabled:border-[#D9D5CC] disabled:text-[#B6B3AB] disabled:hover:bg-transparent"
          data-testid="product-add-to-cart-button"
        >
          Agregar al carrito
        </button>
      </div>
      </>
      )}

      {/* Mensaje al taller, dentro de HETNA.
          Aquí había un botón de WhatsApp y se quitó, y no es sólo gusto: el
          propio chat de la plataforma bloquea los mensajes que traen teléfono
          o correo, con el aviso de que "los tratos se hacen dentro de HETNA,
          donde estás protegido". Poner al lado un botón que manda justo fuera
          de HETNA contradecía esa regla, dejaba la conversación sin registro
          para una aclaración o una devolución, y se llevaba la venta -- y su
          comisión -- fuera de la plataforma. */}
      {seller?.handle && (
        <BotonPreguntarTaller
          tallerHandle={seller.handle}
          tallerNombre={seller.name || "el taller"}
          productoHandle={product?.handle}
          productoTitulo={product?.title}
          etiqueta="Preguntar al taller"
          className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-[#E7E4DC] text-[15px] font-semibold text-[#1B1B18] hover:border-[#C2560A] hover:text-[#B34D07]"
        />
      )}

      <div className="mt-1">
        <BotonFavorito
          producto={{
            id: product.id,
            handle: product.handle || "",
            title: product.title,
            thumbnail: product.thumbnail || "",
          }}
        />
      </div>

      {otherOffersCount > 0 && (
        <button
          type="button"
          onClick={() => setIsCompareOpen(true)}
          className="mt-1 w-full rounded-sm border border-[#E7E4DC] py-2.5 text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A]"
          data-testid="compare-offers-button"
        >
          Comparar otras {otherOffersCount}{" "}
          {otherOffersCount === 1 ? "oferta" : "ofertas"}
        </button>
      )}

      {isCompareOpen && (
        <CompareOffersModal
          offers={variantOffers}
          locale={locale}
          variantLabel={
            product.variants?.find(({ id }) => id === variantId)?.title || undefined
          }
          onClose={() => setIsCompareOpen(false)}
        />
      )}

    </div>
  )
}

// Sólo para que el JSX de arriba se lea: hay precio base cuando el producto
// trae precio y la variante elegida también.
function hayAnyPrecio(
  hasAnyPrice: boolean,
  variantPrice: { calculated_price?: string } | null | undefined
): boolean {
  return Boolean(hasAnyPrice && variantPrice)
}
