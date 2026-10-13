// Datos estructurados (Schema.org) para Google. Aquí se arman los "JSON-LD":
// un texto escondido en la página que le explica a Google qué es cada cosa
// (producto, precio, taller, migas de pan) para mostrarla mejor en los resultados.
//
// REGLA: solo se publica lo que es real. Nunca se inventan calificaciones ni reseñas.

import { EMPRESA } from "@/lib/hetna/empresa"
import { ubicacion, type Taller } from "@/lib/hetna/talleres"

export const baseSitio = () =>
  (process.env.NEXT_PUBLIC_BASE_URL || EMPRESA.sitio).replace(/\/$/, "")

// Convierte el objeto a texto seguro para meterlo dentro de <script>
export const textoJsonLd = (datos: unknown) =>
  JSON.stringify(datos).replace(/</g, "\\u003c")

// ---------------------------------------------------------------------
// Migas de pan: Inicio > Categoría > Producto
// ---------------------------------------------------------------------
export type Miga = { nombre: string; ruta?: string } // ruta = dirección completa; la última puede ir sin ruta

export const migas = (items: Miga[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((m, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: m.nombre,
    ...(m.ruta ? { item: m.ruta } : {}),
  })),
})

// ---------------------------------------------------------------------
// Producto + Oferta (precio, existencia, devoluciones, vendedor, especificaciones)
// ---------------------------------------------------------------------
type AtributoExtra = { value?: string | null; attribute?: { name?: string | null } | null }

export type EntradaProducto = {
  producto: {
    id: string
    handle?: string | null
    title: string
    description?: string | null
    material?: string | null
    images?: { url: string }[] | null
    thumbnail?: string | null
    metadata?: Record<string, unknown> | null
    variants?: { sku?: string | null }[] | null
    categories?: { name?: string | null }[] | null
    attribute_values?: AtributoExtra[] | null
  }
  locale: string
  precio: number
  moneda: string
  hayExistencia: boolean
  vendedor?: { nombre?: string | null; handle?: string | null }
}

export const productoSchema = ({ producto: p, locale, precio, moneda, hayExistencia, vendedor }: EntradaProducto) => {
  const base = baseSitio()
  const url = `${base}/${locale}/products/${p.handle}`

  // Especificaciones técnicas: los atributos que el taller capturó en el producto
  const especificaciones = (p.attribute_values || [])
    .filter((a) => a?.attribute?.name && a?.value)
    .slice(0, 30)
    .map((a) => ({ "@type": "PropertyValue", name: String(a.attribute!.name), value: String(a.value) }))

  const marcaMeta = p.metadata?.marca ?? p.metadata?.brand
  const marca = typeof marcaMeta === "string" && marcaMeta.trim() ? marcaMeta.trim() : vendedor?.nombre || undefined

  const imagenes = (p.images || []).map((i) => i.url).filter(Boolean)
  if (!imagenes.length && p.thumbnail) imagenes.push(p.thumbnail)

  // Vigencia del precio: un año (Google lo recomienda)
  const vigencia = new Date()
  vigencia.setFullYear(vigencia.getFullYear() + 1)

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#producto`,
    name: p.title,
    description: (p.description || p.title).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000),
    url,
    image: imagenes,
    sku: p.variants?.[0]?.sku || p.id,
    ...(marca ? { brand: { "@type": "Brand", name: marca } } : {}),
    ...(p.material ? { material: p.material } : {}),
    ...(p.categories?.[0]?.name ? { category: p.categories[0].name } : {}),
    ...(especificaciones.length ? { additionalProperty: especificaciones } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: moneda.toUpperCase(),
      price: precio ?? 0,
      priceValidUntil: vigencia.toISOString().slice(0, 10),
      availability: hayExistencia ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(vendedor?.nombre
        ? {
            seller: {
              "@type": "Organization",
              name: vendedor.nombre,
              ...(vendedor.handle ? { url: `${base}/${locale}/talleres/${vendedor.handle}` } : {}),
            },
          }
        : {}),
      // Política de devoluciones (la misma que se publica en /devoluciones)
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "MX",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: Number(EMPRESA.diasDevolucion) || 5,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnShippingFees",
      },
    },
  }
}

// ---------------------------------------------------------------------
// Taller como negocio local
// ---------------------------------------------------------------------
export const negocioLocalSchema = (t: Taller, locale: string) => {
  const base = baseSitio()
  const url = `${base}/${locale}/talleres/${t.handle}`
  const p = t.perfil
  const imagenes = [t.banner, t.logo, ...p.galeria.slice(0, 5)].filter((x): x is string => Boolean(x))
  const descripcion = (t.descripcion || p.lema || "").replace(/\s+/g, " ").trim().slice(0, 300)
  // Calificación: solo si el taller tiene reseñas reales registradas
  const conResenas = p.calificacion !== undefined && (p.resenas ?? 0) > 0

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#taller`,
    name: t.nombre,
    url,
    ...(descripcion ? { description: descripcion } : {}),
    ...(imagenes.length ? { image: imagenes } : {}),
    ...(t.logo ? { logo: t.logo } : {}),
    address: {
      "@type": "PostalAddress",
      ...(p.ciudad ? { addressLocality: p.ciudad } : {}),
      ...(p.estado ? { addressRegion: p.estado } : {}),
      addressCountry: "MX",
    },
    areaServed: { "@type": "Country", name: "México" },
    ...(p.servicios.length || p.materiales.length ? { knowsAbout: [...p.servicios, ...p.materiales].slice(0, 25) } : {}),
    ...(conResenas
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.calificacion, reviewCount: p.resenas } }
      : {}),
    // La ubicación en texto sirve para que Google asocie el taller con su ciudad
    ...(ubicacion(p) ? { slogan: p.lema || undefined } : {}),
  }
}
