import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { convertToLocale } from "@/lib/helpers/money"

// Pie del grupo de un taller: lo que suman sus productos y qué pasa con el
// envío.
//
// Antes aquí se imprimía el envío de TODO el carrito, una vez por cada taller:
// con dos talleres el mismo costo aparecía dos veces y parecía el doble. Y el
// costo real no existe todavía, porque se calcula con la dirección de entrega.
// Decirlo así, en lugar de inventar un número o un "envío gratis", es lo único
// honesto que se puede poner en esta línea.
export const CartItemsFooter = ({
  currency_code,
  subtotal,
  envio,
  // Cuando debajo va la barra de envío gratis, la esquina redondeada le toca a
  // ella: dos bloques pegados con la de arriba redondeada se ven partidos.
  ultimo = true,
}: {
  currency_code: string
  subtotal: number
  envio?: number | null
  ultimo?: boolean
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-t-0 border-[#E7E4DC] bg-white px-3 py-3 sm:px-4 ${
        ultimo ? "rounded-b-[12px]" : ""
      }`}
    >
      <p className="text-[12px] text-[#6B6A63]">
        {typeof envio === "number" ? (
          <>
            Envío de este taller:{" "}
            <span className="font-semibold text-[#1B1B18]">
              {envio === 0
                ? "sin costo"
                : convertToLocale({ amount: envio, currency_code })}
            </span>
          </>
        ) : (
          <>
            El envío de este taller se calcula con tu dirección.{" "}
            <LocalizedClientLink
              href="/formas-de-pago"
              className="font-medium text-[#B34D07] underline"
            >
              Cómo se cobra
            </LocalizedClientLink>
          </>
        )}
      </p>
      <p className="text-[13px] text-[#4A4943]">
        Subtotal del taller:{" "}
        <span className="text-[15px] font-bold text-[#1B1B18]">
          {convertToLocale({ amount: subtotal, currency_code })}
        </span>
      </p>
    </div>
  )
}
