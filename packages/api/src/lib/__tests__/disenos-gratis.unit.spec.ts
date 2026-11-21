jest.mock("../social-telegram", () => ({ mandarPrivado: jest.fn() }))
jest.mock("../centro-control", () => ({ ADMIN: "x" }))
jest.mock("../publicar-diseno", () => ({ publicarDiseno: jest.fn() }))
jest.mock("../subir-disenos", () => ({ guardarArchivo: jest.fn(), nuevoSku: jest.fn(), prepararImagen: jest.fn(), proponerFicha: jest.fn(), slug: (s: string) => s }))

import { licenciaAceptable, limpiarSvg } from "../disenos-gratis"

describe("diseños gratis", () => {
  it("sólo licencias que permiten uso comercial y redistribución", () => {
    expect(licenciaAceptable("Public domain", "pd")).toBe("Dominio público")
    expect(licenciaAceptable("CC0", "cc0")).toBe("CC0")
    expect(licenciaAceptable("CC BY 4.0", "cc-by-4.0")).toBe("CC BY 4.0")
    expect(licenciaAceptable("CC BY-SA 3.0", "cc-by-sa-3.0")).toBe("CC BY-SA 3.0")
    expect(licenciaAceptable("CC BY-NC 4.0", "cc-by-nc-4.0")).toBeNull()
    expect(licenciaAceptable("CC BY-ND 4.0", "cc-by-nd-4.0")).toBeNull()
    expect(licenciaAceptable("Fair use", "")).toBeNull()
    expect(licenciaAceptable("", "")).toBeNull()
  })
  it("limpia el SVG y rechaza lo que no es dibujo", () => {
    const sucio = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0L10 10" onclick="x()"/><a href="https://malo.com">x</a></svg>'
    const limpio = limpiarSvg(sucio)!
    expect(limpio).toContain("<path")
    expect(limpio).not.toMatch(/script|onclick|malo\.com/)
    expect(limpiarSvg("<html>no</html>")).toBeNull()
    expect(limpiarSvg('<svg><text>sólo texto</text></svg>')).toBeNull()
  })
})
