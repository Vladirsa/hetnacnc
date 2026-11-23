import { saldoDe } from "../saldos"

describe("saldo de Skydropx", () => {
  it("lee el saldo en los formatos que manda Skydropx", () => {
    expect(saldoDe({ balance: "352.17" })).toBe(352.17)
    expect(saldoDe({ data: { attributes: { balance: "$352.17" } } })).toBe(352.17)
    expect(saldoDe({ data: [{ attributes: { credits: 352.17 } }] })).toBe(352.17)
    expect(saldoDe({ balance: { amount: "352.17", currency: "MXN" } })).toBe(352.17)
    expect(saldoDe({ data: { available_balance: "1,250.50" } })).toBe(1250.5)
  })
  it("un campo que no viene no es saldo 0", () => {
    expect(saldoDe({ credits: 352.17 })).toBe(352.17) // antes: balance ausente → 0
    expect(saldoDe({})).toBeNull()
    expect(saldoDe({ data: { attributes: {} } })).toBeNull()
    expect(saldoDe(null)).toBeNull()
  })
  it("un saldo de verdad en cero sí es cero", () => {
    expect(saldoDe({ balance: "0.00" })).toBe(0)
  })
})
