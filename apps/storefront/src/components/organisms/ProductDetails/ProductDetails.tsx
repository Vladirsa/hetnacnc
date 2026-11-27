import { TS } from "@/i18n/TS"
import { ProductDetailsFooter } from "@/components/cells/ProductDetailsFooter/ProductDetailsFooter"
import { ProductDetailsHeader } from "@/components/cells/ProductDetailsHeader/ProductDetailsHeader"
import { ProductDetailsSeller } from "@/components/cells/ProductDetailsSeller/ProductDetailsSeller"
import { ProductDetailsShipping } from "@/components/cells/ProductDetailsShipping/ProductDetailsShipping"
import { ProductPageDetails } from "@/components/cells/ProductPageDetails/ProductPageDetails"
import ConfianzaProducto from "@/components/hetna/ConfianzaProducto"
import { VenderMas } from "@/components/hetna/VenderMas"
import { DistintivoEnvioGratis } from "@/components/hetna/envios/DistintivoEnvioGratis"
import { EscalonesVolumen } from "@/components/hetna/precios/EscalonesVolumen"
import { AvisoPack } from "@/components/hetna/packs/AvisoPack"
import { ContarVista } from "@/components/hetna/vistas/ContarVista"
import { PuntosDestacados } from "@/components/hetna/PuntosDestacados"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { getBuyboxWinner, rankOffers, StoreOffer } from "@/lib/helpers/buybox"
import { umbralesDeEnvioGratis } from "@/lib/envios/envio-gratis"
import { escalonesDeOferta } from "@/lib/helpers/volumen"
import { packsDeTalleres } from "@/lib/packs/acciones"
import { AdditionalAttributeProps } from "@/types/product"
import { HttpTypes } from "@medusajs/types"
import { FichaDigital, FichaServicio, ResumenServicio } from "@/components/hetna/fichas/FichaPorTipo"
import { esFichaDescarga, tipoFicha } from "@/lib/hetna/tipo-ficha"
import { ColumnaDescarga } from "@/components/hetna/fichas/descarga/FichaDescarga"
import AnunciosEspacio from "@/components/hetna/publicidad/AnunciosEspacio"
import { LoMasImportante } from "@/components/hetna/fichas/LoMasImportante"
import { EntregaGarantia, EspecificacionesFicha, IncluyeFicha } from "@/components/hetna/fichas/FichaUniversal"
import { datosClave, especificaciones, incluyeDe, limpiarDescripcion, notaPrecio, skuDe, tipoProducto, TIPOS_PRODUCTO } from "@/lib/hetna/tipo-producto"
import { Pestanas } from "@/components/hetna/fichas/descarga/Pestanas"

type Props = {
  product: HttpTypes.StoreProduct & {
    attribute_values?: AdditionalAttributeProps[]
  }
  locale: string
  offers?: StoreOffer[]
  vistas?: number // aperturas de la ficha en 7 días (para "N visitas esta semana")
  /** Impresión 3D bajo pedido: la lista de talleres va donde se compra */
  compraPropia?: React.ReactNode
}

// La columna de la derecha: sólo lo que hace falta para decidir la compra.
//
// La descripción, las medidas y el envío se fueron abajo, a todo lo ancho
// (ProductDetallesLargos). No es sólo acomodo: esta columna queda pegada al
// scroll mientras se lee la ficha, y un bloque pegajoso más alto que la
// pantalla nunca se ve pegado. Con la descripción adentro medía el doble de la
// ventana.
export const ProductDetails = async ({ product, locale, offers = [], vistas = 0, compraPropia }: Props) => {
  // Los productos maestros no tienen vendedor: el que se enseña sale de la
  // oferta que gana el buybox.
  const ganadora = getBuyboxWinner(rankOffers(offers))
  // Plantilla de ficha: digital, servicio o físico (lib/hetna/tipo-ficha)
  const tipo = tipoFicha(product as any)
  const descarga = esFichaDescarga(product)
  const seller = ganadora?.seller
  // Ficha universal: tipo, SKU, 4 datos clave y nota del precio
  const tipoProd = tipoProducto(product as never)
  const universal = {
    tipo: tipoProd,
    ...TIPOS_PRODUCTO[tipoProd],
    sku: skuDe(product as never),
    datosClave: datosClave(product as never),
    notaPrecio: notaPrecio(seller as never),
  }

  // El umbral de envío gratis del taller que gana el buybox -- el mismo que va
  // a cobrar. Va junto al precio porque es parte del precio de la decisión, no
  // un adorno de confianza.
  // Umbral y packs del taller se piden al mismo tiempo: la ficha no espera
  // una consulta detrás de la otra.
  const [umbrales, todosLosPacks] = seller?.id
    ? await Promise.all([umbralesDeEnvioGratis([seller.id]), packsDeTalleres([seller.id])])
    : [{} as Awaited<ReturnType<typeof umbralesDeEnvioGratis>>, [] as Awaited<ReturnType<typeof packsDeTalleres>>]
  const envioGratisDesde = seller?.id ? umbrales[seller.id]?.gratis_desde : null
  const moneda = ganadora?.calculated_price?.currency_code || "mxn"

  // Precios por cantidad del taller que gana el buybox. Van arriba del bloque
  // de confianza porque aquí el cliente está decidiendo CUÁNTAS piezas pedir,
  // y es el único lugar donde ver la tabla completa cambia ese número.
  const escalones = ganadora ? escalonesDeOferta(ganadora) : []
  const precioUnitario = ganadora?.calculated_price?.calculated_amount ?? null

  // Los packs del taller, pero SÓLO los que incluyen alguna categoría de ESTE
  // producto. Un taller con un pack de "Bujes" no debe anunciarlo en una placa:
  // el cliente juntaría tres placas y no le aplicaría nada.
  const categoriasDelProducto = new Set(
    ((product as { categories?: { id?: string }[] }).categories || [])
      .map((c) => c?.id)
      .filter((id): id is string => !!id)
  )
  const packs = todosLosPacks.filter((pack) =>
    pack.categorias.some((c) => categoriasDelProducto.has(c.id))
  )

  return (
    <div className="flex flex-col gap-4">
      {/* No dibuja nada: avisa que se abrió esta ficha, para que el taller
          pueda ver después qué productos visitan y a cuáles conviene bajarles
          el precio. */}
      <ContarVista productId={product.id} sellerId={seller?.id} />

      <ProductDetailsHeader
        product={product}
        locale={locale}
        offers={offers}
        seller={seller}
        tipo={tipo}
        descarga={descarga}
        universal={universal}
        compraPropia={compraPropia}
        antesDeComprar={
          tipo === "servicio" ? (
            <ResumenServicio metadata={product.metadata} />
          ) : descarga ? (
            <ColumnaDescarga product={product as never} vendedor={seller ? { handle: seller.handle, name: seller.name } : null} />
          ) : undefined
        }
      />

      {typeof product.metadata?.curso_slug === "string" && (
        <div className="bg-[#FDEEE1] border border-[#F2C98F] rounded-[12px] px-4 py-3 text-[14px] text-[#5A3A12]">
          <strong><TS>Curso de la Academia HETNA.</TS></strong> <TS>Al pagar quedas inscrito y lo ves en línea desde tu cuenta.</TS>{" "}
          <LocalizedClientLink
            href={`/aprendizaje-cnc/cursos/${product.metadata.curso_slug}`}
            className="font-semibold text-[#B34D07] underline"
          >
            <TS>Ver temario y lecciones gratis</TS>
          </LocalizedClientLink>
        </div>
      )}

      <AvisoPack packs={packs} />

      {escalones.length > 0 && (
        <EscalonesVolumen escalones={escalones} precioUnitario={precioUnitario} />
      )}

      {tipo === "fisico" && <DistintivoEnvioGratis desde={envioGratisDesde} currency_code={moneda} />}

      <ConfianzaProducto tipo={tipo} />

      <VenderMas titulo={product.title} handle={product.handle} locale={locale} vistas={vistas} />

      {/* "Vendido por" va en las pestañas de abajo (borrador aprobado, 23 nov 2026) */}

      {/* Publicidad (talleres, proveedores, marcas): se compra en /anunciate */}
      <AnunciosEspacio espacio="ficha_producto" titulo="Patrocinado" invitar />
    </div>
  )
}

// Lo que se lee DESPUÉS de decidir: descripción, medidas, envío y etiquetas.
export const ProductDetallesLargos = ({
  product,
  locale,
  taller,
  vendido,
}: {
  product: Props["product"]
  locale: string
  taller?: { name?: string | null; handle?: string | null }
  /** Tarjeta del vendedor, para la pestaña "Vendido por" */
  vendido?: React.ReactNode
}) => {
  // Sin lo que quedó vacío de la plantilla de publicar ("Qué incluye: --")
  const descripcion = limpiarDescripcion(product?.description)
  const tipo = tipoFicha(product as any)
  // Abajo, a todo lo ancho y en pestañas (pedido de Vlado, 22 nov 2026):
  // Descripción · Especificaciones · Qué incluye · Entrega y garantía. Una
  // pestaña sin datos no se muestra.
  const { incluye, noIncluye } = incluyeDe(product as never)
  const pestanas = [
    {
      clave: "descripcion",
      titulo: "Descripción",
      contenido: (
        <div className="flex flex-col gap-4">
          <LoMasImportante descripcion={descripcion} />
          <PuntosDestacados product={product} locale={locale} taller={taller} atributos={product?.attribute_values || []} />
          {tipo === "servicio" && <FichaServicio metadata={product?.metadata} />}
          {tipo === "digital" && <FichaDigital metadata={product?.metadata} />}
          <ProductPageDetails details={descripcion} />
        </div>
      ),
    },
    especificaciones(product as never).length > 0 && {
      clave: "especificaciones",
      titulo: "Especificaciones",
      contenido: <EspecificacionesFicha product={product as never} />,
    },
    (incluye.length > 0 || noIncluye.length > 0) && {
      clave: "incluye",
      titulo: "Qué incluye",
      contenido: <IncluyeFicha product={product as never} />,
    },
    tipo === "fisico" && {
      clave: "entrega",
      titulo: "Entrega y garantía",
      contenido: (
        <div className="flex flex-col gap-4">
          <EntregaGarantia product={product as never} />
          <ProductDetailsShipping />
        </div>
      ),
    },
    Boolean(vendido) && { clave: "vendedor", titulo: "Vendido por", contenido: vendido },
  ].filter(Boolean) as { clave: string; titulo: string; contenido: React.ReactNode }[]
  return (
    <div className="flex flex-col gap-4">
      <Pestanas pestanas={pestanas} etiqueta="Detalles del producto" />
      <ProductDetailsFooter tags={product?.tags || []} posted={product?.created_at} />
    </div>
  )
}
