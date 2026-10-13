// Proveedor de envío "Envíos HETNA" (Skydropx). Fase 1: precio calculado en el checkout.
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import { SkydropxClient, mejorTarifa } from "./client"

type Opciones = {
  clientId: string
  clientSecret: string
  sandbox?: boolean
  margenPct?: number
  origenCp: string // dirección de respaldo mientras cada taller no tenga la suya
  origenEstado?: string
  origenMunicipio?: string
  origenColonia?: string
}
const PAQUETE_BASE = { largo: 30, ancho: 30, alto: 20, peso: 2 }

export default class SkydropxProviderService extends AbstractFulfillmentProviderService {
  static identifier = "skydropx"
  protected cliente: SkydropxClient
  protected opts: Opciones
  constructor(container: Record<string, unknown>, options: Opciones) {
    super()
    this.opts = options
    this.cliente = new SkydropxClient(options)
  }
  async getFulfillmentOptions() {
    return [{ id: "envios-hetna", name: "Envíos HETNA" }]
  }
  async validateFulfillmentData(_o: any, data: any) {
    return data
  }
  async validateOption() {
    return true
  }
  async canCalculate() {
    return true
  }
  async calculatePrice(_optionData: any, _data: any, context: any) {
    const cp = context?.shipping_address?.postal_code
    if (!cp) throw new Error("Falta el código postal de destino")
    const cot = await this.cliente.cotizar(
      { cp: this.opts.origenCp, estado: this.opts.origenEstado, ciudad: this.opts.origenMunicipio, colonia: this.opts.origenColonia },
      {
        cp,
        estado: context.shipping_address.province,
        ciudad: context.shipping_address.city,
        colonia: context.shipping_address.address_2,
      },
      PAQUETE_BASE
    )
    const t = mejorTarifa(cot, this.opts.margenPct ?? 0)
    if (!t) throw new Error("Sin tarifas disponibles para ese destino")
    return { calculated_amount: t.precio, is_calculated_price_tax_inclusive: true }
  }
  // Fases 2 y 3 (guías y rastreo) aún no implementadas.
  async createFulfillment() {
    return { data: {}, labels: [] }
  }
  async cancelFulfillment() {
    return {}
  }
  async createReturnFulfillment() {
    return { data: {}, labels: [] }
  }
}
