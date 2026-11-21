import { validarEmpresa } from "../cliente-empresa"

describe("datos de empresa del cliente", () => {
  it("acepta RFC de empresa y de persona física", () => {
    expect(validarEmpresa({ razon_social: "Herrería del Bajío SA de CV", rfc: "hba 010101 ab1" }).rfc).toBe("HBA010101AB1")
    expect(validarEmpresa({ razon_social: "Juan Pérez López", rfc: "PELJ800101XX1", cp: "72000" }).cp).toBe("72000")
  })
  it("rechaza datos inválidos", () => {
    expect(() => validarEmpresa({ razon_social: "AB", rfc: "HBA010101AB1" })).toThrow(/razón social/)
    expect(() => validarEmpresa({ razon_social: "Empresa", rfc: "123" })).toThrow(/RFC/)
    expect(() => validarEmpresa({ razon_social: "Empresa", rfc: "HBA010101AB1", cp: "72" })).toThrow(/postal/)
  })
})
