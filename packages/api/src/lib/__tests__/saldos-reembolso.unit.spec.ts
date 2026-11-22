import { motivoRetencion, retenerReembolsados } from "../saldos-talleres"

const pagado = { payment_collections: [{ status: "completed", refunded_amount: 0, payments: [{ provider_id: "pp_mercadopago_mp" }] }] }

describe("No pagarle al taller lo reembolsado o cancelado", () => {
  it("motivo: pedido reembolsado sin cancelar (total o parcial), por cobro propio o del carrito de Mercur", () => {
    expect(motivoRetencion({ status: "pending", payment_collections: [{ status: "completed", refunded_amount: 250 }] })).toMatch(/reembolso/)
    expect(motivoRetencion({ status: "completed", cart: { payment_collection: { status: "completed", refunded_amount: { value: "10" } } } } as any)).toMatch(/reembolso/)
    expect(motivoRetencion({ status: "canceled", ...pagado })).toMatch(/cancelado/)
    expect(motivoRetencion({ status: "completed", ...pagado })).toBeNull()
  })

  it("retiene sólo los reembolsados o cancelados que aún no se pagan, y nunca los ajustes por sobrepeso", async () => {
    const actualizados: string[] = []
    const filas = [{ order_id: "order_bien" }, { order_id: "order_reemb" }, { order_id: "order_cancel" }, { order_id: "sobrepeso:sob_1" }]
    const knex: any = (tabla: string) => {
      const q: any = { _where: {} as any }
      q.where = (w: any) => { Object.assign(q._where, w); return q }
      q.whereIn = () => q
      q.select = async () => filas
      q.update = async () => { actualizados.push(q._where.order_id); return 1 }
      return q
    }
    knex.schema = { hasTable: async () => true }
    knex.fn = { now: () => "now" }
    const ordenes = [
      { id: "order_bien", status: "completed", ...pagado },
      { id: "order_reemb", status: "completed", payment_collections: [{ status: "completed", refunded_amount: 100 }] },
      { id: "order_cancel", status: "canceled", ...pagado },
    ]
    let pedidos: string[] = []
    const c: any = {
      resolve: (k: string) =>
        k === "query"
          ? { graph: async ({ filters }: any) => { pedidos = filters.id; return { data: ordenes.filter((o) => filters.id.includes(o.id)) } } }
          : knex,
    }
    const n = await retenerReembolsados(c)
    expect(pedidos).not.toContain("sobrepeso:sob_1")
    expect(actualizados.sort()).toEqual(["order_cancel", "order_reemb"])
    expect(n).toBe(2)
  })
})
