// Ficha universal de producto (21 nov 2026): la lógica de la tienda
// (apps/storefront/src/lib/hetna/tipo-producto.ts), lo que guarda el panel
// del taller (ficha-extendida) y la limpieza de la plantilla de publicar.
import path from "path"
import { ErrorFicha, leerFicha, validarFicha } from "../ficha-extendida"
import { descripcionAHtml } from "../publicar-rapido"

// Se carga en tiempo de prueba (como panel-roles): un import directo saca a
// tsc del rootDir del API.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tienda = require(path.resolve(__dirname, "../../../../../apps/storefront/src/lib/hetna/tipo-producto"))
const { datosClave, especificaciones, limpiarDescripcion, notaPrecio, tipoProducto } = tienda as Record<string, (...a: any[]) => any>

const base = { compatibilidad: [], videos: [], archivos: [], faq: [] }

describe("tipo de producto", () => {
  it("digital y servicio salen de tipo-ficha", () => {
    expect(tipoProducto({ metadata: { producto_digital: true } })).toBe("digital")
    expect(tipoProducto({ metadata: { hetna_cam_service: "cam_3" } })).toBe("servicio")
  })
  it("el que eligió el taller manda", () => {
    expect(tipoProducto({ metadata: { tipo_producto: "a_medida" } })).toBe("a_medida")
    expect(tipoProducto({ metadata: { tipo_producto: "herramienta" }, categories: [{ name: "Madera y MDF" }] })).toBe("herramienta")
  })
  it("si no eligió, se deduce de la categoría; si no, producto físico", () => {
    expect(tipoProducto({ categories: [{ name: "Fresas y brocas" }] })).toBe("herramienta")
    expect(tipoProducto({ categories: [{ name: "Corte láser en acrílico" }] })).toBe("corte")
    expect(tipoProducto({ categories: [{ name: "Madera y MDF" }] })).toBe("tallado")
    expect(tipoProducto({})).toBe("stock")
  })
})

describe("descripción sin huecos de la plantilla", () => {
  // Lo que se publicó en la tabla de pino: "Qué incluye: --"
  const vieja = "<p>Material: Pino</p><p>Medidas: 25x15 cm</p><p>Qué incluye:</p><p>-</p><p>-</p><p>Para qué sirve: Para regalo,</p>"
  it("quita la etiqueta vacía y los guiones sueltos", () => {
    const h = limpiarDescripcion(vieja)
    expect(h).not.toMatch(/Qué incluye/)
    expect(h).not.toMatch(/<p>-<\/p>/)
    expect(h).toMatch(/Material: Pino/)
  })
  it("conserva una etiqueta que sí tiene lista abajo", () => {
    expect(limpiarDescripcion("<p>Qué incluye:</p><ul><li>Tabla</li></ul>")).toMatch(/Qué incluye/)
  })
  it("al publicar ya no se guardan los renglones vacíos", () => {
    const h = descripcionAHtml("Material: Pino\nMedidas: \nQué incluye:\n- \n- \nPara qué sirve: Regalo")
    expect(h).not.toMatch(/Qué incluye/)
    expect(h).not.toMatch(/<p>-<\/p>/)
    expect(h).toContain("<p>Material: Pino</p>")
    expect(descripcionAHtml("Qué incluye:\n- Tabla\n- Barniz")).toBe("<p>Qué incluye:</p><ul><li>Tabla</li><li>Barniz</li></ul>")
  })
})

describe("4 datos clave", () => {
  it("salen de la ficha del taller o de la descripción, sin vacíos", () => {
    const p = {
      categories: [{ name: "Madera y MDF" }],
      description: "<p>Material: Pino</p><p>Medidas: 25x15 cm</p><p>Para qué sirve: Para regalo,</p>",
      metadata: { entrega: "Sale en 2 días" },
    }
    expect(datosClave(p)).toEqual([
      ["Material", "Pino"],
      ["Medida", "25x15 cm"],
      ["Entrega", "Sale en 2 días"],
      ["Uso", "Para regalo"],
    ])
  })
  it("un digital dice formato y descarga inmediata", () => {
    const filas = datosClave({ metadata: { producto_digital: true, formatos: "DXF" } })
    expect(filas).toEqual([
      ["Formato", "DXF"],
      ["Entrega", "Descarga inmediata"],
    ])
  })
  it("sin datos no se inventa nada", () => {
    expect(datosClave({})).toEqual([])
    expect(especificaciones({})).toEqual([])
  })
})

describe("nota del precio (IVA según el taller)", () => {
  it("siempre es precio final; la factura la dice el taller", () => {
    expect(notaPrecio(null)).toBe("Precio final")
    expect(notaPrecio({ metadata: { perfil: { factura: "si" } } })).toMatch(/IVA incluido/)
    expect(notaPrecio({ metadata: { perfil: { factura: "no" } } })).toMatch(/no emite factura/)
  })
})

describe("campos nuevos del panel del taller", () => {
  it("se validan y se leen", () => {
    const f = validarFicha({ ...base, tipo_producto: "a_medida", material: "MDF 18 mm", tiempo_produccion: "5 días", incluye: ["Tabla", "Tabla", " "], no_incluye: [] })
    expect(f.tipo_producto).toBe("a_medida")
    expect(f.incluye).toEqual(["Tabla"])
    expect(leerFicha({ tipo_producto: "a_medida", garantia: "30 días", incluye: ["A", "B"] })).toMatchObject({ tipo_producto: "a_medida", garantia: "30 días", incluye: ["A", "B"] })
  })
  it("un tipo desconocido se rechaza", () => {
    expect(() => validarFicha({ ...base, tipo_producto: "otro" })).toThrow(ErrorFicha)
  })
  it("un panel viejo que no manda los campos no los borra", () => {
    expect(validarFicha(base)).not.toHaveProperty("tipo_producto")
  })
})
