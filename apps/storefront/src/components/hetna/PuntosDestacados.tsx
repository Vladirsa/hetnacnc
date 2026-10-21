import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA } from "@/lib/hetna/empresa"
import { AdditionalAttributeProps } from "@/types/product"
import { HttpTypes } from "@medusajs/types"

// Lo que de verdad decide la compra, en cuatro renglones arriba de todo.
//
// Son los mismos datos que ya estaban regados por la ficha -- el taller, si es
// archivo o pieza física, la categoría, el plazo de devolución -- pero juntos y
// con un icono cada uno, para no obligar a leer tres acordeones antes de saber
// qué se está comprando. Lo que no se puede sacar de los datos reales, no sale:
// aquí no hay ningún renglón de adorno.
const esDigital = (
  product: HttpTypes.StoreProduct & { type?: { value?: string } | null }
): boolean => {
  const tipo = (product.type?.value || "").toLowerCase()
  if (tipo.includes("digital")) return true
  return (product.tags || []).some((t) =>
    (t.value || "").toLowerCase().includes("digital")
  )
}

export const PuntosDestacados = ({
  product,
  locale,
  taller,
  atributos = [],
}: {
  product: HttpTypes.StoreProduct & { type?: { value?: string } | null }
  locale: string
  taller?: { name?: string | null; handle?: string | null }
  atributos?: AdditionalAttributeProps[]
}) => {
  const digital = esDigital(product)
  const categoria = (
    product as { categories?: { name?: string | null; handle?: string | null }[] }
  ).categories?.[0]

  const material = atributos.find((a) =>
    (a?.attribute?.name || "").toLowerCase().includes("material")
  )?.value

  const puntos: { icono: string; texto: React.ReactNode }[] = []

  if (taller?.name) {
    puntos.push({
      icono: "🏭",
      texto: (
        <>
          Hecho y vendido por{" "}
          {taller.handle ? (
            <a
              href={`/${locale}/sellers/${taller.handle}`}
              className="font-semibold text-[#B34D07] hover:underline"
            >
              {taller.name}
            </a>
          ) : (
            <span className="font-semibold">{taller.name}</span>
          )}
        </>
      ),
    })
  }

  puntos.push(
    digital
      ? {
          icono: "⬇️",
          texto: (
            <>
              <span className="font-semibold">Descarga digital.</span> No te llega nada
              por paquetería: el archivo se descarga al confirmarse el pago.
            </>
          ),
        }
      : {
          icono: "📦",
          texto: (
            <>
              <span className="font-semibold">Envío a todo México.</span> El costo y los
              días los ves antes de pagar.
            </>
          ),
        }
  )

  if (material) {
    puntos.push({ icono: "🪵", texto: <>Material: <span className="font-semibold">{material}</span></> })
  } else if (categoria?.name) {
    puntos.push({
      icono: "🏷️",
      texto: (
        <>
          Categoría:{" "}
          {categoria.handle ? (
            <LocalizedClientLink
              href={`/categories/${categoria.handle}`}
              className="font-semibold text-[#B34D07] hover:underline"
            >
              {categoria.name}
            </LocalizedClientLink>
          ) : (
            <span className="font-semibold">{categoria.name}</span>
          )}
        </>
      ),
    })
  }

  puntos.push({
    icono: "↩️",
    texto: digital ? (
      <>
        Los archivos no tienen devolución una vez descargados, salvo que estén dañados o
        no correspondan.{" "}
        <LocalizedClientLink href="/devoluciones" className="font-semibold text-[#B34D07] underline">
          Ver política
        </LocalizedClientLink>
      </>
    ) : (
      <>
        <span className="font-semibold">{EMPRESA.diasDevolucion} días hábiles</span> para
        devolver, sin uso y en su empaque.{" "}
        <LocalizedClientLink href="/devoluciones" className="font-semibold text-[#B34D07] underline">
          Ver política
        </LocalizedClientLink>
      </>
    ),
  })

  return (
    <section className="rounded-[14px] border border-[#E7E4DC] bg-white p-4" data-testid="product-highlights">
      <h2 className="text-[15px] font-bold text-[#1B1B18]">Puntos destacados</h2>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {puntos.map((p, n) => (
          <li key={n} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[#4A4943]">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF3EC] text-[14px]"
            >
              {p.icono}
            </span>
            <span className="min-w-0 pt-0.5">{p.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
