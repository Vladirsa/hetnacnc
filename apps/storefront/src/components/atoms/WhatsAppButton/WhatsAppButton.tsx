"use client"

// Numero por defecto (negocio HETNA CNC) cuando el vendedor no tiene uno registrado
const DEFAULT_WHATSAPP =
  process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"

// Se arma por partes para que el copiar/pegar no la convierta en enlace
const WA_BASE = "https:" + "//" + "wa" + ".me/"

function normalizePhone(raw?: string | null) {
  const digits = (raw || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.length === 10) return "52" + digits
  return digits
}

export const WhatsAppButton = ({
  productTitle,
  seller,
}: {
  productTitle: string
  seller?: any
}) => {
  const sellerPhone = seller?.metadata?.whatsapp || seller?.phone
  const phone =
    normalizePhone(sellerPhone) || normalizePhone(DEFAULT_WHATSAPP)

  const handleClick = () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = `Hola, me interesa este producto de HETNA CNC: ${productTitle} ${url}`
    window.open(
      WA_BASE + phone + "?text=" + encodeURIComponent(text),
      "_blank",
      "noopener,noreferrer"
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full uppercase mb-4 py-3 flex justify-center items-center gap-2 rounded-sm font-medium text-white"
      style={{ backgroundColor: "#25D366" }}
      data-testid="product-whatsapp-button"
    >
      Preguntar por WhatsApp
    </button>
  )
}
