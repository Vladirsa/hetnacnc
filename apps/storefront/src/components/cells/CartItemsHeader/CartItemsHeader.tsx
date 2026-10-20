import { Checkbox } from "@/components/atoms"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { SingleProductSeller } from "@/types/product"

import { SellerAvatar } from "../SellerAvatar/SellerAvatar"

// Encabezado del grupo de un taller. En un marketplace el renglón no basta:
// quien compra necesita saber de quién es cada cosa, porque cada taller cobra
// su propio envío y responde por lo suyo.
export const CartItemsHeader = ({
  seller,
  cantidad,
  seleccion,
}: {
  seller: SingleProductSeller
  cantidad?: number
  seleccion?: { seleccionado: boolean; alternar: () => void }
}) => {
  const propio = seller.id === "fleek"

  return (
    <div className="flex items-center gap-3 rounded-t-[12px] border border-[#E7E4DC] bg-[#FAF9F6] px-3 py-3 sm:px-4">
      {seleccion && (
        <Checkbox
          checked={seleccion.seleccionado}
          onChange={seleccion.alternar}
          aria-label={`Incluir todo lo de ${seller.name}`}
          data-testid="cart-seller-select"
        />
      )}

      <LocalizedClientLink
        href={propio ? "/" : `/sellers/${seller.handle}`}
        className="flex min-w-0 items-center gap-2.5"
      >
        <SellerAvatar photo={seller.photo} size={28} alt={seller.name} />
        <span className="truncate text-[14px] font-bold text-[#1B1B18] hover:text-[#B34D07]">
          {seller.name}
        </span>
      </LocalizedClientLink>

      {typeof cantidad === "number" && cantidad > 0 && (
        <span className="ml-auto shrink-0 text-[12px] text-[#6B6A63]">
          {cantidad === 1 ? "1 producto" : `${cantidad} productos`}
        </span>
      )}
    </div>
  )
}
