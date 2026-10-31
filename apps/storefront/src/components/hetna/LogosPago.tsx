// Marcas de los medios de pago que la tienda acepta.
//
// Son los logos oficiales (public/pagos/*.webp, 240x150, 3 a 6 KB cada uno),
// más grandes que los dibujos de antes para que se reconozcan de un vistazo en
// el carrito y en la pasarela. Pesan poco y se cargan sin bloquear la página.
//
// Sólo se pone lo que de verdad se puede cobrar. Un logo de más en esta fila no
// es decoración: es una promesa de que ese medio funciona.

type Props = { className?: string }

const CAJA = "h-[40px] w-[64px] shrink-0 rounded-[6px] border border-[#E2E1DC] bg-white object-contain"

const Marca = ({ archivo, nombre, className = "" }: Props & { archivo: string; nombre: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`/pagos/${archivo}.webp`}
    alt={nombre}
    width={64}
    height={40}
    loading="lazy"
    decoding="async"
    className={`${CAJA} ${className}`}
  />
)

export const LogoVisa = ({ className = "" }: Props) => <Marca archivo="visa" nombre="Visa" className={className} />
export const LogoMastercard = ({ className = "" }: Props) => (
  <Marca archivo="mastercard" nombre="Mastercard" className={className} />
)
export const LogoAmex = ({ className = "" }: Props) => (
  <Marca archivo="amex" nombre="American Express" className={className} />
)
export const LogoMercadoPago = ({ className = "" }: Props) => (
  <Marca archivo="mercadopago" nombre="Mercado Pago" className={className} />
)
export const LogoPaypal = ({ className = "" }: Props) => <Marca archivo="paypal" nombre="PayPal" className={className} />

export const LogoTarjeta = ({ className = "" }: Props) => (
  <svg viewBox="0 0 42 26" className={`h-[40px] w-[64px] shrink-0 rounded-[6px] ${className}`} role="img" aria-label="Tarjeta">
    <rect width="42" height="26" rx="4" fill="#F5F6FA" stroke="#E2E1DC" />
    <rect x="6" y="8" width="30" height="3.2" fill="#8A8780" />
    <rect x="6" y="15" width="10" height="2.6" rx="1.3" fill="#C7C4BC" />
  </svg>
)

// La fila que se enseña junto al resumen: "con esto puedes pagar".
export const LogosPago = ({ className = "" }: Props) => (
  <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    <LogoVisa />
    <LogoMastercard />
    <LogoAmex />
    <LogoMercadoPago />
    <LogoPaypal />
  </div>
)
