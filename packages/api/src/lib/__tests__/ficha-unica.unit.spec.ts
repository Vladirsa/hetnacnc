import { interpretarBusqueda, ligasAccion, siguientesAcciones, ultimos10, type Ficha } from "../ficha-unica"

const vacia = (extra: Partial<Ficha> = {}): Ficha => ({
  claves: { correos: ["ana@x.com"], telefonos: ["5512345678"] },
  varias_personas: false,
  clientes: [{ id: "cus_1", nombre: "Ana López", email: "ana@x.com", telefono: "5512345678", creado: "2026-01-01T00:00:00Z", correo_verificado: true }],
  pedidos: { cuantos: 0, gastado: {}, ultimo: null, recientes: [] },
  carritos: [], creditos: null, reputacion: null, licitaciones: [], escanear: [], talleres: [], cotizador: [], proveedor: null,
  whatsapp: { numeros: [{ numero: "525512345678", quien: "cliente", avisos: true, verificado: true }], mensajes: [] },
  errores: [],
  ...extra,
})
const AHORA = new Date("2026-11-23T18:00:00Z").getTime()

describe("Ficha única", () => {
  it("entiende si buscas correo, teléfono o nombre", () => {
    expect(interpretarBusqueda(" Ana@X.com ")).toEqual({ tipo: "correo", valor: "ana@x.com" })
    expect(interpretarBusqueda("+52 1 (55) 1234-5678")).toEqual({ tipo: "telefono", valor: "5512345678" })
    expect(interpretarBusqueda("Taller López")).toEqual({ tipo: "nombre", valor: "Taller López" })
    expect(interpretarBusqueda("ab")).toBeNull()
    expect(interpretarBusqueda("no-es@correo")).toBeNull()
    expect(ultimos10("521 55 1234 5678")).toBe("5512345678")
  })

  it("propone recordar un carrito sin terminar con mensaje listo", () => {
    const f = vacia({ carritos: [{ id: "cart_1", email: "ana@x.com", total: 1200, moneda: "mxn", actualizado: "2026-11-21T18:00:00Z", articulos: ["1× MDF 15 mm"] }] })
    const [a] = siguientesAcciones(f, AHORA)
    expect(a.clave).toBe("carrito")
    expect(a.mensaje).toContain("Hola Ana")
    const l = ligasAccion(a)
    expect(l.whatsapp).toMatch(/^https:\/\/wa\.me\/525512345678\?text=/)
    expect(l.correo).toMatch(/^mailto:ana@x\.com\?subject=/)
  })

  it("no ofrece WhatsApp a quien pidió BAJA", () => {
    const f = vacia({
      whatsapp: { numeros: [{ numero: "525512345678", quien: "cliente", avisos: false, verificado: true }], mensajes: [] },
      carritos: [{ id: "cart_1", email: "ana@x.com", total: 500, moneda: "mxn", actualizado: "2026-11-22T18:00:00Z", articulos: ["1× Acrílico"] }],
    })
    const acciones = siguientesAcciones(f, AHORA)
    expect(acciones[0].clave).toBe("baja_whatsapp")
    const carrito = acciones.find((a) => a.clave === "carrito")!
    expect(carrito.whatsapp).toBeNull()
    expect(ligasAccion(carrito).whatsapp).toBeNull()
    expect(carrito.correo).toBe("ana@x.com")
  })

  it("con dos números y BAJA en uno, nada por WhatsApp", () => {
    const f = vacia({
      whatsapp: { numeros: [{ numero: "525512345678", quien: "cliente", avisos: false, verificado: true }, { numero: "525598765432", quien: null, avisos: true, verificado: false }], mensajes: [] },
      carritos: [{ id: "cart_1", email: "ana@x.com", total: 500, moneda: "mxn", actualizado: "2026-11-22T18:00:00Z", articulos: ["1× Acrílico"] }],
    })
    const carrito = siguientesAcciones(f, AHORA).find((a) => a.clave === "carrito")!
    expect(carrito.whatsapp).toBeNull()
  })

  it("si junta a varias personas, no arma mensajes", () => {
    const f = vacia({
      varias_personas: true,
      claves: { correos: ["ana@x.com", "beto@y.com"], telefonos: ["5512345678"] },
      carritos: [{ id: "cart_1", email: "beto@y.com", total: 500, moneda: "mxn", actualizado: "2026-11-22T18:00:00Z", articulos: ["1× Acrílico"] }],
    })
    const a = siguientesAcciones(f, AHORA)
    expect(a[0].clave).toBe("varias_personas")
    for (const x of a) expect(ligasAccion(x)).toEqual({ whatsapp: null, correo: null })
  })

  it("el carrito se le escribe al correo del carrito", () => {
    const f = vacia({ carritos: [{ id: "cart_1", email: "otro@x.com", total: 500, moneda: "mxn", actualizado: "2026-11-22T18:00:00Z", articulos: ["1× Acrílico"] }] })
    expect(siguientesAcciones(f, AHORA).find((a) => a.clave === "carrito")!.correo).toBe("otro@x.com")
  })

  it("no recuerda un carrito si ya compró después", () => {
    const f = vacia({
      pedidos: { cuantos: 1, gastado: { mxn: 900 }, ultimo: "2026-11-22T00:00:00Z", recientes: [] },
      carritos: [{ id: "cart_1", email: null, total: 900, moneda: "mxn", actualizado: "2026-11-21T00:00:00Z", articulos: ["1× MDF"] }],
    })
    expect(siguientesAcciones(f, AHORA).find((a) => a.clave === "carrito")).toBeUndefined()
  })

  it("acciones internas sin mensaje: licitación sin propuestas y pago al taller", () => {
    const f = vacia({
      licitaciones: [{ folio: "HET-00012", estado: "abierta", creado: "2026-11-18T00:00:00Z", descripcion: "Letrero", propuestas: 0, elegida: false, liga: null }],
      talleres: [{ id: "sel_1", nombre: "Taller X", email: null, telefono: null, estado: "open", saldos: { mxn: { pendiente: 0, disponible: 1500, pagado: 0, retenido: 0 } }, propuestas: {}, resenas: { promedio: null, cuantas: 0 } }],
    })
    const a = siguientesAcciones(f, AHORA)
    const lic = a.find((x) => x.clave.startsWith("licitacion_sin"))!
    expect(lic.mensaje).toBeNull()
    expect(lic.liga).toBe("/dashboard/solicitudes")
    const pago = a.find((x) => x.clave.startsWith("pagar_"))!
    expect(pago.titulo).toContain("$1,500")
    expect(ligasAccion(pago)).toEqual({ whatsapp: null, correo: null })
  })

  it("prueba del Cotizador por vencer y cliente que no vuelve", () => {
    const f = vacia({
      cotizador: [{ id: "n1", nombre: "Taller Ana", correo: "ana@x.com", telefono: null, plan: "prueba", plan_efectivo: "prueba", trial_hasta: "2026-11-25T00:00:00Z", creado: "2026-11-01T00:00:00Z" }],
      pedidos: { cuantos: 3, gastado: { mxn: 5000 }, ultimo: "2026-06-01T00:00:00Z", recientes: [] },
    })
    const claves = siguientesAcciones(f, AHORA).map((a) => a.clave)
    expect(claves).toContain("prueba_n1")
    expect(claves).toContain("volver")
  })
})
