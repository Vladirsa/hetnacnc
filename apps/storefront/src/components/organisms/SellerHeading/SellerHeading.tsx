import { HttpTypes } from "@medusajs/types"
import { SellerDTO } from "@mercurjs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import { Chat } from "../Chat/Chat"

export const SellerHeading = ({
  seller,
  user,
}: {
  header?: boolean
  seller: SellerDTO
  user: HttpTypes.StoreCustomer | null
}) => {
  const s = seller as any
  const foto: string | undefined = s.photo || s.logo || s.image || undefined
  const ubicacion = [s.city || s.address?.city, s.state || s.address?.province].filter(Boolean).join(", ")
  const desde = seller.created_at
    ? new Date(seller.created_at as any).toLocaleDateString("es-MX", { month: "long", year: "numeric" })
    : null

  return (
    <div className="border-b border-[#E7E4DC]">
      <div className="h-[110px] md:h-[160px] bg-gradient-to-br from-[#142033] via-[#1B2A42] to-[#C2560A]" />
      <div className="px-5 md:px-8 pb-5">
        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12 md:-mt-14">
          <span className="w-24 h-24 md:w-28 md:h-28 rounded-2xl ring-4 ring-white bg-[#C2560A] text-white text-[40px] font-bold flex items-center justify-center overflow-hidden shrink-0">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt={seller.name} className="w-full h-full object-cover" />
            ) : (
              (seller.name?.trim()[0] || "?").toUpperCase()
            )}
          </span>
          <div className="flex-1 min-w-0 md:pb-1">
            <h1 className="m-0 text-[24px] md:text-[28px] font-bold text-[#1B1B18] leading-tight">{seller.name}</h1>
            <p className="m-0 mt-1 text-[14px] text-[#6B6A63] flex flex-wrap gap-x-3 gap-y-1">
              {s.handle && <span>@{s.handle}</span>}
              {ubicacion && <span>📍 {ubicacion}</span>}
              {desde && <span>En HETNA desde {desde}</span>}
            </p>
          </div>
          <div className="md:pb-1">
            {user ? (
              <Chat user={user} seller={seller} buttonClassNames="uppercase h-10" variant="filled" buttonSize="small" />
            ) : (
              <LocalizedClientLink
                href="/login"
                className="inline-flex items-center justify-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 h-10 rounded-full text-[14px]"
              >
                Inicia sesión para contactar
              </LocalizedClientLink>
            )}
          </div>
        </div>
        {seller.description ? (
          <p
            dangerouslySetInnerHTML={{ __html: seller.description }}
            className="label-md mt-5 max-w-[760px] text-[#44433D] leading-relaxed"
          />
        ) : null}
      </div>
    </div>
  )
}
