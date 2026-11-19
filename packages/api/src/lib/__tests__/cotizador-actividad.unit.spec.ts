import { candidatosCotizador, correoCotizador } from "../cotizador-crm"

const DIA = 86_400_000
const ahora = Date.parse("2026-11-19T18:00:00Z")
const taller = (id: string, diasRegistrado: number, plan = "trial") => ({
  id, nombre: `Taller ${id}`, correo: `${id}@ejemplo.com`, telefono: null, plan, plan_estado: null, plan_renueva: null, plan_vence: null,
  pago_proveedor: null, trial_hasta: new Date(ahora + 10 * DIA).toISOString(), created_at: new Date(ahora - diasRegistrado * DIA).toISOString(),
}) as any

describe("Cotizador: mensajes según lo que hace el taller", () => {
  it("empuja al que no ha cotizado, felicita la primera y ofrece plan al que ganó", () => {
    const act = new Map([
      ["b", { total: 1, enviadas: 1, primeraEnviada: ahora - DIA, ganada: null }],
      ["c", { total: 3, enviadas: 2, primeraEnviada: ahora - 9 * DIA, ganada: { fecha: ahora - DIA, total: 2300 } }],
    ])
    const c = candidatosCotizador([taller("a", 2), taller("b", 6), taller("c", 12)], new Map(), ahora, act as any)
    const tipos = (id: string) => c.filter((x) => x.correo.startsWith(id)).map((x) => x.tipo)
    expect(tipos("a")).toContain("cot_sin_cotizar")
    expect(tipos("b")).toContain("cot_primera")
    expect(tipos("c")).toContain("cot_ganada")
    expect(c[0].tipo).toBe("cot_ganada") // lo más cerca de pagar va primero
  })
  it("el correo de trabajo ganado dice el monto", () => {
    expect(correoCotizador("cot_ganada", { nombre: "X", monto: 2300 }).asunto).toContain("$2,300")
  })
})
