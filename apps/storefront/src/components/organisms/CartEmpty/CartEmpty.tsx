import { Button } from "@/components/atoms/Button/Button"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// Carrito vacío. No se queda en "está vacío": de aquí salen los tres caminos
// por los que alguien llega a comprar en HETNA, porque el que ve esta pantalla
// normalmente no sabe todavía qué busca.
export function CartEmpty() {
  return (
    <div className="col-span-12 flex justify-center py-12" data-testid="cart-empty">
      <div className="flex w-full max-w-[520px] flex-col text-center">
        <h1 className="text-[24px] font-bold text-[#1B1B18]">Tu carrito está vacío</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">
          Nada que pagar todavía. Puedes ver lo que venden los talleres, o empezar por
          tu propia pieza.
        </p>

        <LocalizedClientLink href="/categories" className="mt-6">
          <Button className="flex w-full items-center justify-center py-3">
            Ver productos
          </Button>
        </LocalizedClientLink>

        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          <Atajo
            href="/herramientas-cnc"
            titulo="Herramientas CNC"
            texto="DXF a G-code, CAM en 3–5 ejes, generadores y plantillas, gratis."
          />
          <Atajo
            href="/cotizar"
            titulo="Cotizar una pieza"
            texto="Dinos material y medidas y te damos precio."
          />
        </div>
      </div>
    </div>
  )
}

const Atajo = ({
  href,
  titulo,
  texto,
}: {
  href: string
  titulo: string
  texto: string
}) => (
  <LocalizedClientLink
    href={href}
    className="rounded-[12px] border border-[#E7E4DC] bg-white p-4 hover:border-[#C2560A]"
  >
    <p className="text-[14px] font-bold text-[#1B1B18]">{titulo}</p>
    <p className="mt-1 text-[13px] leading-relaxed text-[#4A4943]">{texto}</p>
  </LocalizedClientLink>
)
