import { limpiarRespuesta } from "../../api/store/proteger-vendedores"

describe("la tienda no muestra datos privados del taller", () => {
  const taller = {
    id: "sel_1", name: "Taller X", handle: "taller-x", email: "t@x.mx", phone: "222", payment_details: [{ account_number: "123" }],
    metadata: { perfil: { calificacion: 5 }, verificado: true, terminos_ip: "1.2.3.4", tarjeta: { ultimos4: "4242" }, correo_confirmado_email: "t@x.mx", consentimiento_bancario_en: "2026" },
  }
  it("limpia /store/sellers", () => {
    const r = limpiarRespuesta({ sellers: [taller] }) as any
    const s = r.sellers[0]
    expect(s.email).toBeUndefined()
    expect(s.phone).toBeUndefined()
    expect(s.payment_details).toBeUndefined()
    expect(s.metadata).toEqual({ perfil: { calificacion: 5 }, verificado: true })
    expect(s.name).toBe("Taller X")
  })
  it("limpia el taller dentro de productos y ofertas", () => {
    const r = limpiarRespuesta({ products: [{ id: "p", metadata: { email_contacto: "ok" }, seller: taller }], offers: [{ seller: taller }] }) as any
    expect(r.products[0].seller.email).toBeUndefined()
    expect(r.products[0].metadata.email_contacto).toBe("ok")
    expect(r.offers[0].seller.metadata.terminos_ip).toBeUndefined()
  })
})
