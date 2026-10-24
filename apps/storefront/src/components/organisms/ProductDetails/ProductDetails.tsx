import {
  ProductAdditionalAttributes,
  ProductDetailsFooter,
  ProductDetailsHeader,
  ProductDetailsSeller,
  ProductDetailsShipping,
  ProductPageDetails,
} from "@/components/cells"
import ConfianzaProducto from "@/components/hetna/ConfianzaProducto"
import { DistintivoEnvioGratis } from "@/components/hetna/envios/DistintivoEnvioGratis"
import { EscalonesVolumen } from "@/components/hetna/precios/EscalonesVolumen"
import { PuntosDestacados } from "@/components/hetna/PuntosDestacados"
import { getBuyboxWinner, rankOffers, StoreOffer } from "@/lib/helpers/buybox"
import { umbralesDeEnvioGratis } from "@/lib/envios/envio-gratis"
import { escalonesDeOferta } from "@/lib/helpers/volumen"
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
  // Los productos maestros no tienen vendedor: el que se enseña sale de la
  // oferta que gana el buybox.
  const ganadora = getBuyboxWinner(rankOffers(offers))
  const seller = ganadora?.seller

  // El umbral de envío gratis del taller que gana el buybox -- el mismo que va
  // a cobrar. Va junto al precio porque es parte del precio de la decisión, no
  // un adorno de confianza.
  const umbrales = seller?.id ? await umbralesDeEnvioGratis([seller.id]) : {}
  const envioGratisDesde = seller?.id ? umbrales[seller.id]?.gratis_desde : null
  const moneda = ganadora?.calculated_price?.currency_code || "mxn"

  // Precios por cantidad del taller que gana el buybox. Van arriba del bloque
  // de confianza porque aquí el cliente está decidiendo CUÁNTAS piezas pedir,
  // y es el único lugar donde ver la tabla completa cambia ese número.
  const escalones = ganadora ? escalonesDeOferta(ganadora) : []
  const precioUnitario = ganadora?.calculated_price?.calculated_amount ?? null

  return (
    <div className="flex flex-col gap-4">
      <ProductDetailsHeader
        product={product}
        locale={locale}
        offers={offers}
        seller={seller}
      />

      {escalones.length > 0 && (
        <EscalonesVolumen escalones={escalones} precioUnitario={precioUnitario} />
      )}

      <DistintivoEnvioGratis desde={envioGratisDesde} currency_code={moneda} />

      <ConfianzaProducto />

      <ProductDetailsSeller seller={seller} />
    </div>
  )
}

// Lo que se lee DESPUÉS de decidir: descripción, medidas, envío y etiquetas.
export const ProductDetallesLargos = ({
  product,
  locale,
  taller,
}: {
  product: Props["product"]
  locale: string
  taller?: { name?: string | null; handle?: string | null }
}) => (
  <div className="flex flex-col gap-4">
    <PuntosDestacados
      product={product}
      locale={locale}
      taller={taller}
      atributos={product?.attribute_values || []}
    />
    <ProductPageDetails details={product?.description || ""} />
    <ProductAdditionalAttributes attributes={product?.attribute_values || []} />
    <ProductDetailsShipping />
    <ProductDetailsFooter tags={product?.tags || []} posted={product?.created_at} />
  </div>
)
