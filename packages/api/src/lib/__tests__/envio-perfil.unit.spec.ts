import { perfilValido } from "../../api/store/envio-perfil/middlewares"

describe("Envío que corresponde al producto", () => {
  const ofertas = [
    { seller_id: "s1", shipping_profile_id: "fisico" },
    { seller_id: "s2", shipping_profile_id: "digital" },
  ]
  it("no deja Entrega digital para el producto físico del taller", () => {
    expect(perfilValido({ shipping_profile_id: "digital", seller_ids: ["s1"] }, ofertas)).toBe(false)
    expect(perfilValido({ shipping_profile_id: "fisico", seller_ids: ["s1"] }, ofertas)).toBe(true)
  })
  it("cada taller con su propio perfil", () => {
    expect(perfilValido({ shipping_profile_id: "digital", seller_ids: ["s2"] }, ofertas)).toBe(true)
    expect(perfilValido({ shipping_profile_id: "fisico", seller_ids: ["s2"] }, ofertas)).toBe(false)
  })
  it("si no se sabe, deja pasar (lo valida Mercur al completar)", () => {
    expect(perfilValido({ shipping_profile_id: null, seller_ids: ["s1"] }, ofertas)).toBe(true)
    expect(perfilValido({ shipping_profile_id: "fisico", seller_ids: ["s3"] }, ofertas)).toBe(true)
    expect(perfilValido({ shipping_profile_id: "fisico", seller_ids: [] }, ofertas)).toBe(true)
  })
})
