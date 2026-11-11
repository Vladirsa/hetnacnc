import { FECHAS, fechasActivas, finDelDia, proxima, temporadaDe } from "../fabrica/calendario"
import { coincide, fotoAbsoluta, nombreCorto, normalizar } from "../fabrica/temporadas"

const mx = (s: string) => new Date(`${s}T18:00:00Z`) // mediodía en México

describe("fechas especiales y productos", () => {
  it("calcula cuándo cae cada fecha (Día del Padre = 3.er domingo de junio)", () => {
    const padre = FECHAS.find((f) => f.clave === "dia_padre")!
    expect(proxima(padre, mx("2026-06-01"))).toMatchObject({ anio: 2026, mes: 6, dia: 21 })
    expect(proxima(padre, mx("2027-06-01"))).toMatchObject({ anio: 2027, mes: 6, dia: 20 })
    const madre = FECHAS.find((f) => f.clave === "dia_madre")!
    expect(proxima(madre, mx("2026-05-11"))).toMatchObject({ anio: 2027, mes: 5, dia: 10 })
  })

  it("temporada: la fecha más cercana primero y nada fuera de su ventana", () => {
    expect(fechasActivas(mx("2026-05-08")).map((x) => x.f.clave)).toEqual(["dia_madre", "dia_maestro"])
    expect(fechasActivas(mx("2026-03-10"))).toEqual([])
    expect(fechasActivas(mx("2026-05-11")).map((x) => x.f.clave)).toEqual(["dia_maestro"])
  })

  it("lo del 10 de mayo vence al terminar el 10 de mayo (hora de México)", () => {
    const v = finDelDia({ anio: 2026, mes: 5, dia: 10 })
    expect(v.toISOString()).toBe("2026-05-11T05:59:00.000Z")
  })

  it("los fondos de temporada salen del mismo calendario", () => {
    expect(temporadaDe(mx("2026-09-10"))).toEqual(["patrio"])
    expect(temporadaDe(mx("2026-11-01"))).toEqual(["muertos"])
    expect(temporadaDe(mx("2027-01-05"))).toEqual(["navidad"])
    expect(temporadaDe(mx("2026-05-08"))).toEqual([]) // el Día de las Madres no pinta de rosa los videos de talleres
  })

  it("sólo cuenta la etiqueta o categoría exacta: 'tarjeta madre' o 'punto muerto' no son de temporada", () => {
    const madre = ["dia-de-las-madres", "10-de-mayo"]
    expect(coincide({ etiquetas: ["Tarjeta madre"], categorias: ["Electrónica"] }, madre)).toBe(false)
    expect(coincide({ etiquetas: ["Amortiguador"] }, ["san-valentin", "amor-y-amistad"])).toBe(false)
    expect(coincide({ etiquetas: ["Punto muerto"] }, ["dia-de-muertos"])).toBe(false)
    expect(coincide({ etiquetas: ["Día de las Madres"] }, madre)).toBe(true)
    expect(coincide({ categorias: ["dia-de-muertos"] }, ["Día de Muertos"])).toBe(true)
    expect(normalizar("  Día de Muertos ")).toBe("dia-de-muertos")
  })

  it("nombre corto sin códigos para pantalla y voz", () => {
    expect(nombreCorto("Calavera decorativa MDF-3MM-X (30 cm) para altar")).toBe("Calavera decorativa para altar")
    expect(nombreCorto("Portarretratos AB1234 grabado láser con nombre de mamá")).toBe("Portarretratos grabado láser con nombre")
  })

  it("usa las fotos guardadas en el servidor aunque vengan como /static/…", () => {
    expect(fotoAbsoluta("https://x.com/a.jpg")).toBe("https://x.com/a.jpg")
    expect(fotoAbsoluta("/static/123-foto.webp")).toMatch(/^https?:\/\/[^/]+\/static\/123-foto\.webp$/)
    expect(fotoAbsoluta("")).toBeNull()
  })
})
