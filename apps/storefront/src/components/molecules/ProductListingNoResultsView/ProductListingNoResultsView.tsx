import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// Vista cuando una categoría o búsqueda no tiene productos: en lugar de un "sin resultados" seco,
// ofrece pedir cotización (genera contacto) o vender en HETNA (atrae talleres).
const ProductListingNoResultsView = () => (
  <div
    className="my-10 w-full rounded-2xl border border-[#E7E4DC] bg-white px-6 py-10 text-center"
    data-testid="product-listing-no-results-view"
  >
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Muy pronto</p>
    <h2 className="mt-2 text-2xl font-extrabold text-[#142033]">Aún no hay productos aquí</h2>
    <p className="mx-auto mt-3 max-w-xl text-[15px] text-[#6B675C]">
      Estamos sumando talleres y productos todos los días. ¿Buscas algo en particular? Pídelo y te lo cotizamos con
      talleres de todo México.
    </p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      <LocalizedClientLink
        href="/cotizar"
        className="rounded-xl bg-[#C2560A] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
      >
        Pedir cotización
      </LocalizedClientLink>
      <LocalizedClientLink
        href="/talleres"
        className="rounded-xl border border-[#142033] px-5 py-3 text-sm font-semibold text-[#142033] hover:bg-[#142033] hover:text-white"
      >
        Ver talleres
      </LocalizedClientLink>
      <a
        href="/seller"
        className="rounded-xl px-5 py-3 text-sm font-semibold text-[#B34D07] underline-offset-4 hover:underline"
      >
        ¿Tienes un taller? Vende aquí
      </a>
    </div>
  </div>
)

export default ProductListingNoResultsView
