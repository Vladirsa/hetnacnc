import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// "Enviar a Roberto / CP 90300", como en Mercado Libre.
export const EnvioA = ({
  user,
}: {
  user: HttpTypes.StoreCustomer | null
}) => {
  const direcciones = user?.addresses || []
  const dir =
    direcciones.find((d) => d.is_default_shipping) || direcciones[0] || null

  const nombre = (user?.first_name || dir?.first_name || "").trim()

  let arriba = "Enviar a"
  let abajo = "Elige tu dirección"
  let href = "/login"

  if (user) {
    arriba = nombre ? `Enviar a ${nombre}` : "Enviar a"
    href = "/user/addresses"
    if (dir?.postal_code) abajo = `CP ${dir.postal_code}`
    else if (dir?.city) abajo = dir.city
    else abajo = "Agrega tu dirección"
  }

  return (
    <LocalizedClientLink
      href={href}
      className="flex items-center gap-1.5 text-left rounded-md px-1.5 py-1 hover:bg-[#F4F1EA]"
      data-testid="header-envio-a"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6B6A63"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-[12px] text-[#6B6A63] max-w-[140px] truncate">
          {arriba}
        </span>
        <span className="text-[14px] font-semibold text-[#1B1B18]">
          {abajo}
        </span>
      </span>
    </LocalizedClientLink>
  )
}
