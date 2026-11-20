import { contarPorCodigo } from "../creadores"

describe("programa de creadores", () => {
  it("cuenta registrados y los que ya pagan por código", () => {
    const m = contarPorCodigo(
      [
        { id: "a", referido_codigo: "CNCJUAN" },
        { id: "b", referido_codigo: "cncjuan" },
        { id: "c", referido_codigo: "OTRO" },
        { id: "d", referido_codigo: null },
      ],
      new Set(["b", "c"])
    )
    expect(m.get("CNCJUAN")).toEqual({ registrados: 2, pagando: 1 })
    expect(m.get("OTRO")).toEqual({ registrados: 1, pagando: 1 })
    expect(m.size).toBe(2)
  })
})
