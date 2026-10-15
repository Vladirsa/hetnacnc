// Proveedor de envío "Envíos HETNA" (Skydropx).
// Fase 1b: precio calculado en el checkout con el peso y las medidas reales de los productos,
// con dos opciones para el cliente: económica (la más barata) y express (la más rápida).
// Fases 2 y 3 (comprar la guía y entregarla al taller) aún no implementadas.
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import { SkydropxClient, mejorTarifa } from "./client"
import { tarifaRapida, armarPaquete } from "./tarifas"

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
    return [
      { id: "envios-hetna", name: "Envío económico" },
      { id: "envios-hetna-express", name: "Envío express" },
    ]
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
  async calculatePrice(optionData: any, _data: any, context: any) {
    const cp = context?.shipping_address?.postal_code
    if (!cp) throw new Error("Falta el código postal de destino")
    const { paquete, real } = armarPaquete(context?.items || [], PAQUETE_BASE)
    // Mensaje de diagnóstico: permite ver en los registros si se usó el peso real o el paquete base
    console.log(`[skydropx] cotizando CP ${cp} con paquete ${real ? "REAL" : "BASE"}: ${JSON.stringify(paquete)} opción ${optionData?.id}`)
    const cot = await this.cliente.cotizar(
      { cp: this.opts.origenCp, estado: this.opts.origenEstado, ciudad: this.opts.origenMunicipio, colonia: this.opts.origenColonia },
      {
        cp,
        estado: context.shipping_address.province,
        ciudad: context.shipping_address.city,
        colonia: context.shipping_address.address_2,
      },
      paquete
    )
    const margen = this.opts.margenPct ?? 0
    const express = optionData?.id === "envios-hetna-express"
    const t = express ? tarifaRapida(cot, margen) : mejorTarifa(cot, margen)
    if (!t) throw new Error("Sin tarifas disponibles para ese destino")
    console.log(`[skydropx] ${express ? "express" : "económico"}: ${t.paqueteria} ${t.servicio} ${t.dias} días costo ${t.costo} precio ${t.precio}`)
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
