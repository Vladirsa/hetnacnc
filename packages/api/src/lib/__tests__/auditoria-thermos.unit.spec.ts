// Auditoría Thermos del 15 nov 2026: llaves de archivos y metadata protegida.
import { llaveDeProductoValida } from "../archivo-seguro"
import { blindarProducto } from "../../api/vendor/hetna-producto-protegido/middlewares"

describe("llaveDeProductoValida", () => {
  it("acepta archivos de productos", () => {
    expect(llaveDeProductoValida("libros/sel_1/0123456789abcdef.pdf")).toBe(true)
    expect(llaveDeProductoValida("fabrica/diseno-123.dxf")).toBe(true)
  })
  it("rechaza planos y documentos privados", () => {
    for (const k of ["solicitudes/abc/plano.dxf", "propuestas/x.pdf", "facturas/1.xml", "cloud/s/1.stl", "certificaciones/c.pdf", "avances/f.jpg", "guias/g.pdf"]) {
      expect(llaveDeProductoValida(k)).toBe(false)
    }
  })
  it("rechaza rutas raras y valores vacíos", () => {
    for (const k of ["", "../solicitudes/x", "/etc/passwd", "libros\\x", 42, null, undefined]) {
      expect(llaveDeProductoValida(k)).toBe(false)
    }
  })
})

describe("blindarProducto", () => {
  it("un producto nuevo no puede traer llaves de HETNA", () => {
    const out = blindarProducto({ archivo_storage_key: "libros/x/1.pdf", archivo_gratis: true, producto_digital: true, precio_mxn: 1, color: "rojo" }, {})
    expect(out).toEqual({ color: "rojo" })
  })
  it("al editar se conservan los valores guardados", () => {
    const guardada = { archivo_storage_key: "libros/s/a.pdf", producto_digital: true }
    const out = blindarProducto({ archivo_storage_key: "solicitudes/otro.dxf", producto_digital: false, archivo_gratis: true, x: 1 }, guardada)
    expect(out).toEqual({ archivo_storage_key: "libros/s/a.pdf", producto_digital: true, x: 1 })
  })
})
