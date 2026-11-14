import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA } from "@/lib/hetna/empresa"

// Cuando una categoría o una búsqueda no tiene productos (auditoría de mejoras,
// tarea 1: catálogo honesto). Nunca una página en blanco: se dice claro que no
// hay stock publicado y se ofrece cotizarlo, por la web o por WhatsApp, más
// las categorías que sí tienen productos.
type Props = {
  /** Lo que se buscó, para el mensaje de WhatsApp */
  busqueda?: string
  /** Categorías con productos (las arma el servidor con lib/hetna/catalogo) */
  sugerencias?: { nombre: string; handle: string }[]
}

// Si no llegan sugerencias (listado del lado del navegador), estas siempre existen
const SIEMPRE = [
  { nombre: "Diseños DXF y STL desde $30", href: "/categories" },
  { nombre: "Fabricación a la medida", href: "/fabricacion" },
]

const ProductListingNoResultsView = ({ busqueda, sugerencias }: Props) => {
  const texto = busqueda
    ? `Hola HETNA CNC, busco "${busqueda}" y no lo encontré en la tienda. ¿Me lo pueden cotizar?`
    : "Hola HETNA CNC, busco un producto que no encontré en la tienda. ¿Me lo pueden cotizar?"
  const enlaces = sugerencias?.length
    ? sugerencias.map((s) => ({ nombre: s.nombre, href: `/categories/${s.handle}` }))
    : SIEMPRE
  return (
    <div
      className="my-10 w-full rounded-2xl border border-[#E7E4DC] bg-white px-6 py-10 text-center"
      data-testid="product-listing-no-results-view"
    >
      <h2 className="text-2xl font-extrabold text-[#142033]">No hay stock publicado</h2>
      <p className="mx-auto mt-3 max-w-xl text-[15px] text-[#6B675C]">
        {busqueda ? (
          <>
            Todavía no hay productos para “{busqueda}”. Pídelo y te lo cotizamos con talleres y proveedores de todo México.
          </>
        ) : (
          <>Pídelo y te lo cotizamos con talleres y proveedores de todo México.</>
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <LocalizedClientLink
          href="/cotizar"
          className="rounded-xl bg-[#C2560A] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
        >
          Pedir cotización
        </LocalizedClientLink>
        <a
          href={`https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-[#1F9D55] px-5 py-3 text-sm font-semibold text-[#17803F] hover:bg-[#1F9D55] hover:text-white"
        >
          Pedir por WhatsApp
        </a>
      </div>
      <div className="mt-8">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#8A887F]">Lo que sí tenemos</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {enlaces.map((e) => (
            <LocalizedClientLink
              key={e.href}
              href={e.href}
              className="rounded-full border border-[#E7E4DC] bg-[#FAF6EF] px-4 py-2 text-[14px] font-semibold text-[#142033] hover:border-[#C2560A]"
            >
              {e.nombre}
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProductListingNoResultsView
