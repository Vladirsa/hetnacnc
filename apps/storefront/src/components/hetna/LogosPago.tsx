// Marcas de los medios de pago que la tienda acepta.
//
// Van dibujadas aquí y no como imágenes sueltas por una razón de velocidad: son
// seis logos chiquitos que aparecen en el carrito y en la pasarela, o sea seis
// peticiones más justo en las dos pantallas donde cada milisegundo se paga en
// ventas. Como SVG en línea pesan unos cuantos cientos de bytes y llegan con el
// HTML.
//
// Sólo se pone lo que de verdad se puede cobrar. Un logo de más en esta fila no
// es decoración: es una promesa de que ese medio funciona.

type Props = { className?: string }

const CAJA = "h-[26px] w-[42px] shrink-0 rounded-[4px]"

export const LogoVisa = ({ className = "" }: Props) => (
  <svg viewBox="0 0 42 26" className={`${CAJA} ${className}`} role="img" aria-label="Visa">
    <rect width="42" height="26" rx="4" fill="#F5F6FA" stroke="#E2E1DC" />
    <text
      x="21"
      y="17.5"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="11"
      fontWeight="700"
      fontStyle="italic"
      fill="#1A1F71"
      letterSpacing="0.4"
    >
      VISA
    </text>
  </svg>
)

export const LogoMastercard = ({ className = "" }: Props) => (
  <svg viewBox="0 0 42 26" className={`${CAJA} ${className}`} role="img" aria-label="Mastercard">
    <rect width="42" height="26" rx="4" fill="#F5F6FA" stroke="#E2E1DC" />
    <circle cx="17.5" cy="13" r="7" fill="#EB001B" />
    <circle cx="24.5" cy="13" r="7" fill="#F79E1B" />
    <path
      d="M21 7.9a7 7 0 0 0 0 10.2 7 7 0 0 0 0-10.2z"
      fill="#FF5F00"
    />
  </svg>
)

export const LogoAmex = ({ className = "" }: Props) => (
  <svg viewBox="0 0 42 26" className={`${CAJA} ${className}`} role="img" aria-label="American Express">
    <rect width="42" height="26" rx="4" fill="#1F72CD" />
    <text
      x="21"
      y="16.5"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="8"
      fontWeight="700"
      fill="#FFFFFF"
      letterSpacing="0.3"
    >
      AMEX
    </text>
  </svg>
)

export const LogoMercadoPago = ({ className = "" }: Props) => (
  <svg viewBox="0 0 42 26" className={`${CAJA} ${className}`} role="img" aria-label="Mercado Pago">
    <rect width="42" height="26" rx="4" fill="#FFE600" />
    <text
      x="21"
      y="11.5"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="6.5"
      fontWeight="700"
      fill="#2D3277"
    >
      mercado
    </text>
    <text
      x="21"
      y="19"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="6.5"
      fontWeight="700"
      fill="#2D3277"
    >
      pago
    </text>
  </svg>
)

export const LogoPaypal = ({ className = "" }: Props) => (
  <svg viewBox="0 0 42 26" className={`${CAJA} ${className}`} role="img" aria-label="PayPal">
    <rect width="42" height="26" rx="4" fill="#F5F6FA" stroke="#E2E1DC" />
    <text
      x="21"
      y="17"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="9"
      fontWeight="700"
      fontStyle="italic"
    >
      <tspan fill="#253B80">Pay</tspan>
      <tspan fill="#179BD7">Pal</tspan>
    </text>
  </svg>
)

export const LogoTarjeta = ({ className = "" }: Props) => (
  <svg viewBox="0 0 42 26" className={`${CAJA} ${className}`} role="img" aria-label="Tarjeta">
    <rect width="42" height="26" rx="4" fill="#F5F6FA" stroke="#E2E1DC" />
    <rect x="6" y="8" width="30" height="3.2" fill="#8A8780" />
    <rect x="6" y="15" width="10" height="2.6" rx="1.3" fill="#C7C4BC" />
  </svg>
)

// La fila que se enseña junto al resumen: "con esto puedes pagar".
export const LogosPago = ({ className = "" }: Props) => (
  <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
    <LogoVisa />
    <LogoMastercard />
    <LogoAmex />
    <LogoMercadoPago />
    <LogoPaypal />
  </div>
)
