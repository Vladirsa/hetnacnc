import { FILTRO_MANDADAS, cambiosDeAccion, correoDeProveedor, escaparIlike, hoyMx, vistaOrden } from "../proveedor-panel"

const fila = (extra: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  folio: 7,
  estado: "enviada",
  fecha_entrega: "2026-12-01",
  notas: "Entregar en bodega",
  total: "1500.50",
  negocios: { nombre: "Taller Prueba" },
  orden_compra_items: [{ descripcion: "MDF 15mm", unidad: "hoja", cantidad: "10", cantidad_recibida: 0, costo_unitario: "150.05", material_id: "secreto" }],
  ...extra,
})

describe("panel de proveedores", () => {
  it("escapa comodines del ilike para que nadie vea órdenes de otro correo", () => {
    expect(escaparIlike("ana_perez@x.com")).toBe("ana\\_perez@x.com")
    expect(escaparIlike("a%b*@x.com")).toBe("a\\%b@x.com")
  })

  it("sólo acepta cuentas con correo confirmado", () => {
    const nueva = { id: "c1", email: "Prov@X.com", has_account: true, created_at: "2026-11-20T00:00:00Z", metadata: {} }
    expect(correoDeProveedor(nueva)).toBeNull()
    expect(correoDeProveedor({ ...nueva, metadata: { correo_verificado: true } })).toBe("prov@x.com")
    expect(correoDeProveedor(null)).toBeNull()
    // Cuentas de antes de pedir confirmación: misma regla que el resto de la tienda
    expect(correoDeProveedor({ ...nueva, created_at: "2026-01-10T00:00:00Z" })).toBe("prov@x.com")
  })

  it("nunca lee borradores ni órdenes que no se mandaron", () => {
    expect(FILTRO_MANDADAS).toContain("enviada_en=not.is.null")
    expect(FILTRO_MANDADAS).not.toContain("borrador")
  })

  it("la vista no expone el inventario del taller", () => {
    const v = vistaOrden(fila(), true)
    expect(v.folio).toBe("OC-7")
    expect(v.taller).toBe("Taller Prueba")
    expect(v.total).toBe(1500.5)
    expect(JSON.stringify(v)).not.toContain("secreto")
    expect(v.puede_confirmar).toBe(true)
    expect(v.puede_marcar_enviada).toBe(true)
  })

  it("sin el SQL nuevo, o con la orden cerrada, no hay botones", () => {
    expect(vistaOrden(fila(), false).puede_confirmar).toBe(false)
    expect(vistaOrden(fila({ estado: "recibida" }), true).puede_confirmar).toBe(false)
    expect(vistaOrden(fila({ proveedor_enviada_en: "2026-11-23T00:00:00Z" }), true).puede_marcar_enviada).toBe(false)
  })

  it("confirmar pide una fecha que no sea pasada", () => {
    const ahora = new Date("2026-11-23T18:00:00Z")
    const o = vistaOrden(fila(), true)
    expect(() => cambiosDeAccion({ accion: "confirmar", fecha_compromiso: "2026-11-01" }, o, ahora)).toThrow(/pasado/)
    expect(() => cambiosDeAccion({ accion: "confirmar", fecha_compromiso: "mañana" }, o, ahora)).toThrow(/fecha/)
    const c = cambiosDeAccion({ accion: "confirmar", fecha_compromiso: hoyMx(ahora), nota: "Listo" }, o, ahora)
    expect(c).toMatchObject({ proveedor_fecha_compromiso: "2026-11-23", proveedor_nota: "Listo" })
  })

  it("marcar enviada también la confirma si no estaba", () => {
    const ahora = new Date("2026-11-23T18:00:00Z")
    const c = cambiosDeAccion({ accion: "enviada" }, vistaOrden(fila(), true), ahora)
    expect(c.proveedor_enviada_en).toBe(ahora.toISOString())
    expect(c.proveedor_confirmada_en).toBe(ahora.toISOString())
    expect(() => cambiosDeAccion({ accion: "enviada" }, vistaOrden(fila({ estado: "cancelada" }), true), ahora)).toThrow()
  })
})
