import { T } from "@/components/hetna/i18n/Idioma"
import { Badge } from "@medusajs/ui"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold px-4"><T>Attention:</T></span> <T>For testing
      purposes only.</T>
    </Badge>
  )
}

export default PaymentTest
