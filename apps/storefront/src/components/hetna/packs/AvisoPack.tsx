import { convertToLocale } from "@/lib/helpers/money"
import type { Pack } from "@/lib/packs/acciones"

// Cómo se lee un pack en una frase.
//
// "Llévate 3 y el 3º va gratis" en vez de "buy 2 get 1 at 100%": el cliente no
// tiene por qué entender que Medusa separa el lado que junta del lado que recibe.
// Para él son piezas totales, así que aquí se suma: lleva + recibe.
export const frasePack = (pack: Pack): string => {
  const total = pack.lleva + pack.recibe
  const cat = pack.categorias.map((c) => c.nombre).filter(Boolean).join(" o ")
  const donde = cat ? ` de ${cat}` : ""

  if (pack.gratis) {
    return pack.recibe === 1
      ? `Llévate ${total}${donde} y 1 va gratis`
      : `Llévate ${total}${donde} y ${pack.recibe} van gratis`
  }

  const cuanto =
    pack.tipo === "percentage"
      ? `−${Math.round(pack.valor)}%`
      : convertToLocale({
          amount: pack.valor,
          currency_code: pack.moneda || "mxn",
          maximumFractionDigits: 0,
        })

  return pack.recibe === 1
    ? `Llévate ${total}${donde} y 1 con ${cuanto}`
    : `Llévate ${total}${donde} y ${pack.recibe} con ${cuanto}`
}

// El total de piezas que hay que juntar para que el pack aplique.
export const piezasDelPack = (pack: Pack): number => pack.lleva + pack.recibe

// El aviso en la ficha del producto: todavía no hay carrito que medir, así que
// sólo se anuncia.
export const AvisoPack = ({ packs }: { packs: Pack[] }) => {
  if (!packs.length) return null

  return (
    <div className="rounded-[10px] border border-[#C9A8D9] bg-[#FBF5FF] p-3">
      <p className="text-[12.5px] font-bold text-[#5B2A7A]">
        {packs.length === 1 ? "Pack de este taller" : "Packs de este taller"}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {packs.map((pack) => (
          <li
            key={pack.promocion_id}
            className="flex items-start gap-1.5 text-[13px] leading-snug text-[#4A2460]"
          >
            <span aria-hidden className="mt-[1px]">🎁</span>
            <span className="font-semibold">{frasePack(pack)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-[#7A5A8A]">
        Se aplica solo en tu carrito. No hay que escribir ningún código.
      </p>
    </div>
  )
}
