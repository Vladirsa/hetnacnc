// Rejilla compacta de productos: tarjetas chicas (foto cuadrada, nombre y
// precio) para la ficha: "Más de este taller", "Productos similares" y
// "Descubre más productos". Caben de 3 en celular a 8 por fila en computadora,
// para invitar a seguir viendo sin que las fotos ocupen toda la pantalla
// (antes las dos primeras eran un carrusel de 4 fotos enormes).
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import Image from "@/lib/imagenes/Imagen"

type ProductoCompacto = {
  id: string
  handle?: string | null
  title?: string | null
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
}

export function ProductosCompactos({
  titulo,
  productos,
  verTodos = "/categories",
}: {
  titulo: string
  productos: ProductoCompacto[]
  /** Liga de "Ver todos" (la categoría, el taller…); null = sin liga. */
  verTodos?: string | null
}) {
  if (!productos.length) return null
  // Un id distinto por sección (puede haber varias en la misma ficha)
  const idTitulo = `titulo-${titulo.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
  return (
    <section className="w-full py-6" aria-labelledby={idTitulo}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={idTitulo} className="heading-md font-bold uppercase tracking-tight">
          {titulo}
        </h2>
        {verTodos && (
          <LocalizedClientLink href={verTodos} className="shrink-0 text-[13.5px] font-bold text-[#B34D07] hover:underline">
            Ver todos →
          </LocalizedClientLink>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 sm:gap-3">
        {productos.map((p) => {
          let precio: string | null = null
          try {
            const { cheapestPrice } = getProductPrice({ product: p as never })
            precio = cheapestPrice?.calculated_price ?? null
          } catch {
            precio = null
          }
          const gratis = p.metadata?.archivo_gratis === true
          return (
            <li key={p.id}>
              <LocalizedClientLink
                href={`/products/${p.handle}`}
                className="group block overflow-hidden rounded-[10px] border border-[#E7E4DC] bg-white hover:border-[#C2560A]"
              >
                <div className="relative aspect-square w-full bg-[#FAF9F6]">
                  {p.thumbnail ? (
                    <Image
                      src={p.thumbnail}
                      alt={p.title || "Producto"}
                      fill
                      sizes="(min-width: 1024px) 140px, (min-width: 768px) 16vw, 33vw"
                      className="object-cover transition-transform group-hover:scale-[1.03]"
                    />
                  ) : null}
                </div>
                <div className="p-1.5 sm:p-2">
                  <p className="line-clamp-2 min-h-[2.5em] text-[11.5px] leading-tight text-[#1B1B18] sm:text-[12.5px]">{p.title}</p>
                  {(gratis || precio) && (
                    <p className="mt-0.5 text-[12.5px] font-bold text-[#1B1B18] sm:text-[13.5px]">{gratis ? "Gratis" : precio}</p>
                  )}
                </div>
              </LocalizedClientLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
