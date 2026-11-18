import {
  ajusteSobrepesoId,
  decidirSobrepeso,
  esAjuste,
  estadoAlLiberar,
  filaAjusteSobrepeso,
  netoTaller,
} from "../saldos-talleres"
import { mesCerradoMx, ventanaMesMx } from "../cotizador-facturacion"
import { diaMx } from "../centro-control"

const sob = { id: "sob_1", folio: 12, responsable_id: "sel_1", monto: "150.50", referencia: "Pedido #88" }

describe("Sobrepeso descontado del pago al taller", () => {
  it("el renglón del saldo resta el monto y ya cuenta como disponible", () => {
    const f = filaAjusteSobrepeso(sob)
    expect(f.order_id).toBe("sobrepeso:sob_1")
    expect(f.seller_id).toBe("sel_1")
    expect(f.estado).toBe("disponible")
    expect(f.moneda).toBe("mxn")
    expect(netoTaller(f)).toBe(-150.5)
    expect(f.motivo).toBe("Sobrepeso SOB-00012 (Pedido #88)")
  })

  it("el monto siempre resta, aunque llegue negativo", () => {
    expect(netoTaller(filaAjusteSobrepeso({ ...sob, monto: -80 }))).toBe(-80)
  })

  it("con poco disponible el saldo queda negativo (se arrastra al siguiente pago)", () => {
    const venta = { productos: 100, comision: 6, envio: 0, envio_al_taller: false }
    const total = netoTaller(venta) + netoTaller(filaAjusteSobrepeso(sob))
    expect(Math.round(total * 100) / 100).toBe(-56.5)
  })

  it("distingue los descuentos de las ventas", () => {
    expect(esAjuste(ajusteSobrepesoId("sob_9"))).toBe(true)
    expect(esAjuste("order_01ABC")).toBe(false)
  })

  it("marcar descontado descuenta una sola vez", () => {
    expect(decidirSobrepeso("por_cobrar", "descontado", null)).toEqual({ tipo: "descontar" })
    expect(decidirSobrepeso("en_disputa", "descontado", null)).toEqual({ tipo: "descontar" })
    // doble clic: ya está descontado
    expect(decidirSobrepeso("descontado", "descontado", "disponible")).toEqual({ tipo: "nada" })
  })

  it("anular devuelve el descuento sólo si aún no se pagó", () => {
    expect(decidirSobrepeso("descontado", "anular", "disponible")).toEqual({ tipo: "devolver" })
    expect(decidirSobrepeso("descontado", "anular", "pagado")?.tipo).toBe("bloqueado")
  })

  it("los descontados de antes (sin renglón) sólo cambian de estado: nunca se acreditan ni se descuentan otra vez", () => {
    expect(decidirSobrepeso("descontado", "anular", null)).toEqual({ tipo: "solo_estado" })
    expect(decidirSobrepeso("descontado", "descontado", null)).toEqual({ tipo: "nada" })
  })

  it("ya descontado no se puede volver a cobrar, disputar ni marcar pagado", () => {
    for (const a of ["cobrar", "disputar", "pagado"]) expect(decidirSobrepeso("descontado", a, "disponible")?.tipo).toBe("bloqueado")
    expect(decidirSobrepeso("descontado", "cobrar", null)?.tipo).toBe("bloqueado")
  })

  it("las demás acciones no tocan el saldo", () => {
    expect(decidirSobrepeso("por_cobrar", "cobrar", null)).toBeNull()
    expect(decidirSobrepeso("en_disputa", "anular", null)).toBeNull()
  })
})

describe("Liberar un pedido retenido", () => {
  it("lo digital vuelve a disponible; lo físico a pendiente (la tarea lo libera a su plazo)", () => {
    expect(estadoAlLiberar({ digital: true })).toBe("disponible")
    expect(estadoAlLiberar({ digital: false })).toBe("pendiente")
  })
})

describe("Factura global a mano", () => {
  it("el mes va de medianoche a medianoche del centro de México", () => {
    const { desde, hasta } = ventanaMesMx(2026, 10)
    expect(desde.toISOString()).toBe("2026-10-01T06:00:00.000Z")
    expect(hasta.toISOString()).toBe("2026-11-01T06:00:00.000Z")
    expect(ventanaMesMx(2026, 12).hasta.toISOString()).toBe("2027-01-01T06:00:00.000Z")
  })

  it("sólo se emite con el mes cerrado en México", () => {
    expect(mesCerradoMx(2026, 10, new Date("2026-11-01T05:59:00Z"))).toBe(false) // 31 oct, 23:59 en CDMX
    expect(mesCerradoMx(2026, 10, new Date("2026-11-01T06:00:00Z"))).toBe(true)
    expect(mesCerradoMx(2026, 11, new Date("2026-11-18T12:00:00Z"))).toBe(false)
    expect(mesCerradoMx(2026, 12, new Date("2026-11-18T12:00:00Z"))).toBe(false)
  })
})

describe("Ventas por día en hora de México", () => {
  it("una venta de la noche cuenta en el día de México, no en el de UTC", () => {
    expect(diaMx("2026-11-18T03:30:00Z")).toBe("2026-11-17") // 21:30 del 17 en CDMX
    expect(diaMx("2026-11-18T06:00:00Z")).toBe("2026-11-18")
    expect(diaMx(new Date("2026-11-18T23:59:00Z"))).toBe("2026-11-18")
  })
})
