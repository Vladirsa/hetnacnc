// Pruebas de la privacidad de licitaciones (Licitaciones 3.0, Fase 1).
// Cada control debe respetarse en lo que ve un taller, en el tablero público
// y en el resumen de redes.
import {
  PRIVACIDAD_ANTERIOR,
  clienteVisible,
  leerModalidad,
  leerPrivacidad,
  puedeDescargar,
  resumenRedes,
  tallerPuedeVer,
  trabajoParaTaller,
  trabajoPublicoPrivado,
  type RelacionTaller,
} from "../licitacion-privacidad"

const ajeno: RelacionTaller = { invitado: false, acceso: "ninguno", propuso: false, elegido: false }
const aprobado: RelacionTaller = { ...ajeno, acceso: "aprobado" }
const invitado: RelacionTaller = { ...ajeno, invitado: true }
const elegido: RelacionTaller = { ...ajeno, propuso: true, elegido: true }

const base = (privacidad: Record<string, string> = {}, modalidad = "publica") => ({
  id: "sol_1",
  folio: 7,
  modo: "abierta",
  modalidad,
  privacidad,
  contacto: { nombre: "Ana López", empresa: "Metales del Bajío", email: "ana@ejemplo.com", telefono: "5512345678" },
  trabajo: {
    descripcion: "Necesito 200 placas. Llámame al 55 1234 5678 o ana@ejemplo.com",
    servicio: "Corte láser",
    material: "Acero",
    cantidad: "200",
    ciudad: "León",
    estado_mx: "Guanajuato",
    cp: "37000",
    presupuesto: "$20,000",
    archivos: [
      { clave: "a", nombre: "plano.dxf", tamano: 10 },
      { clave: "b", nombre: "foto.jpg", tamano: 10 },
    ],
  },
})

describe("leer configuración", () => {
  it("valores inválidos caen en lo anterior", () => {
    expect(leerPrivacidad({ nombre: "xxx" })).toEqual(PRIVACIDAD_ANTERIOR)
    expect(leerModalidad("rara")).toBe("publica")
  })
})

describe("lo que ve un taller", () => {
  it("nunca recibe correo ni teléfono, ni en la descripción", () => {
    const t = trabajoParaTaller(base(), ajeno)
    const todo = JSON.stringify(t)
    expect(todo).not.toContain("ana@ejemplo.com")
    expect(todo).not.toContain("5512345678")
    expect(t.descripcion).toContain("[contacto oculto]")
  })
  it("nombre: anónimo / empresa / público", () => {
    expect(clienteVisible(base({ nombre: "anonimo" }))).toBe("Cliente HETNA")
    expect(clienteVisible(base({ nombre: "empresa", empresa: "publico" }))).toBe("Metales del Bajío")
    expect(clienteVisible(base({ nombre: "empresa", empresa: "confidencial" }))).toBe("Cliente HETNA")
    expect(clienteVisible(base({ nombre: "publico", empresa: "confidencial" }))).toBe("Ana López")
  })
  it("presupuesto confidencial no sale", () => {
    const t = trabajoParaTaller(base({ presupuesto: "confidencial" }), ajeno)
    expect(t.presupuesto).toBe("")
    expect(t.presupuesto_confidencial).toBe(true)
  })
  it("descripción sólo para participantes", () => {
    const s = base({ descripcion: "participantes" })
    expect(trabajoParaTaller(s, ajeno).descripcion).toBe("")
    expect(trabajoParaTaller(s, aprobado).descripcion).not.toBe("")
    expect(trabajoParaTaller(s, invitado).descripcion).not.toBe("")
  })
  it("ubicación: estado o confidencial", () => {
    const e = trabajoParaTaller(base({ ubicacion: "estado" }), ajeno)
    expect(e.ciudad).toBe("")
    expect(e.cp).toBe("")
    expect(e.estado_mx).toBe("Guanajuato")
    const c = trabajoParaTaller(base({ ubicacion: "confidencial" }), ajeno)
    expect([c.ciudad, c.estado_mx, c.cp].join("")).toBe("")
  })
})

describe("archivos y fotos", () => {
  it("públicos los descarga cualquier taller", () => {
    expect(puedeDescargar(base(), ajeno, "plano.dxf")).toBe(true)
  })
  it("bajo autorización sólo con acceso aprobado o invitado", () => {
    const s = base({ archivos: "autorizacion" })
    expect(puedeDescargar(s, ajeno, "plano.dxf")).toBe(false)
    expect(puedeDescargar(s, aprobado, "plano.dxf")).toBe(true)
    expect(puedeDescargar(s, invitado, "plano.dxf")).toBe(true)
  })
  it("privados sólo el taller elegido", () => {
    const s = base({ archivos: "privados" })
    expect(puedeDescargar(s, aprobado, "plano.dxf")).toBe(false)
    expect(puedeDescargar(s, elegido, "plano.dxf")).toBe(true)
  })
  it("fotos privadas no se descargan aunque los planos sean públicos", () => {
    const s = base({ fotos: "privadas" })
    expect(puedeDescargar(s, ajeno, "foto.jpg")).toBe(false)
    expect(puedeDescargar(s, ajeno, "plano.dxf")).toBe(true)
  })
  it("restringida exige autorización para los planos", () => {
    const s = base({}, "restringida")
    expect(puedeDescargar(s, ajeno, "plano.dxf")).toBe(false)
    expect(puedeDescargar(s, aprobado, "plano.dxf")).toBe(true)
  })
})

describe("modalidad privada", () => {
  it("sólo la ven invitados o quien ya propuso", () => {
    const s = base({}, "privada")
    expect(tallerPuedeVer(s, ajeno)).toBe(false)
    expect(tallerPuedeVer(s, invitado)).toBe(true)
    expect(tallerPuedeVer(base(), ajeno)).toBe(true)
  })
})

describe("tablero público y redes", () => {
  it("el tablero respeta descripción, presupuesto y ubicación", () => {
    const p = trabajoPublicoPrivado(base({ descripcion: "participantes", presupuesto: "confidencial", ubicacion: "confidencial" }))
    expect(p.descripcion).toBe("")
    expect(p.presupuesto).toBe("")
    expect(p.ciudad + p.estado_mx).toBe("")
  })
  it("el resumen de redes no lleva contacto, presupuesto ni nombre", () => {
    const r = resumenRedes(base({ ubicacion: "estado" }))
    expect(r).not.toMatch(/Ana López|ejemplo\.com|5512|20,000|León|Metales/)
    expect(r).toContain("Guanajuato")
    expect(r).toContain("HETNA CNC")
  })
})
