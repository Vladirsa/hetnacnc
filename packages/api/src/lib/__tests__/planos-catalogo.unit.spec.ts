jest.mock("../fabrica", () => ({ subir: jest.fn() }))
import { VARIANTES_PLANO, descripcionPlano, handlePlano, skuPlano } from "../planos-catalogo"

const plano = {
  slug: "librero-bajo", nombre: "Librero bajo", categoria: "Casa", resumen: "Librero <b>bajo</b>", descripcion: "Mueble",
  nivel: "Fácil", horas: "3 a 4 h", herrajes: ["Tornillos"], medidas_mm: { ancho: 1000, fondo: 300, alto: 818 },
  paquete_cm: { largo: 104, ancho: 34, alto: 12 }, peso_kg: 19.2, piezas: 7, hojas: 2, dias_fabricacion: 3,
  precios: { lijado: 1400, sellado: 1700, pintura: 2000 }, imagenes: [],
}

describe("productos de planos", () => {
  it("una variante por acabado y color, con SKU único", () => {
    const skus = VARIANTES_PLANO.map((v) => skuPlano(plano.slug, v.codigo))
    expect(new Set(skus).size).toBe(VARIANTES_PLANO.length)
    expect(handlePlano("librero-bajo")).toBe("plano-librero-bajo")
  })
  it("la descripción escapa el texto y liga al plano gratis", () => {
    const html = descripcionPlano(plano)
    expect(html).not.toContain("<b>bajo</b>")
    expect(html).toContain("/mx/planos/librero-bajo")
    expect(html).toContain("7 piezas")
  })
})
