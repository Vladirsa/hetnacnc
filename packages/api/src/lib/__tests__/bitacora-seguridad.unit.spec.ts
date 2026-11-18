import { rutaLimpia, tipoDeLogin } from "../bitacora-seguridad"

describe("Bitácora de seguridad", () => {
  it("reconoce los inicios de sesión con contraseña y nada más", () => {
    expect(tipoDeLogin("POST", "/auth/user/emailpass")).toBe("user")
    expect(tipoDeLogin("POST", "/auth/customer/emailpass?x=1")).toBe("customer")
    expect(tipoDeLogin("POST", "/auth/seller/emailpass/")).toBe("seller")
    expect(tipoDeLogin("GET", "/auth/user/emailpass")).toBeNull()
    expect(tipoDeLogin("POST", "/auth/user/emailpass/reset-password")).toBeNull()
    expect(tipoDeLogin("POST", "/auth/session")).toBeNull()
  })

  it("no guarda la consulta de la ruta (puede traer tokens)", () => {
    expect(rutaLimpia("/admin/orders/order_1?token=secreto")).toBe("/admin/orders/order_1")
    expect(rutaLimpia("/admin/" + "x".repeat(400)).length).toBe(200)
  })
})
