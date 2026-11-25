import { calcularDecision, formatoEvidencia, opcionesCliente, revisarContacto, sumarDiasHabiles } from "../reclamos-pedido"

const DIA = 864e5
const ahora = new Date("2026-11-25T18:00:00Z").getTime()
const fila = (x: Partial<{ estado: string; digital: boolean; entregado_en: any; aceptado_en: any }> = {}) => ({
  estado: "pendiente",
  digital: false,
  entregado_en: null,
  aceptado_en: null,
  ...x,
})

describe("Liberar pago y reclamos de compras", () => {
  it("antes de salir del taller no se puede liberar, pero sí reportar que no llegó", () => {
    const o = opcionesCliente(fila(), { enviado: false, hayReclamo: false }, ahora)
    expect(o.puede_liberar).toBe(false)
    expect(o.motivos).toContain("no_llego")
  })

  it("enviado o entregado: puede liberar y reclamar cualquier motivo hasta el día 7", () => {
    const o = opcionesCliente(fila({ entregado_en: new Date(ahora - 5 * DIA) }), { enviado: true, hayReclamo: false }, ahora)
    expect(o.puede_liberar).toBe(true)
    expect(o.motivos).toEqual(expect.arrayContaining(["danado", "arrepentimiento", "no_llego"]))
  })

  it("opción C: liberado solo a los 3 días, todavía puede reclamar hasta el día 7 (pero ya no liberar)", () => {
    const o = opcionesCliente(fila({ estado: "disponible", entregado_en: new Date(ahora - 5 * DIA) }), { enviado: true, hayReclamo: false }, ahora)
    expect(o.puede_liberar).toBe(false)
    expect(o.motivos).toContain("danado")
  })

  it("después del día 7 sólo queda la garantía", () => {
    const o = opcionesCliente(fila({ estado: "pagado", entregado_en: new Date(ahora - 10 * DIA) }), { enviado: true, hayReclamo: false }, ahora)
    expect(o.motivos).toEqual(["defecto"])
  })

  it("si el cliente liberó, aceptó que llegó bien: sólo garantía", () => {
    const o = opcionesCliente(
      fila({ estado: "disponible", entregado_en: new Date(ahora - DIA), aceptado_en: new Date(ahora - DIA) }),
      { enviado: true, hayReclamo: false },
      ahora
    )
    expect(o).toEqual({ puede_liberar: false, motivos: ["defecto"] })
  })

  it("con reclamo abierto o pedido digital no hay botones", () => {
    expect(opcionesCliente(fila(), { enviado: true, hayReclamo: true }, ahora).motivos).toEqual([])
    expect(opcionesCliente(fila({ digital: true }), { enviado: true, hayReclamo: false }, ahora).puede_liberar).toBe(false)
  })

  const saldo = (estado: string) => ({ estado, productos: 1000, envio: 150, comision: 100, envio_al_taller: true })

  it("liberar: el taller cobra; si la guía la pagó él, se le descuenta", () => {
    expect(calcularDecision({ decision: "liberar", guiaPaga: "cliente" }, saldo("retenido"))).toEqual({ estadoSaldo: "disponible", descuento: 0, monto: 0 })
    expect(calcularDecision({ decision: "liberar", guiaPaga: "taller", costoGuia: 180 }, saldo("retenido")).descuento).toBe(180)
  })

  it("reembolso total: retenido no se paga; ya pagado se descuenta lo que recibió, más la guía", () => {
    expect(calcularDecision({ decision: "reembolso_total", guiaPaga: "taller", costoGuia: 0 }, saldo("retenido"))).toEqual({
      estadoSaldo: "retenido",
      descuento: 0,
      monto: 1150,
    })
    expect(calcularDecision({ decision: "reembolso_total", guiaPaga: "taller", costoGuia: 200 }, saldo("pagado"))).toEqual({
      estadoSaldo: null,
      descuento: 1050 + 200,
      monto: 1150,
    })
  })

  it("reembolso parcial: se libera el pago y se descuenta sólo el monto (topado a lo cobrado)", () => {
    expect(calcularDecision({ decision: "reembolso_parcial", monto: 300, guiaPaga: "cliente" }, saldo("retenido"))).toEqual({
      estadoSaldo: "disponible",
      descuento: 300,
      monto: 300,
    })
    expect(calcularDecision({ decision: "reembolso_parcial", monto: 99999, guiaPaga: "cliente" }, saldo("pagado")).monto).toBe(1150)
  })

  it("plazo del taller: 3 días hábiles (salta fin de semana)", () => {
    // Jueves 26 nov 2026, 12:00 en CDMX -> martes 1 dic
    const f = sumarDiasHabiles(new Date("2026-11-26T18:00:00Z"), 3)
    expect(f.toISOString().slice(0, 10)).toBe("2026-12-01")
  })

  it("evidencia: se reconoce por sus bytes (foto o video), no por el nombre", () => {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)])
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(40)])
    const mov = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from("ftypqt  "), Buffer.alloc(40)])
    const html = Buffer.from("<html><script>alert(1)</script></html>")
    expect(formatoEvidencia(jpg)?.mime).toBe("image/jpeg")
    expect(formatoEvidencia(mp4)?.mime).toBe("video/mp4")
    expect(formatoEvidencia(mov)?.mime).toBe("video/quicktime")
    expect(formatoEvidencia(html)).toBeNull()
  })

  it("sin datos de contacto, pero los números de guía sí pasan", () => {
    expect(() => revisarContacto("Llegó roto, la guía 7894561230123 dice entregado")).not.toThrow()
    expect(() => revisarContacto("escríbeme a juan@gmail.com y lo arreglamos")).toThrow()
  })
})
