// Constantes sin JSX a propósito.
//
// `middleware.ts` importa PROTECTED_ROUTES de aquí, y el middleware se empaqueta
// para el runtime Edge y corre en CADA petición. Mientras este archivo tenía
// adentro `paymentInfoMap` -- un objeto con componentes de React -- ese paquete
// se llevaba React y los iconos a cada carga de página sin usarlos nunca. El
// mapa vive ahora en `lib/pagos.tsx`.

// This only checks if it is native stripe for card payments, it ignores the other stripe-based providers
export const isStripe = (providerId?: string) => {
  return providerId?.startsWith("pp_card_stripe-connect")
}
export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}
export const isMercadoPago = (providerId?: string) => {
  return providerId?.startsWith("pp_mercadopago")
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]

export const PROTECTED_ROUTES = ['/user', '/user/orders', '/user/settings', '/user/addresses', '/user/messages', '/user/returns']
