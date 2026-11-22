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

/**
 * Sólo los renglones del taller de esta opción. El hook
 * workflows/hooks/envio-por-taller.ts pone en el contexto qué renglones son de
 * cada almacén; sin él (o si el almacén no aparece) se usan todos, como antes.
 */
export function renglonesDelTaller(context: any): any[] {
  const items = (context?.items || []) as any[]
  const mapa = context?.hetna_renglones_por_almacen as Record<string, string[]> | undefined
  const almacen = context?.from_location?.id as string | undefined
  if (!mapa || !almacen || !Array.isArray(mapa[almacen])) return items
  const ids = new Set(mapa[almacen])
  return items.filter((i) => ids.has(i?.id))
}

/**
 * De dónde sale el paquete: la dirección del taller (la misma con la que se
 * compra la guía, lib/guias.ts; la pone el hook) o, si no viene, la del almacén.
 * Si ninguna tiene código postal, la de HETNA (ENVIO_ORIGEN_CP).
 */
export function origenDe(context: any, opts: { origenCp: string; origenEstado?: string; origenMunicipio?: string; origenColonia?: string }) {
  const almacen = context?.from_location?.id as string | undefined
  const delTaller = almacen ? context?.hetna_origen_por_almacen?.[almacen] : undefined
  for (const a of [delTaller, context?.from_location?.address]) {
    const cp = String(a?.postal_code || "").replace(/\D/g, "")
    if (cp.length === 5) return { cp, estado: a.province || undefined, ciudad: a.city || undefined, colonia: a.address_2 || undefined }
  }
  return { cp: opts.origenCp, estado: opts.origenEstado, ciudad: opts.origenMunicipio, colonia: opts.origenColonia }
}

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
    const { paquete, real } = armarPaquete(renglonesDelTaller(context), PAQUETE_BASE)
    const origen = origenDe(context, this.opts)
    // Mensaje de diagnóstico: permite ver en los registros si se usó el peso real o el paquete base
    console.log(`[skydropx] cotizando ${origen.cp} → CP ${cp} con paquete ${real ? "REAL" : "BASE"}: ${JSON.stringify(paquete)} opción ${optionData?.id}`)
    const cot = await this.cliente.cotizar(
      origen,
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
