// Auditoría del 25 nov 2026: maderas sólidas en el precio al instante y anticipo de la liga pública.
import { precioInstantaneo } from "../precio-instantaneo"
import { anticipoDe } from "../cotizacion-liga"

const router = (material: string) => {
  const r = precioInstantaneo({ servicio: "router", material, ancho: 30, largo: 60, cantidad: 1 })
  if (!r.ok) throw new Error(r.mensaje)
  return r
}

describe("precio al instante: maderas sólidas", () => {
  it("cada madera usa su propio precio (ya no el del triplay)", () => {
    const pino = router("Pino").resultado.pvRecomendado
    const encino = router("Encino").resultado.pvRecomendado
    const cedro = router("Cedro").resultado.pvRecomendado
    expect(encino).toBeGreaterThan(pino * 2)
    expect(cedro).toBeGreaterThan(pino)
    // Lo que calculó la auditoría a mano: encino ≈ $985 y pino ≈ $340 (antes ambos $255)
    expect(router("Encino").estimado.total).toBeGreaterThanOrEqual(900)
    expect(router("Pino").estimado.total).toBeGreaterThanOrEqual(300)
  })
  it("el MDF no cambia", () => {
    expect(router("MDF 15mm").resultado.pvRecomendado).toBeGreaterThan(0)
  })
})

describe("anticipo de la liga pública", () => {
  const c = (metodo_pago: string, total = 10000) => ({ total, metodo_pago })
  it("acepta porcentajes con decimales", () => {
    expect(anticipoDe(c("33.5 % de anticipo"))).toBe(3350)
    expect(anticipoDe(c("Anticipo de 33,5%"))).toBe(3350)
    expect(anticipoDe(c("50% de anticipo y 50% contra entrega"))).toBe(5000)
  })
  it("pago total anticipado = el total", () => {
    expect(anticipoDe(c("Pago total anticipado"))).toBe(10000)
    expect(anticipoDe(c("100 % anticipado"))).toBe(10000)
  })
  it("monto fijo y sin anticipo siguen igual", () => {
    expect(anticipoDe(c("Anticipo de $1,500"))).toBe(1500)
    expect(anticipoDe(c("Contra entrega"))).toBe(0)
    expect(anticipoDe({ total: 10000, metodo_pago: "50% de anticipo", anticipo_monto: 2000 })).toBe(2000)
  })
})
