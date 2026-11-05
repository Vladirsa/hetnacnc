// @ts-nocheck
// Aviso "Activa tu cuenta" arriba de pedidos, productos y ofertas mientras al
// taller le falten los requisitos para publicar (términos y tarjeta).
import { defineWidgetConfig } from "@mercurjs/dashboard-sdk"

import { AvisoRequisitos } from "../lib/requisitos"

const Aviso = () => <AvisoRequisitos />

export const config = defineWidgetConfig({
  zone: ["orders.list.before", "product.list.before", "offers.list.before"],
})

export default Aviso
