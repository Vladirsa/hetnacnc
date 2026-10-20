import Image from "next/image"

// Se importa por su ruta, no por el barril de molecules: este archivo es una
// de las molecules que el barril exporta, y pedirle al barril desde aquí cierra
// el círculo (el componente llega como undefined en tiempo de ejecución).
import { DeleteCartItemButton } from "../DeleteCartItemButton/DeleteCartItemButton"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { convertToLocale } from "@/lib/helpers/money"
import { HttpTypes } from "@medusajs/types"

// Un renglón del carrito flotante. Compacto a propósito: aquí sólo se confirma
// "sí, se agregó lo que querías". Cambiar cantidades y revisar se hace en la
// página del carrito.
export const CartDropdownItem = ({
  item,
  currency_code,
}: {
  item: HttpTypes.StoreCartLineItem
  currency_code: string
}) => {
  const subtotal = item.subtotal ?? 0
  const lista = (item.compare_at_unit_price || 0) * item.quantity
  const hayDescuento = lista > subtotal

  const opciones = Object.entries(item.variant_option_values ?? {})

  return (
    <div className="flex gap-3 border-b border-[#EDEAE2] py-3 last:border-b-0">
      <LocalizedClientLink href={`/products/${item.product_handle}`} className="shrink-0">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[8px] border border-[#EDEAE2] bg-[#FAF9F6]">
          {item.thumbnail ? (
            <Image
              src={decodeURIComponent(item.thumbnail)}
              alt={item.product_title || "Producto"}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={"/images/placeholder.svg"}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain opacity-30"
            />
          )}
        </div>
      </LocalizedClientLink>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <LocalizedClientLink href={`/products/${item.product_handle}`} className="min-w-0">
            <h4 className="line-clamp-2 text-[13px] font-medium leading-snug text-[#1B1B18] hover:text-[#B34D07]">
              {item.product_title}
            </h4>
          </LocalizedClientLink>
          <DeleteCartItemButton id={item.id} />
        </div>

        {opciones.length > 0 && (
          <p className="truncate text-[12px] text-[#6B6A63]">
            {opciones.map(([titulo, valor]) => `${titulo}: ${String(valor)}`).join(" · ")}
          </p>
        )}

        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-[14px] font-bold text-[#1B1B18]">
            {convertToLocale({ amount: subtotal, currency_code })}
          </span>
          {hayDescuento && (
            <span className="text-[12px] text-[#8A8780] line-through">
              {convertToLocale({ amount: lista, currency_code })}
            </span>
          )}
          <span className="ml-auto text-[12px] text-[#6B6A63]">× {item.quantity}</span>
        </div>
      </div>
    </div>
  )
}
