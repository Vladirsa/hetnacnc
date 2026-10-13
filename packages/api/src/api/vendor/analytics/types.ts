export type VendorAnalyticsTopProduct = {
  producto_id: string
  titulo: string
  cantidad: number
  ingresos: number
}

export type VendorAnalyticsPayoutResumen = {
  cantidad: number
  monto: number
}

export type VendorAnalyticsPayoutReciente = {
  id: string
  display_id: number
  monto: number
  moneda: string
  estado: string
  creado: string
}

export type VendorAnalyticsResponse = {
  moneda: string | null
  pedidos: {
    ventana_dias: number
    total_pedidos: number
    ingresos_totales: number
    por_dia: { fecha: string; pedidos: number; ingresos: number }[]
  }
  productos_top: VendorAnalyticsTopProduct[]
  payouts: {
    pendientes: VendorAnalyticsPayoutResumen
    pagados: VendorAnalyticsPayoutResumen
    recientes: VendorAnalyticsPayoutReciente[]
  }
}
