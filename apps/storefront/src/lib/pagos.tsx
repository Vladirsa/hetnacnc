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

