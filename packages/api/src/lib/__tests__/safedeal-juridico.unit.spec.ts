import { CLAUSULA_HETNA_ANTERIOR, camposContacto, clausulaHetna, condicionesIniciales, modalidadDe, pendientesDe, textoAutorizacionContacto } from "../safedeal"

describe("SafeDeal tras la revisión jurídica (14 nov 2026)", () => {
  it("la cláusula de HETNA cambia según quién recibe el pago", () => {
    expect(modalidadDe({ cobro: "taller" })).toBe("conecta")
    expect(modalidadDe({ cobro: "hetna" })).toBe("administra")
    expect(modalidadDe({})).toBe("administra")
    const a = clausulaHetna("conecta")
    const b = clausulaHetna("administra")
    expect(a).toContain("HETNA no recibe ni retiene ese dinero")
    expect(a).not.toContain("gestión del pago")
    expect(b).toContain("gestión del pago")
    expect(b).not.toMatch(/escrow|dep[oó]sito en garant/i)
    for (const t of [a, b]) expect(t).toContain("PROFECO")
    // La de antes se conserva para regenerar contratos viejos
    expect(CLAUSULA_HETNA_ANTERIOR).toContain("conectó a las partes")
  })

  it("no se aprueba un contrato con textos por llenar", () => {
    const s = { folio: 7, trabajo: { descripcion: "Placas" }, contacto: {} }
    const p = { taller: "Taller X", precio: 1000, dias: 5, moneda: "MXN", anticipo_pct: 100 }
    const c = condicionesIniciales(s, p) as Record<string, string>
    const faltan = pendientesDe(c)
    expect(faltan).toContain("Identificación de las partes") // (nombre o razón social)
    expect(faltan).toContain("Precio") // indicar si incluye IVA
    expect(faltan).toContain("Entrega") // Lugar: por definir
    c.identificacion = "CLIENTE: Ana López. TALLER: Taller X."
    c.precio = "$1,000.00 MXN, IVA incluido."
    c.entrega = "5 días naturales. Lugar: Puebla."
    expect(pendientesDe(c)).toEqual([])
    // Los apartados nuevos vienen llenos
    for (const k of ["retrasos", "terminacion", "fuerza_mayor"]) expect(c[k].length).toBeGreaterThan(40)
    expect(c.propiedad).toContain("programa CAM")
  })

  it("la autorización dice qué datos se comparten y con quién", () => {
    const campos = camposContacto({ nombre: "Ana", email: "a@b.mx", telefono: "222" })
    expect(campos).toEqual(["nombre", "correo electrónico", "teléfono"])
    const t = textoAutorizacionContacto("cliente", campos)
    expect(t).toContain("con el taller")
    expect(t).toContain("nombre, correo electrónico, teléfono")
    expect(textoAutorizacionContacto("taller", [])).toContain("con el cliente")
  })
})
