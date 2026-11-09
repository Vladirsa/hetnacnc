import { createHash } from "crypto"

import { APARTADOS, condicionesIniciales, generarPdfContrato, huellaCondiciones } from "../safedeal"
import { INDICADORES_CLIENTE, INDICADORES_TALLER, pareceAutoevaluacion } from "../trust"

const s = { id: "sol_1", folio: 7, token: "t", contacto: { nombre: "Ana", empresa: "ACME" }, trabajo: { descripcion: "Placas", material: "Acero" } }
const p = { taller: "Taller X", precio: 1000, moneda: "MXN", dias: 5, anticipo_pct: 50, incluye_envio: "si" }

describe("SafeDeal (Fase 4)", () => {
  it("las condiciones iniciales llenan los 12 apartados", () => {
    const c = condicionesIniciales(s, p) as Record<string, string>
    expect(APARTADOS).toHaveLength(12)
    for (const [k] of APARTADOS) expect(c[k]?.length).toBeGreaterThan(0)
    expect(c.pagos).toContain("50%")
  })

  it("la huella de condiciones cambia con cualquier edición", () => {
    const c = condicionesIniciales(s, p)
    expect(huellaCondiciones(c)).toBe(huellaCondiciones({ ...c }))
    expect(huellaCondiciones(c)).not.toBe(huellaCondiciones({ ...c, precio: "otro" }))
  })

  it("el PDF es determinista: mismo contenido, misma SHA-256", async () => {
    const k = { version: 1, condiciones: condicionesIniciales(s, p), borrador_legal: true }
    const h = (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
    expect(h(await generarPdfContrato(s, p, k))).toBe(h(await generarPdfContrato(s, p, k)))
    expect(h(await generarPdfContrato(s, p, k))).not.toBe(h(await generarPdfContrato(s, p, { ...k, version: 2 })))
  })
})

describe("Trust & Ranking (Fase 4)", () => {
  it("7 indicadores por lado", () => {
    expect(INDICADORES_TALLER).toHaveLength(7)
    expect(INDICADORES_CLIENTE).toHaveLength(7)
  })
  it("detecta autoevaluación por correo o dominio corporativo", () => {
    expect(pareceAutoevaluacion("a@taller.mx", "A@taller.mx")).toBe(true)
    expect(pareceAutoevaluacion("ventas@taller.mx", "dueno@taller.mx")).toBe(true)
    expect(pareceAutoevaluacion("ana@gmail.com", "pepe@gmail.com")).toBe(false)
    expect(pareceAutoevaluacion("ana@acme.mx", "pepe@taller.mx")).toBe(false)
    expect(pareceAutoevaluacion("", "x@y.mx")).toBe(false)
  })
})
