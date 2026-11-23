// Correo "Completa tus datos" (lib/datos-faltantes.ts): reglas y cuándo se manda.
import { MAX_SIN_AVANCE, asunto, cuerpoCorreo, faltantesPerfil, faltantesProducto, faltantesTaller, tocaCorreo } from "../datos-faltantes"

const fisico = { id: "p1", title: "Tabla de pino", thumbnail: "https://x/a.jpg", status: "published", metadata: { medida_principal: "25 × 15 cm" } }
const digital = { id: "p2", title: "Celosía de panal", thumbnail: "https://x/b.jpg", status: "published", metadata: { producto_digital: true } }
const servicio = { id: "p3", title: "Revisión CAM", thumbnail: null, status: "published", metadata: { hetna_cam_service: "cam_3" } }
const completo = {
  id: "p4",
  title: "Spindle",
  thumbnail: "https://x/c.jpg",
  status: "published",
  metadata: { material: "Acero", medida_principal: "80 mm", tipo_producto: "herramienta", entrega: "2 días" },
}
const perfilCompleto = { estado: "Tlaxcala", ciudad: "Apizaco", maquinas: [{ tipo: "router" }], materiales: ["MDF"], factura: "no" }

describe("qué le falta a cada producto", () => {
  it("físico: material, tipo y entrega; digital: material y medida; servicio: sólo la foto", () => {
    expect(faltantesProducto(fisico)).toEqual(["material", "tipo de producto", "tiempo de entrega"])
    expect(faltantesProducto(digital)).toEqual(["material", "medida"])
    expect(faltantesProducto(servicio)).toEqual(["foto"])
    expect(faltantesProducto(completo)).toEqual([])
  })
})

describe("qué le falta al perfil", () => {
  it("estado y ciudad, máquinas, materiales y factura", () => {
    expect(faltantesPerfil({})).toEqual(["estado y ciudad", "máquinas", "materiales que trabajas", "si emites factura"])
    expect(faltantesPerfil(perfilCompleto)).toEqual([])
  })
  it("a un proveedor no se le piden máquinas", () => {
    expect(faltantesPerfil({ ...perfilCompleto, maquinas: [], tipo_cuenta: "proveedor" })).toEqual([])
  })
})

describe("cuándo se manda", () => {
  const ahora = new Date("2026-11-24T16:37:00Z")
  const taller = (metadata: Record<string, unknown>, products = [fisico]) => ({ id: "s1", name: "Corta.mx", email: "a@b.mx", status: "open", metadata, products })

  it("sin productos no: le toca la campaña de primer producto", () => {
    expect(tocaCorreo(taller({}, []), 4, ahora)).toBeNull()
  })
  it("con todo completo no", () => {
    expect(tocaCorreo(taller({}), 0, ahora)).toBeNull()
  })
  it("máximo uno cada 7 días", () => {
    expect(tocaCorreo(taller({ aviso_datos_faltantes: { n: 1, ultimo: "2026-11-20T16:37:00Z", faltan: 5 } }), 5, ahora)).toBeNull()
    expect(tocaCorreo(taller({ aviso_datos_faltantes: { n: 1, ultimo: "2026-11-17T16:37:00Z", faltan: 5 } }), 5, ahora)).toEqual({ n: 1, ultimo: "2026-11-17T16:37:00Z", faltan: 5 })
  })
  it("tras varios correos sin avance se detiene; si llena algo, vuelve a empezar", () => {
    const viejo = { aviso_datos_faltantes: { n: MAX_SIN_AVANCE, ultimo: "2026-10-01T00:00:00Z", faltan: 5 } }
    expect(tocaCorreo(taller(viejo), 5, ahora)).toBeNull()
    expect(tocaCorreo(taller(viejo), 3, ahora)?.n).toBe(0)
  })
})

describe("el correo", () => {
  const t = { id: "s1", name: "Corta.mx", email: "a@b.mx", status: "open", metadata: { perfil: {} }, products: [fisico, digital, completo] }
  it("junta perfil y productos, con ligas directas al panel", () => {
    const f = faltantesTaller(t)
    expect(f.perfil).toHaveLength(4)
    expect(f.productos.map((p) => p.id)).toEqual(["p1", "p2"])
    expect(f.total).toBe(4 + 3 + 2)
    expect(asunto(f)).toMatch(/filtros/)
    const html = cuerpoCorreo(t, f)
    expect(html).toContain("/perfil-taller")
    expect(html).toContain("/ficha?abrir=p1")
    expect(html).toContain("Corta.mx")
  })
})
