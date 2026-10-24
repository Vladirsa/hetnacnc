import { convertToLocale } from "@/lib/helpers/money"
import type { Escalon } from "@/lib/helpers/volumen"

// Los precios por cantidad de un taller, en la ficha.
//
// Se enseña la tabla completa y no sólo el primer escalón porque aquí el
// cliente está decidiendo cuántas piezas pedir, y ver "3+ → $450, 10+ → $420"
// es justo lo que lo hace subir de 2 a 3. En la tarjeta no cabe y ahí va sólo
// el primero.
export const EscalonesVolumen = ({
  escalones,
  precioUnitario,
}: {
  escalones: Escalon[]
  precioUnitario?: number | null
}) => {
  if (!escalones.length) return null

  const moneda = escalones[0].moneda
  const dinero = (amount: number) =>
    convertToLocale({ amount, currency_code: moneda })

  return (
    <div className="rounded-[10px] border border-[#D9C9A8] bg-[#FFFBF2] p-3">
      <p className="text-[12.5px] font-bold text-[#7A4A09]">
        Más piezas, menos precio
      </p>

      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {typeof precioUnitario === "number" && precioUnitario > 0 && (
            <tr className="text-[#4A4943]">
              <td className="py-1">1 o 2 piezas</td>
              <td className="py-1 text-right font-semibold text-[#1B1B18]">
                {dinero(precioUnitario)}
              </td>
              <td className="w-[62px] py-1" />
            </tr>
          )}

          {escalones.map((e) => (
            <tr key={e.desde} className="text-[#4A4943]">
              <td className="py-1">
                {e.desde} o más <span className="text-[#6B6A63]">c/u</span>
              </td>
              <td className="py-1 text-right font-bold text-[#1F5B29]">
                {dinero(e.precio)}
              </td>
              <td className="py-1 pl-2 text-right">
                {e.porcentaje > 0 && (
                  <span className="rounded-md bg-[#1F5B29] px-1.5 py-0.5 text-[11px] font-bold text-white">
                    −{e.porcentaje}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-[11px] text-[#8A6A33]">
        El precio baja solo al subir la cantidad en el carrito. No hay que
        escribir ningún código.
      </p>
    </div>
  )
}

// La versión de una línea, para la tarjeta de producto.
export const DistintivoVolumen = ({
  escalon,
  compacto = false,
}: {
  escalon: Escalon | null | undefined
  compacto?: boolean
}) => {
  if (!escalon || escalon.porcentaje <= 0) return null

  if (compacto) {
    return (
      <span className="text-[11px] font-semibold text-[#1F5B29]">
        −{escalon.porcentaje}% llevando {escalon.desde}+
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#D9C9A8] bg-[#FFFBF2] px-2.5 py-1 text-[12.5px] font-semibold text-[#7A4A09]">
      −{escalon.porcentaje}% llevando {escalon.desde} o más
    </span>
  )
}
