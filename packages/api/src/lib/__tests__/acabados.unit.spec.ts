import { acabadosDelPerfil, acabadosPedidos, haceAcabados } from "../acabados"

describe("acabados de los talleres", () => {
  it("lee lo que pide el cliente del campo y de la descripción", () => {
    expect(acabadosPedidos("Pintura electrostática", "")).toEqual(["pintura_electrostatica"])
    expect(acabadosPedidos("Sin acabado (tal como sale de la máquina)", "")).toEqual([])
    expect(acabadosPedidos("", "placa de acero con 4 barrenos roscados y doblez a 90°")).toEqual(["doblez", "roscado"])
    expect(acabadosPedidos("Pintura o barniz", "")).toEqual(["pintura"])
  })
  it("sabe si un taller hace los acabados pedidos", () => {
    const perfil = { acabados: [{ clave: "doblez", precio: "$15 por doblez" }, "roscado", { clave: "inventado" }] }
    expect(acabadosDelPerfil(perfil)).toEqual([{ clave: "doblez", precio: "$15 por doblez" }, { clave: "roscado" }])
    expect(haceAcabados(perfil, ["doblez", "roscado"])).toBe(true)
    expect(haceAcabados(perfil, ["doblez", "pintura"])).toBe(false)
    expect(haceAcabados(perfil, [])).toBe(false)
  })
})
