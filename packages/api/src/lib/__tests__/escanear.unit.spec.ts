import { conEstado, duraciones, extensionValida, puedePedir, vistaCliente, type Solicitud } from "../escanear"

const base: Solicitud = {
  id: "esc_" + "a".repeat(24), folio: 7, customer_id: "cus_1", correo: "cliente@x.com", nombre_cliente: "Ana", titulo: "Engrane", descripcion: "Se quebró",
  uso: "precision", salida: "reposicion", material_original: "nylon", material_deseado: null, medidas: [{ nombre: "Largo", mm: 50 }, { nombre: "Ø", mm: 8 }], zona: null,
  estado: "recibida", archivos: [{ id: "arc_1", tipo: "escaneo", nombre: "pieza.stl", clave: "escanear/x/escaneo/arc_1.stl", tamano: 10, de: "cliente", creado: "2026-11-21T00:00:00Z" }],
  comentarios: [], disenador: null, notas_internas: "secreto", verificacion: [], tiempos: { recibida: "2026-11-21T10:00:00Z" }, creado: "2026-11-21T10:00:00Z", actualizado: "2026-11-21T10:00:00Z",
}

describe("Escanear", () => {
  const env = { ...process.env }
  afterEach(() => { process.env = { ...env } })

  it("Fase 1: sólo la casa y la lista pueden pedir; ESCANEAR_PUBLICO=on lo abre", () => {
    process.env.CUENTAS_DE_LA_CASA = "dueno@hetna.com"
    process.env.ESCANEAR_CORREOS = "socio@x.com"
    delete process.env.ESCANEAR_PUBLICO
    expect(puedePedir("dueno@hetna.com")).toBe(true)
    expect(puedePedir("SOCIO@x.com")).toBe(true)
    expect(puedePedir("otro@x.com")).toBe(false)
    expect(puedePedir(null)).toBe(false)
    process.env.ESCANEAR_PUBLICO = "on"
    expect(puedePedir("otro@x.com")).toBe(true)
  })

  it("el cliente no ve notas internas ni las claves del almacén, y siempre lleva el aviso", () => {
    const v = vistaCliente(base) as any
    expect(v.notas_internas).toBeUndefined()
    expect(v.customer_id).toBeUndefined()
    expect(v.archivos[0].clave).toBeUndefined()
    expect(v.folio_texto).toBe("ESC-0007")
    expect(v.aviso).toMatch(/verificación de medidas/)
    expect(v.aviso).toMatch(/[Ss]in precio/)
  })

  it("anota cuándo entra a cada estado (sin pisar la primera vez) y calcula los tiempos", () => {
    const a = conEstado(base, "en_escaneo")
    expect(a.estado).toBe("en_escaneo")
    const s2 = { ...base, tiempos: { recibida: "2026-11-21T10:00:00Z", en_escaneo: "2026-11-21T10:30:00Z", en_rediseno: "2026-11-21T13:30:00Z" } }
    expect(conEstado(s2, "en_escaneo").tiempos.en_escaneo).toBe("2026-11-21T10:30:00Z")
    expect(duraciones(s2)).toEqual([
      { de: "recibida", a: "en_escaneo", minutos: 30 },
      { de: "en_escaneo", a: "en_rediseno", minutos: 180 },
    ])
  })

  it("sólo acepta los formatos de cada tipo de archivo", () => {
    expect(extensionValida("escaneo", "Pieza.STL")).toBe("stl")
    expect(extensionValida("escaneo", "pieza.ply")).toBe("ply")
    expect(extensionValida("escaneo", "virus.exe")).toBeNull()
    expect(extensionValida("foto", "foto.stl")).toBeNull()
    expect(extensionValida("modelo", "pieza.step")).toBe("step")
  })
})
