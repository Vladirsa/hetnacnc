import { PLANES_DESTACADO, nuevoHasta, pagoDeDestacado, planesDestacado, precioDestacado } from "../disenos-destacado"

// Destacado de talleres en Piezas para imprimir (lib/disenos-destacado.ts)
describe("destacado de talleres", () => {
  const DIA = 86_400_000
  const ahora = Date.UTC(2026, 10, 25)

  it("planes de 7 y 30 días con precio (se puede cambiar por variable)", () => {
    expect(planesDestacado().map((p) => p.dias)).toEqual([7, 30])
    expect(precioDestacado(7)).toBe(PLANES_DESTACADO[7])
    expect(precioDestacado(9)).toBeNull()
    process.env.DESTACADO_PRECIO_7 = "149"
    expect(precioDestacado(7)).toBe(149)
    delete process.env.DESTACADO_PRECIO_7
  })

  it("los días se suman al final del destacado vigente; si ya venció, cuentan desde hoy", () => {
    expect(nuevoHasta(null, 7, ahora).getTime()).toBe(ahora + 7 * DIA)
    expect(nuevoHasta(new Date(ahora + 3 * DIA).toISOString(), 7, ahora).getTime()).toBe(ahora + 10 * DIA)
    expect(nuevoHasta(new Date(ahora - 3 * DIA).toISOString(), 30, ahora).getTime()).toBe(ahora + 30 * DIA)
  })

  // knex de mentira: lo justo para seguir el flujo del aviso de pago
  function knexFalso(pedido: any) {
    const estado = { pedido: { ...pedido }, sellerMeta: {} as any, actualizaciones: 0 }
    const tabla = (nombre: string) => {
      const q: any = {
        where: (w: any) => ((q.w = w), q),
        first: async () => (nombre === "seller" ? { metadata: estado.sellerMeta } : estado.pedido.id === q.w.id ? estado.pedido : undefined),
        update: async (cambios: any) => {
          if (q.w.estado && estado.pedido.estado !== q.w.estado) return 0
          Object.assign(estado.pedido, cambios)
          estado.actualizaciones++
          return 1
        },
      }
      return q
    }
    const knex: any = (n: string) => tabla(n)
    knex.raw = async (sql: string, args?: any[]) => {
      if (/UPDATE seller/.test(sql)) estado.sellerMeta = { destacado_disenos_hasta: args![0] }
    }
    knex.fn = { now: () => new Date() }
    knex.transaction = async (f: any) => f(knex)
    return { knex, estado }
  }
  const logger = { info: () => undefined, error: jest.fn() }

  it("con el pago aprobado y el monto exacto activa el destacado una sola vez", async () => {
    const { knex, estado } = knexFalso({ id: "dst_1", seller_id: "sel_1", dias: 7, monto: 199, estado: "pendiente" })
    const pago = { id: 55, status: "approved", currency_id: "MXN", transaction_amount: 199 }
    await pagoDeDestacado(knex, logger, pago, "dst_1")
    expect(estado.pedido.estado).toBe("pagado")
    expect(estado.sellerMeta.destacado_disenos_hasta).toBeTruthy()
    const antes = estado.actualizaciones
    await pagoDeDestacado(knex, logger, pago, "dst_1") // aviso repetido
    expect(estado.actualizaciones).toBe(antes)
  })

  it("no activa con monto distinto ni con pago pendiente", async () => {
    const a = knexFalso({ id: "dst_2", seller_id: "sel_1", dias: 7, monto: 199, estado: "pendiente" })
    await pagoDeDestacado(a.knex, logger, { id: 1, status: "approved", currency_id: "MXN", transaction_amount: 1 }, "dst_2")
    expect(a.estado.pedido.estado).toBe("pendiente")
    const b = knexFalso({ id: "dst_3", seller_id: "sel_1", dias: 7, monto: 199, estado: "pendiente" })
    await pagoDeDestacado(b.knex, logger, { id: 2, status: "pending", currency_id: "MXN", transaction_amount: 199 }, "dst_3")
    expect(b.estado.pedido.estado).toBe("pendiente")
  })
})
