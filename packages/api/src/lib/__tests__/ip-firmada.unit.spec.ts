import { firmaIp, ipDeFirma } from "../ip-firmada"
import { ipCliente } from "../ip-cliente"

describe("IP del comprador firmada por la tienda", () => {
  const antes = process.env.STOREFRONT_REVALIDATE_SECRET
  const S = "secreto-compartido-de-prueba-0123456789"
  beforeAll(() => { process.env.STOREFRONT_REVALIDATE_SECRET = S })
  afterAll(() => { process.env.STOREFRONT_REVALIDATE_SECRET = antes })
  const ahora = 1795000000000
  const ts = Math.floor(ahora / 1000)
  const valor = (ip: string, t = ts, s = S) => `${ip}.${t}.${firmaIp(ip, t, s)}`

  it("acepta la IP con firma buena y reciente (IPv4 e IPv6)", () => {
    expect(ipDeFirma(valor("187.190.5.20"), ahora)).toBe("187.190.5.20")
    expect(ipDeFirma(valor("2806:2f0:1::5"), ahora)).toBe("2806:2f0:1::5")
  })

  it("rechaza firma falsa, vieja, otro secreto o basura", () => {
    expect(ipDeFirma(valor("1.2.3.4", ts, "otro-secreto-cualquiera-xxxxxxxx"), ahora)).toBeNull()
    expect(ipDeFirma(valor("1.2.3.4", ts - 600), ahora)).toBeNull()
    expect(ipDeFirma(valor("1.2.3.4").replace("1.2.3.4", "9.9.9.9"), ahora)).toBeNull()
    expect(ipDeFirma("1.2.3.4", ahora)).toBeNull()
    expect(ipDeFirma(undefined, ahora)).toBeNull()
  })

  it("sin secreto válido no se confía en la cabecera", () => {
    process.env.STOREFRONT_REVALIDATE_SECRET = "supersecret"
    expect(ipDeFirma(valor("1.2.3.4", ts, "supersecret"), ahora)).toBeNull()
    process.env.STOREFRONT_REVALIDATE_SECRET = S
  })

  it("ipCliente usa la firmada y si no, la de nginx", () => {
    const t = Math.floor(Date.now() / 1000)
    expect(ipCliente({ headers: { "x-hetna-ip": `8.8.4.4.${t}.${firmaIp("8.8.4.4", t, S)}`, "x-forwarded-for": "127.0.0.1" } })).toBe("8.8.4.4")
    expect(ipCliente({ headers: { "x-hetna-ip": "8.8.4.4.1.falsa", "x-forwarded-for": "5.6.7.8" } })).toBe("5.6.7.8")
  })
})
