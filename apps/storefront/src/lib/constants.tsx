import React from "react"
import { Cash } from "@medusajs/icons"

import {
  LogoMercadoPago,
  LogoPaypal,
  LogoTarjeta,
} from "@/components/hetna/LogosPago"

// Cómo se ve cada medio de pago en la pasarela.
//
// Antes los siete traían el mismo icono genérico de tarjeta, así que elegir
// "Mercado Pago" o "PayPal" se veía exactamente igual que elegir cualquier otra
// cosa. En la pantalla donde alguien decide si teclea su tarjeta, una fila de
// iconos iguales no dice nada; la marca que ya conoce, sí.
export const paymentInfoMap: Record<
  string,
  { title: string; descripcion?: string; icon: React.JSX.Element }
> = {
  pp_mercadopago_mercadopago: {
    title: "Mercado Pago",
    descripcion: "Tarjeta, saldo, meses sin intereses o efectivo.",
    icon: <LogoMercadoPago />,
  },
  "pp_card_stripe-connect": {
    title: "Tarjeta de crédito o débito",
    descripcion: "Visa, Mastercard y American Express.",
    icon: <LogoTarjeta />,
  },
  pp_stripe_stripe: {
    title: "Tarjeta de crédito o débito",
    descripcion: "Visa, Mastercard y American Express.",
    icon: <LogoTarjeta />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <LogoTarjeta />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <LogoTarjeta />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    descripcion: "Pagas con tu cuenta de PayPal.",
    icon: <LogoPaypal />,
  },
  pp_system_default: {
    title: "Pago manual",
    descripcion: "Lo acuerdas directamente con el taller.",
    icon: <Cash />,
  },
}

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
