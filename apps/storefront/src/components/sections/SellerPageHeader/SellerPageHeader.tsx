import { SellerFooter, SellerHeading } from "@/components/organisms"
import { HttpTypes } from "@medusajs/types"

export const SellerPageHeader = ({
  header = false,
  seller,
  user,
}: {
  header?: boolean
  seller: any
  user: HttpTypes.StoreCustomer | null
}) => {
  return (
    <div className="border border-[#E7E4DC] rounded-xl overflow-hidden bg-white">
      <SellerHeading header seller={seller} user={user} />
      <SellerFooter seller={seller} />
    </div>
  )
}
