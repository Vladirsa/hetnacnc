import { convertToLocale } from "@/lib/helpers/money"

// "Envío gratis desde $800" — el mismo dato que la barra del carrito, pero
// donde el cliente todavía está decidiendo. En el carrito ya decidió: ahí el
// umbral sirve para que suba el pedido. Aquí sirve para que empiece.
//
// El monto es el del carrito completo, no el de este taller, porque así se
// evalúa la regla. En la tarjeta no cabe explicarlo y tampoco hace falta: el
// cliente que llegue al carrito va a ver la barra con el número exacto.
export const DistintivoEnvioGratis = ({
  desde,
  currency_code = "mxn",
  compacto = false,
}: {
  desde: number | null | undefined
  currency_code?: string
  compacto?: boolean
}) => {
  if (!(typeof desde === "number" && desde > 0)) return null

  const monto = convertToLocale({
    amount: desde,
    currency_code,
    maximumFractionDigits: 0,
  })

  if (compacto) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#1F5B29]">
        <span aria-hidden>🚚</span>
        <span className="truncate">Envío gratis desde {monto}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#A8D3AC] bg-[#EDF7EE] px-2.5 py-1 text-[12.5px] font-semibold text-[#1F5B29]">
      <span aria-hidden>🚚</span>
      Envío gratis desde {monto}
    </span>
  )
}
