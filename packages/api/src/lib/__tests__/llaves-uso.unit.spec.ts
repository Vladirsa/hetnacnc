import { _pendientesParaPruebas, anotarUso, llavePermitida, modoCerrar, patronRuta } from "../llaves-uso"

describe("uso de llaves API", () => {
  it("cambia los ids de la ruta por :id", () => {
    expect(patronRuta("/admin/orders/order_01JABCDEFGHJKMNPQRSTVWXYZ0?fields=x")).toBe("/admin/orders/:id")
    expect(patronRuta("/admin/hetna-solicitudes/3f2b8c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/accion")).toBe("/admin/hetna-solicitudes/:id/accion")
    expect(patronRuta("/admin/hetna-whatsapp/525512345678")).toBe("/admin/hetna-whatsapp/:id")
    expect(patronRuta("/admin/hetna-social/")).toBe("/admin/hetna-social")
  })

  it("junta las peticiones iguales en memoria", () => {
    const p = _pendientesParaPruebas()
    p.clear()
    anotarUso("apk_1", "GET", "/admin/orders/order_01JABCDEFGHJKMNPQRSTVWXYZ0", 200)
    anotarUso("apk_1", "GET", "/admin/orders/order_01JZZZZZZZZZZZZZZZZZZZZZZZ9", 404)
    anotarUso("apk_1", "POST", "/admin/hetna-social", 200)
    expect(p.size).toBe(2)
    const g = p.get("apk_1|GET|/admin/orders/:id")!
    expect(g.veces).toBe(2)
    expect(g.estado).toBe(404)
    p.clear()
  })

  it("modo cerrar: sólo lo permitido; si la lista no se lee, deja pasar", () => {
    expect(modoCerrar("cerrar")).toBe(true)
    expect(modoCerrar(" Cerrar ")).toBe(true)
    expect(modoCerrar("")).toBe(false)
    expect(modoCerrar(undefined)).toBe(false)
    const mapa = new Map([["apk_1", new Set(["GET /admin/orders/:id"])]])
    expect(llavePermitida(mapa, "apk_1", "GET", "/admin/orders/:id")).toBe(true)
    expect(llavePermitida(mapa, "apk_1", "POST", "/admin/orders/:id")).toBe(false)
    expect(llavePermitida(mapa, "apk_2", "GET", "/admin/orders/:id")).toBe(false)
    expect(llavePermitida(null, "apk_2", "GET", "/admin/x")).toBe(true)
  })
})
