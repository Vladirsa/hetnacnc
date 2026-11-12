import { etapa, fechaBuenFin, rango, validar } from "../fabrica/buen-fin"
import { catalogoVentas, palabrasClave } from "../whatsapp-bot"

const mx = (s: string) => new Date(`${s}T18:00:00Z`) // mediodía en México
const base = { activo: true, desde: "2026-11-13", hasta: "2026-11-16", descuento: "10% en productos seleccionados", cupon: "", etiquetas: ["buen-fin"] }

describe("Buen Fin con los datos del dueño", () => {
  it("sólo publica 5 días antes y durante; nada después ni apagado", () => {
    expect(etapa(base, mx("2026-11-07"))).toBeNull()
    expect(etapa(base, mx("2026-11-08"))).toBe("antes")
    expect(etapa(base, mx("2026-11-13"))).toBe("durante")
    expect(etapa(base, mx("2026-11-16"))).toBe("durante")
    expect(etapa(base, mx("2026-11-17"))).toBeNull()
    expect(etapa({ ...base, activo: false }, mx("2026-11-14"))).toBeNull()
  })

  it("no deja activar sin fechas o sin descuento escrito", () => {
    expect(() => validar({ ...base, descuento: "" })).toThrow(/descuento/)
    expect(() => validar({ ...base, desde: "" })).toThrow(/fechas/)
    expect(() => validar({ ...base, desde: "2026-11-20" })).toThrow(/después/)
    expect(() => validar({ ...base, activo: false, descuento: "" })).not.toThrow()
  })

  it("los textos usan el descuento y el cupón tal cual", () => {
    expect(rango("2026-11-13", "2026-11-16")).toBe("del 13 al 16 de noviembre")
    const f = fechaBuenFin({ ...base, cupon: "BUENFIN10" }, "durante")
    expect(f.narracion).toContain("10% en productos seleccionados")
    expect(f.cta).toBe("Usa el cupón BUENFIN10")
    expect(fechaBuenFin({ ...base, cupon: "BUENFIN10" }, "antes").cta).not.toContain("BUENFIN10")
  })
})

describe("respondedor de WhatsApp", () => {
  it("saca las palabras que sirven para buscar productos", () => {
    expect(palabrasClave("Hola, ¿tienen llaveros de acrílico personalizados?")).toEqual(["llaveros", "acrilico", "personalizados"])
    expect(palabrasClave("hola buenas tardes")).toEqual([])
  })
  it("el agente sólo trae precios reales: los planes del Cotizador", () => {
    const c = catalogoVentas().join("\n")
    expect(c).toMatch(/Taller \$299 MXN\/mes/)
    expect(c).toContain("/mx/cotizar")
  })
})
