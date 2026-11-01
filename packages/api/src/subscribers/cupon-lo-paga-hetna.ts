// Los cupones de HETNA (BIENVENIDA y Recomienda y gana) los paga HETNA, no el
// taller (decisión de Vlado, 1 nov 2026; ver lib/cupones.ts).
//
// Mercur le paga al taller: total del pedido - suma de sus líneas de comisión.
// El cupón baja el total del pedido, así que aquí se agrega una línea de
// comisión NEGATIVA por el mismo descuento en cada producto: el pago al taller
// queda igual que sin cupón y la diferencia sale de la comisión de HETNA.
//
// Se crea con createCommissionLines (no upsert: el upsert de Mercur borra las
// líneas que ya tiene el producto). Si el pedido se edita, Mercur recalcula sus
// comisiones y esta línea se pierde: en ese caso hay que revisar el pedido a mano.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

import { esCuponHetna } from "../lib/cupones"
import { T_SALDO } from "../lib/saldos-talleres"

export const CODIGO_LINEA = "hetna_cupon"

export default async function cuponLoPagaHetna({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "items.id", "items.adjustments.code", "items.adjustments.amount"],
      filters: { id: event.data.id },
    })
    const orden = data?.[0] as unknown as
      | { id: string; display_id?: number | string; items?: { id: string; adjustments?: { code?: string | null; amount?: unknown }[] }[] }
      | undefined
    if (!orden) return

    const porProducto = new Map<string, { monto: number; codigos: Set<string> }>()
    for (const it of orden.items || []) {
      for (const a of it.adjustments || []) {
        if (!esCuponHetna(a?.code)) continue
        const monto = Number((a.amount as any)?.value ?? a.amount) || 0
        if (monto <= 0) continue
        const p = porProducto.get(it.id) || { monto: 0, codigos: new Set<string>() }
        p.monto += monto
        p.codigos.add(String(a.code).toUpperCase())
        porProducto.set(it.id, p)
      }
    }
    if (!porProducto.size) return

    const comisiones = container.resolve(MercurModules.COMMISSION) as {
      listCommissionLines: (f: Record<string, unknown>) => Promise<{ item_id?: string | null }[]>
      createCommissionLines: (d: Record<string, unknown>[]) => Promise<unknown>
    }
    const ya = await comisiones.listCommissionLines({ item_id: [...porProducto.keys()], code: CODIGO_LINEA })
    const hechos = new Set(ya.map((l) => l.item_id))
    const nuevas = [...porProducto.entries()]
      .filter(([id]) => !hechos.has(id))
      .map(([item_id, p]) => ({
        item_id,
        code: CODIGO_LINEA,
        rate: 0,
        amount: -Math.round(p.monto * 100) / 100,
        description: `Cupón ${[...p.codigos].join(", ")}: lo paga HETNA, no el taller`,
      }))
    if (!nuevas.length) return
    await comisiones.createCommissionLines(nuevas)
    const total = nuevas.reduce((s, l) => s - l.amount, 0)

    // El saldo del taller (lib/saldos-talleres.ts) también se registra con
    // order.placed y pudo leer la comisión antes de esta línea: se corrige aquí
    // mientras no se le haya pagado. Se repite a los 20 s por si ese registro
    // iba a la mitad cuando se revisó.
    const corregirSaldo = async () => {
      const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      if (await knex.schema.hasTable(T_SALDO)) {
        const fila = await knex(T_SALDO).where({ order_id: orden.id }).first("estado", "motivo")
        if (fila && ["pendiente", "disponible"].includes(fila.estado)) {
          const { data: lineas } = await query.graph({
            entity: "commission_line",
            fields: ["amount"],
            filters: { item_id: (orden.items || []).map((i) => i.id) } as any,
          })
          const comision = Math.round((lineas || []).reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0) * 100) / 100
          await knex(T_SALDO)
            .where({ order_id: orden.id })
            .update({ comision, actualizado: knex.fn.now() })
        }
      }
    }
    const avisar = (e: unknown) =>
      logger.warn(`[cupones] no se pudo corregir el saldo del pedido ${orden.id}: ${(e as Error).message}`)
    await corregirSaldo().catch(avisar)
    setTimeout(() => void corregirSaldo().catch(avisar), 20_000)
    logger.info(`[cupones] pedido #${orden.display_id ?? orden.id}: HETNA absorbe $${total.toFixed(2)} de cupón`)
  } catch (e) {
    logger.warn(`[cupones] no se pudo ajustar la comisión del pedido ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
