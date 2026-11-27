import { TS } from "@/i18n/TS"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA } from "@/lib/hetna/empresa"
import { AdditionalAttributeProps } from "@/types/product"
import { HttpTypes } from "@medusajs/types"
import { tipoFicha } from "@/lib/hetna/tipo-ficha"
import { nombreLicencia } from "@/lib/hetna/licencias"

// Lo que de verdad decide la compra, en cuatro renglones arriba de todo.
//
// Son los mismos datos que ya estaban regados por la ficha -- el taller, si es
// archivo o pieza física, la categoría, el plazo de devolución -- pero juntos y
// con un icono cada uno, para no obligar a leer tres acordeones antes de saber
// qué se está comprando. Lo que no se puede sacar de los datos reales, no sale:
// aquí no hay ningún renglón de adorno.
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
  // Misma regla que el resto de la ficha (lib/hetna/tipo-ficha)
  const tipo = tipoFicha(product as any)
  const digital = tipo === "digital"
  const servicio = tipo === "servicio"
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
          <TS>Hecho y vendido por</TS><TS>{" "}</TS>
          {taller.handle ? (
            <a
              href={`/${locale}/sellers/${taller.handle}`}
              className="font-semibold text-[#B34D07] hover:underline"
            >
              <TS>{taller.name}</TS>
            </a>
          ) : (
            <span className="font-semibold"><TS>{taller.name}</TS></span>
          )}
        </>
      ),
    })
  }

  puntos.push(
    servicio
      ? {
          icono: "🧑‍💻",
          texto: (
            <>
              <span className="font-semibold"><TS>Servicio en línea.</TS></span> <TS>No te llega nada por
              paquetería: recibes tus archivos en tu cuenta.</TS>
            </>
          ),
        }
      : digital
      ? {
          icono: "⬇️",
          texto: (
            <>
              <span className="font-semibold"><TS>Descarga digital.</TS></span> <TS>No te llega nada
              por paquetería: el archivo se descarga al confirmarse el pago.</TS>
            </>
          ),
        }
      : {
          icono: "📦",
          texto: (
            <>
              <span className="font-semibold"><TS>Envío a todo México.</TS></span> <TS>El costo y los
              días los ves antes de pagar.</TS>
            </>
          ),
        }
  )

  // Licencia de diseños (lib/hetna/licencias): qué puedes hacer con el archivo
  if (digital) {
    puntos.push({
      icono: "📜",
      texto: (
        <>
          <TS>Licencia:</TS> <span className="font-semibold">{nombreLicencia(product.metadata)}</span>.<TS>{" "}</TS>
          <LocalizedClientLink href="/licencias-disenos" className="font-semibold text-[#B34D07] underline">
            <TS>Qué incluye</TS>
          </LocalizedClientLink>
        </>
      ),
    })
  }

  if (material) {
    puntos.push({ icono: "🪵", texto: <><TS>Material:</TS> <span className="font-semibold"><TS>{material}</TS></span></> })
  } else if (categoria?.name) {
    puntos.push({
      icono: "🏷️",
      texto: (
        <>
          <TS>Categoría:</TS><TS>{" "}</TS>
          {categoria.handle ? (
            <LocalizedClientLink
              href={`/categories/${categoria.handle}`}
              className="font-semibold text-[#B34D07] hover:underline"
            >
              <TS>{categoria.name}</TS>
            </LocalizedClientLink>
          ) : (
            <span className="font-semibold"><TS>{categoria.name}</TS></span>
          )}
        </>
      ),
    })
  }

  puntos.push({
    icono: "↩️",
    texto: servicio ? (
      <>
        <TS>Si lo que entregamos no corresponde a lo acordado, lo corregimos.</TS><TS>{" "}</TS>
        <LocalizedClientLink href="/devoluciones" className="font-semibold text-[#B34D07] underline">
          <TS>Ver política</TS>
        </LocalizedClientLink>
      </>
    ) : digital ? (
      <>
        <TS>Los archivos no tienen devolución una vez descargados, salvo que estén dañados o
        no correspondan.</TS><TS>{" "}</TS>
        <LocalizedClientLink href="/devoluciones" className="font-semibold text-[#B34D07] underline">
          <TS>Ver política</TS>
        </LocalizedClientLink>
      </>
    ) : (
      <>
        <span className="font-semibold"><TS>{EMPRESA.diasDevolucion}</TS> <TS>días naturales</TS></span> <TS>para
        devolver, sin uso y en su empaque.</TS><TS>{" "}</TS>
        <LocalizedClientLink href="/devoluciones" className="font-semibold text-[#B34D07] underline">
          <TS>Ver política</TS>
        </LocalizedClientLink>
      </>
    ),
  })

  return (
    <section className="rounded-[14px] border border-[#E7E4DC] bg-white p-4" data-testid="product-highlights">
      <h2 className="text-[15px] font-bold text-[#1B1B18]"><TS>Puntos destacados</TS></h2>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {puntos.map((p, n) => (
          <li key={n} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[#4A4943]">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF3EC] text-[14px]"
            >
              {p.icono}
            </span>
            <span className="min-w-0 pt-0.5"><TS>{p.texto}</TS></span>
          </li>
        ))}
      </ul>
    </section>
  )
}
