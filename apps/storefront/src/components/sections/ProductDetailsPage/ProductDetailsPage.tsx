import { TS } from "@/i18n/TS"
import { ProductGallery } from "@/components/organisms/ProductGallery/ProductGallery"
import { ProductDetails, ProductDetallesLargos } from "@/components/organisms/ProductDetails/ProductDetails"
import { listProducts } from "@/lib/data/products"
import { listOffers } from "@/lib/data/offers"
import TalleresPlano from "@/components/hetna/planos/TalleresPlano"
import { variantesPlano } from "@/lib/planos/tienda"
import { getBuyboxWinner, getOfferAmount, getOfferStock, rankOffers, StoreOffer } from "@/lib/helpers/buybox"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { TrackEvent } from "@/components/analytics/TrackEvent"
import { JsonLd } from "@/components/hetna/JsonLd"
import { ResenasProducto } from "@/components/hetna/resenas/ResenasProducto"
import { resenasDeProducto, resenasPendientes } from "@/lib/resenas/acciones"
import { baseSitio, migas, productoSchema } from "@/lib/hetna/schema"
import { ProductosCompactos } from "@/components/hetna/ProductosCompactos"
import { FichaProducto } from "@/components/hetna/FichaProducto"
import { notFound, permanentRedirect } from "next/navigation"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { productoExtra } from "@/lib/hetna/producto-extra"
import { VideoProducto } from "@/components/hetna/VenderMas"
import { esFichaDescarga } from "@/lib/hetna/tipo-ficha"
import { GaleriaDescarga } from "@/components/hetna/fichas/descarga/GaleriaDescarga"
import { AbajoDescarga, ModificarDiseno, vistasGaleria } from "@/components/hetna/fichas/descarga/FichaDescarga"
import { ProductDetailsSeller } from "@/components/cells/ProductDetailsSeller/ProductDetailsSeller"
import { AvisoImportacion } from "@/components/hetna/AvisoImportacion"
import { tipoFicha } from "@/lib/hetna/tipo-ficha"
import FabricarDiseno from "@/components/hetna/fichas/descarga/FabricarDiseno"
import AnunciosEspacio from "@/components/hetna/publicidad/AnunciosEspacio"
import { formatosDe } from "@/lib/hetna/formatos"
import { vistaPreviaDe } from "@/lib/hetna/ficha-tecnica"
import { campoDeDescripcion, medidasEnTexto, tipoProducto } from "@/lib/hetna/tipo-producto"
import { datosImpresion, esImpresionBajoPedido } from "@/lib/data/impresion"
import { ResumenImpresion, TalleresImpresion } from "@/components/hetna/impresion/TalleresImpresion"
import { TalleresCerca } from "@/components/hetna/taller/TalleresCerca"
import { listarTalleres, type Taller } from "@/lib/hetna/talleres"
import { PROCESOS, procesosDeProducto, tallerHace } from "@/lib/ubicacion/procesos"

/**
 * Lo mínimo que usa "Talleres que te lo hacen": nombre, ciudad, estado, lo que
 * ofrece, calificación y entrega. Va en el HTML de la ficha, así que nada de
 * CP, tarifas, máquinas ni galería (se arma campo por campo para que un campo
 * nuevo del perfil no se cuele).
 */
const tallerLigero = (t: Taller): Taller => ({
  id: t.id,
  handle: t.handle,
  nombre: t.nombre,
  logo: null,
  banner: null,
  fundador: false,
  embajador: false,
  verificado: t.verificado,
  empresaVerificada: false,
  certificaciones: [],
  capacidadLibre: null,
  perfil: {
    ciudad: t.perfil.ciudad,
    estado: t.perfil.estado,
    ofrece: t.perfil.ofrece,
    calificacion: t.perfil.calificacion,
    entrega: t.perfil.entrega,
    tarifas: {},
    servicios: [],
    capacidades: [],
    maquinas: [],
    materiales: [],
    acabados: [],
    galeria: [],
  },
})

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
    // Direcciones del sitio anterior o fichas renombradas: si hay un producto
    // con casi el mismo nombre, se manda ahí con 308 (el buscador pasa el
    // posicionamiento). Si no hay uno claramente igual, 404 honesto.
    const sucesor = await fichaParecida(handle, locale)
    if (sucesor) permanentRedirect(`/${locale}/products/${sucesor}`)
    notFound()
  }

  // Misma razón para el taller suspendido: antes renderizaba la pantalla de
  // "no encontrado" pero con estado 200.
  if (prod.seller?.store_status === "SUSPENDED") {
    notFound()
  }

  // Ofertas, reseñas y relacionados no dependen entre sí: se piden a la vez.
  // Antes iban uno tras otro y cada uno sumaba su espera a la de la ficha.
  const catPrincipal = (prod as { categories?: { id?: string; handle?: string }[] }).categories?.[0]
  const categoriaId = catPrincipal?.id
  const handlesTaller = (((prod as { seller?: { products?: unknown[] } }).seller?.products ?? []) as { id: string; handle?: string }[])
    .filter((p) => p.id !== prod.id && p.handle)
    .map((p) => p.handle as string)
    .slice(0, 8)
  const [{ offers }, resenas, pendientes, candidatos, extra, recientes, delTaller] = await Promise.all([
    listOffers({ productId: prod.id, countryCode: locale }),
    resenasDeProducto(prod.id),
    resenasPendientes(),
    // Se piden más de los que se enseñan para poder variar (ver variados())
    categoriaId
      ? listProducts({ countryCode: locale, category_id: categoriaId, queryParams: { limit: 40 } })
          .then(({ response }) => response.products.filter((p) => p.id !== prod.id))
          .catch(() => [])
      : Promise.resolve([]),
    // Visitas de la semana y el video de redes del producto (no frena la ficha: 2.5 s máximo y caché)
    productoExtra(prod.id),
    // Lo más nuevo de toda la tienda, para cerrar la ficha invitando a ver más
    listProducts({ countryCode: locale, queryParams: { limit: 16, order: "-created_at" } as never })
      .then(({ response }) => response.products)
      .catch(() => []),
    // "Más de este taller" con precio y foto (el taller trae sólo lo básico)
    handlesTaller.length
      ? listProducts({ countryCode: locale, queryParams: { handle: handlesTaller, limit: 8 } })
          .then(({ response }) => response.products)
          .catch(() => [])
      : Promise.resolve([]),
  ])
  // Similares variados: si una familia tiene muchos casi iguales (p. ej. 40
  // rodillos texturizadores que sólo cambian el dibujo), no llenan la fila.
  const relacionados = variados(candidatos, prod.title || "", 8)
  // Sin repetir lo que ya sale en "Más de este taller" o en los similares
  const yaMostrados = new Set([prod.id, ...relacionados.map((p) => p.id), ...delTaller.map((p) => p.id), ...((prod.seller?.products ?? []) as { id: string }[]).map((p) => p.id)])
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
  // Ficha universal: las reseñas sólo salen si existen (o si este cliente
  // tiene una pendiente de escribir). Un "Todavía no hay reseñas" no ayuda.
  const hayResenas = Boolean(resenas?.total || resenas?.resenas?.length || pendienteDeEste)

  // Diseño para descargar: galería con esquema, "Cómo funciona", pestañas y
  // preguntas (components/hetna/fichas/descarga). Sin existencias ni envíos.
  const descarga = esFichaDescarga(prod)
  // Tarjeta del vendedor: va en la pestaña "Vendido por" (borrador aprobado, 23 nov 2026)
  const vendido = vendedor ? <ProductDetailsSeller seller={vendedor as never} tipo={tipoFicha(prod as never)} /> : null
  const largosDescarga = descarga ? (
    <div className="flex flex-col gap-6">
      <AbajoDescarga product={prod as never} fotosCompradores={(resenas?.resenas || []).flatMap((r) => r.fotos || [])} vendido={vendido} />
      {hayResenas && <ResenasProducto datos={resenas} productId={prod.id} pendiente={pendienteDeEste} />}
    </div>
  ) : null

  // "Fabrícalo con un taller" en todos los productos, menos los servicios
  // (pedido de Vlado, 22 nov 2026). Va debajo de las fotos.
  const tipoProd = tipoProducto(prod as never)
  const metaProd = (prod.metadata || {}) as Record<string, unknown>
  const textoMeta = (v: unknown) => (typeof v === "string" ? v : "")
  const medidasProd =
    textoMeta(metaProd.medidas) ||
    textoMeta(metaProd.medida_principal) ||
    campoDeDescripcion(textoMeta(metaProd.descripcion_es) || prod.description, /^medidas?$/i) ||
    // muchas fichas sólo traen la medida en el nombre ("Celosía 600x600 mm")
    medidasEnTexto(prod.title) ||
    undefined
  // Material para "Fabrícalo": el de la ficha o, si no, lo que diga el nombre ("Tabla de pino…")
  const materialProd = [textoMeta(metaProd.material), campoDeDescripcion(textoMeta(metaProd.descripcion_es) || prod.description, /^material(es)?$/i), prod.title].filter(Boolean).join(" ")
  const procesoSugerido =
    tipoProd === "tallado" ? "router" : tipoProd === "corte" ? "laser_co2" : undefined
  // Impresión 3D bajo pedido: en vez de "Fabrícalo", los talleres que ya lo
  // imprimen (cada uno con su oferta) y la liga para bajarlo gratis.
  const impresion = esImpresionBajoPedido(prod.metadata) ? await datosImpresion(prod.id) : null
  // (va en la columna de compra, en lugar de los botones genéricos: así el
  // destacado sale primero donde se compra y el color viaja al carrito)
  // 25 nov 2026 (Vlado): la lista de talleres va debajo de las fotos (sin
  // huecos); en la columna de compra queda el resumen y la descarga gratis.
  // Galería con miniaturas de vista 3D / esquema: diseños digitales y piezas
  // de Impresión 3D (su STL va en vista_previa). Los demás físicos, la normal.
  // (sólo si ya trae su STL: antes de volver a sembrar, la galería normal con zoom)
  const galeriaConVistas = !!descarga || (!!impresion && !!vistaPreviaDe(prod.metadata))
  const compraImpresion = impresion ? (
    <ResumenImpresion datos={impresion} herramienta={textoMeta(metaProd.herramienta_url) || null} />
  ) : null
  // Productos de la Biblioteca de planos: las ofertas de los talleres ("Taller X te lo fabrica en $Y")
  const planoSlug = metaProd.origen === "plano" ? textoMeta(metaProd.plano_slug) : ""
  // "Talleres que te lo hacen" (25 nov 2026, Vlado): en los productos que se
  // fabrican, los talleres con ese proceso (celosía → láser, router o plasma…).
  // La lista va completa y el navegador la ordena por cercanía al cliente: la
  // ficha está en caché y no puede llevar la ubicación de quien la ve.
  const procesosProd = impresion || planoSlug || tipoProd === "servicio" ? [] : procesosDeProducto(prod as never)
  const talleresQueLoHacen = procesosProd.length
    ? (await listarTalleres().catch(() => [] as Taller[])).filter((t) => t.id !== vendedor?.id && tallerHace(t, procesosProd)).slice(0, 300).map(tallerLigero)
    : []
  const queryCotizar = new URLSearchParams({
    ...(procesosProd[0] ? { servicio: PROCESOS[procesosProd[0]].cotizar } : {}),
    descripcion: `fabricar "${prod.title || "este producto"}"${prod.handle ? ` (${baseSitio()}/${locale}/products/${prod.handle})` : ""}`,
  }).toString()
  // Impresión 3D (28 nov 2026, Vlado): además de los talleres que ya lo
  // imprimen, "Fabrícalo a tu medida" para pedirlo de otro tamaño o cantidad
  const medidasImpresion = (() => {
    const m = (metaProd.impresion as { medidas_mm?: unknown } | undefined)?.medidas_mm
    return Array.isArray(m) && m.length === 3 && m.every((x) => Number(x) > 0) ? `${m.map((x) => Math.round(Number(x))).join(" × ")} mm` : medidasProd
  })()
  const fabricar = impresion ? (
    <>
      <TalleresImpresion datos={impresion} locale={locale} />
      <FabricarDiseno
        titulo={prod.title || "Producto"}
        handle={prod.handle}
        formatos={["STL"]}
        medidas={medidasImpresion}
        vistaPrevia={vistaPreviaDe(prod.metadata)}
        procesoInicial="impresora_3d"
        encabezado="Fabrícalo a tu medida"
      />
    </>
  ) : planoSlug ? (
    <TalleresPlano
      offers={offers as StoreOffer[]}
      variantes={variantesPlano(prod as never)}
      locale={locale}
      slug={planoSlug}
    />
  ) : tipoProd === "servicio" ? null : (
    <>
      <FabricarDiseno
        titulo={prod.title || "Producto"}
        handle={prod.handle}
        formatos={descarga ? formatosDe(prod as never) : []}
        medidas={medidasProd}
        vistaPrevia={descarga ? vistaPreviaDe(prod.metadata) : null}
        fisico={!descarga}
        procesoInicial={(procesosProd[0] && PROCESOS[procesosProd[0]].estimador) || procesoSugerido}
        materialInicial={materialProd}
      />
      {talleresQueLoHacen.length > 0 && (
        <TalleresCerca talleres={talleresQueLoHacen} query={queryCotizar} procesos={procesosProd} limite={4} />
      )}
    </>
    )

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

  // Lista de productos que va justo después de foto + compra, a TODO lo ancho
  // (Vlado, 25 nov 2026: en la columna de la foto dejaba espacio libre a la
  // derecha). "Más de este taller"; si el taller no tiene más, los similares.
  const listaLateral = delTaller.length
    ? {
        clave: "taller" as const,
        titulo: vendedor?.name ? `Más de ${vendedor.name}` : "Más de este taller",
        productos: delTaller.slice(0, 8),
        verTodos: vendedor?.handle ? `/sellers/${vendedor.handle}` : null,
      }
    : relacionados.length
      ? {
          clave: "similares" as const,
          titulo: descarga ? "Otros diseños" : "Productos similares",
          productos: relacionados.slice(0, 8),
          verTodos: catPrincipal?.handle ? `/categories/${catPrincipal.handle}` : "/categories",
        }
      : null

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
      {/* Opción A (elegida por Vlado, 22 nov 2026): toda la ficha centrada en
          1280 px, con el mismo margen a los dos lados. En pantallas de 1920 px
          ya no queda un hueco grande sólo a la derecha. */}
      <div className="mx-auto w-full max-w-[1280px]" data-testid="product-ficha-centrada">
      {/* Migas de pan visibles (antes sólo iban en los datos para Google) */}
      <nav aria-label="Migas de pan" className="mb-3 text-[13px] text-[#6B6A63]" data-testid="product-migas">
        <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
          <li>
            <LocalizedClientLink href="/" className="hover:text-[#B34D07] hover:underline"><TS>Inicio</TS></LocalizedClientLink>
          </li>
          {categoria?.name && categoria?.handle && (
            <li className="flex items-center gap-1">
              <span aria-hidden="true">›</span>
              <LocalizedClientLink href={`/categories/${categoria.handle}`} className="hover:text-[#B34D07] hover:underline">
                <TS>{categoria.name}</TS>
              </LocalizedClientLink>
            </li>
          )}
          <li className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true">›</span>
            <span aria-current="page" className="truncate text-[#1B1B18]"><TS>{prod.title}</TS></span>
          </li>
        </ol>
      </nav>
      <div
        // Borrador aprobado por Vlado (23 nov 2026): a la izquierda las fotos,
        // "Fabrícalo" (corto) y, en diseños, "¿Lo quieres ya fabricado?"; a la
        // derecha la compra, sin licencia ni "Vendido por" (van en pestañas).
        // Abajo, a todo lo ancho, las pestañas. En celular el orden es fotos →
        // compra → Fabrícalo → pestañas.
        // Opción C (Vlado, 25 nov 2026, "que no haya espacios libres"; la A
        // no le gustó): debajo de la foto, talleres/Fabrícalo, productos en
        // tarjetas chicas ("Más de este taller" o similares) y el anuncio, para
        // llenar el lado izquierdo mientras sigue la columna de compra. Las
        // pestañas vuelven abajo a todo lo ancho.
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr_auto_auto] lg:items-stretch lg:gap-x-10 lg:gap-y-4 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]"
        data-testid="product-details-page"
      >
        <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1" data-testid="product-gallery-container">
          {galeriaConVistas ? (
            <GaleriaDescarga
              vistas={vistasGaleria(prod as never)}
              titulo={prod.title}
              digital={!!descarga}
              // las fotos de Impresión 3D salen a colores: el color real lo da el taller que elijas
              nota={impresion ? "Colores de ejemplo: el material y el color los eliges con el taller." : undefined}
            />
          ) : (
            <ProductGallery images={prod?.images || []} title={prod.title} />
          )}
        </div>

        <div className="order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1" data-testid="product-details-container">
          <div className="max-w-[680px]">
            {/* Proveedor extranjero: de dónde viene, cuánto tarda e impuestos incluidos */}
            {!descarga && <AvisoImportacion handle={vendedor?.handle} />}
            <ProductDetails
              product={prod}
              locale={locale}
              offers={offers as StoreOffer[]}
              vistas={extra.vistas_7d}
              compraPropia={compraImpresion}
            />
          </div>
        </div>

        <div className="order-3 flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2 lg:self-start">
            <TS>{fabricar}</TS>
            {/* Diseños: pedir una modificación o cotizar la fabricación */}
            {descarga && <ModificarDiseno product={prod as never} vendedor={vendedor ? { handle: vendedor.handle, name: vendedor.name } : null} />}
            {/* Publicidad en el hueco de la izquierda (solo computadora: en
                celular ya sale la de "Patrocinado" en la columna de compra) */}
            <AnunciosEspacio
              espacio="ficha_lateral"
              titulo="Patrocinado"
              invitar
              frase="¿Vendes material, fresas o máquinas? Anúncialo aquí"
              className="hidden lg:block"
            />
        </div>

        {/* Productos a todo lo ancho, después de foto + compra (8 por fila) */}
        {listaLateral && (
          <div className="order-4 min-w-0 lg:col-span-2 lg:row-start-3">
            <ProductosCompactos titulo={listaLateral.titulo} productos={listaLateral.productos as never} verTodos={listaLateral.verTodos} />
          </div>
        )}

        {/* Ficha larga a todo lo ancho, en pestañas */}
        <div className="order-5 min-w-0 lg:col-span-2 lg:row-start-4 lg:mt-2">
          <TS>{largosDescarga}</TS>
          {!descarga && <ProductDetallesLargos
            product={prod}
            locale={locale}
            taller={{ name: vendedor?.name, handle: vendedor?.handle }}
            vendido={vendido}
          />}
          {!descarga && hayResenas && <div className="mt-4">
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
      {/* Tarjetas chicas (ProductosCompactos), no el carrusel de 4 fotos enormes */}
      {/* La lista que ya salió arriba (después de foto + compra) no se repite */}
      {delTaller.length > 0 && listaLateral?.clave !== "taller" && (
        <div className="mt-8">
          <ProductosCompactos
            titulo={vendedor?.name ? `Más de ${vendedor.name}` : "Más de este taller"}
            productos={delTaller as never}
            verTodos={vendedor?.handle ? `/sellers/${vendedor.handle}` : null}
          />
        </div>
      )}

      {relacionados.length > 0 && listaLateral?.clave !== "similares" && (
        <div className="mt-4">
          <ProductosCompactos
            titulo={descarga ? "Otros diseños" : "Productos similares"}
            productos={relacionados as never}
            verTodos={catPrincipal?.handle ? `/categories/${catPrincipal.handle}` : "/categories"}
          />
        </div>
      )}

      {/* Al final de la ficha: más productos para seguir viendo */}
      {masProductos.length > 0 && (
        <div className="mt-4">
          <ProductosCompactos titulo="Descubre más productos" productos={masProductos as never} />
        </div>
      )}
      </div>
    </>
  )
}

// Familia de un producto: sus dos primeras palabras ("Rodillo texturizador",
// "Cortador galletas"). Sirve para que los similares no sean todos iguales.
const familia = (titulo: string) =>
  titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !VACIAS.has(w))
    .slice(0, 2)
    .join(" ")

/** Hasta `n` productos alternando familias: como mucho 2 de la misma familia
 *  que la ficha y 2 de cada otra; si no alcanza, se completa con los que sobren. */
function variados<T extends { id: string; title?: string | null }>(lista: T[], tituloFicha: string, n: number): T[] {
  const propia = familia(tituloFicha)
  const cuenta = new Map<string, number>()
  const elegidos: T[] = []
  const sobran: T[] = []
  for (const p of lista) {
    const f = familia(p.title || "")
    const tope = 2
    if ((cuenta.get(f) ?? 0) < tope && elegidos.length < n) {
      elegidos.push(p)
      cuenta.set(f, (cuenta.get(f) ?? 0) + 1)
    } else sobran.push(p)
  }
  // Primero los de otras familias, al final los de la misma de la ficha
  elegidos.sort((a, b) => Number(familia(a.title || "") === propia) - Number(familia(b.title || "") === propia))
  return [...elegidos, ...sobran].slice(0, n)
}

// Palabras del handle que sirven para comparar (sin "de", "para", números sueltos…)
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "para", "con", "y", "en", "a", "un", "una", "por", "pieza", "gratis"])
const palabras = (h: string) =>
  new Set(
    decodeURIComponent(h)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !VACIAS.has(w) && !/^\d+$/.test(w))
  )

/** Handle de un producto actual casi igual al pedido, o null. */
async function fichaParecida(handle: string, locale: string): Promise<string | null> {
  const buscadas = palabras(handle)
  if (buscadas.size < 2) return null
  try {
    const { response } = await listProducts({
      countryCode: locale,
      queryParams: { q: [...buscadas].slice(0, 6).join(" "), limit: 10 } as never,
    })
    let mejor: { handle: string; parecido: number } | null = null
    for (const p of response.products) {
      if (!p.handle) continue
      const suyas = palabras(p.handle)
      const comunes = [...buscadas].filter((w) => suyas.has(w)).length
      // Jaccard: comunes / todas las distintas de los dos
      const parecido = comunes / new Set([...buscadas, ...suyas]).size
      if (!mejor || parecido > mejor.parecido) mejor = { handle: p.handle, parecido }
    }
    return mejor && mejor.parecido >= 0.6 ? mejor.handle : null
  } catch {
    return null
  }
}
