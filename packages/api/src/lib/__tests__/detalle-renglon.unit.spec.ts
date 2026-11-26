import { detalleRenglon } from "../detalle-renglon"

describe("lo que eligió el cliente en el renglón", () => {
  it("colores por parte, o el color único, y el texto", () => {
    expect(detalleRenglon({ colores: { Placa: "Rojo", Letras: "Blanco" }, texto: "Sofi" })).toEqual([["Placa", "Rojo"], ["Letras", "Blanco"], ["Texto", "«Sofi»"]])
    expect(detalleRenglon({ color: "Negro" })).toEqual([["Color", "Negro"]])
    expect(detalleRenglon(null)).toEqual([])
  })
  it("ignora valores raros y recorta", () => {
    expect(detalleRenglon({ colores: ["Rojo"], color: 5, texto: { a: 1 } })).toEqual([])
    expect(detalleRenglon({ colores: { Placa: 3, Letras: "x".repeat(60) } })[0][1]).toHaveLength(24)
  })
})
