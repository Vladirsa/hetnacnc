import { ligaInvitacion, limpiarRef, motivoNoLigar } from "../referidos"

const nuevo = { id: "sel_b", created_at: "2026-11-17T12:00:00Z", metadata: {} }
const quien = { id: "sel_a", name: "Taller A", handle: "taller-a" }
const hoy = new Date("2026-11-18T12:00:00Z")

describe("invita a otro taller", () => {
  it("arma la liga con el handle", () => {
    expect(ligaInvitacion("taller-a")).toMatch(/\/mx\/talleres\/unete\?ref=taller-a$/)
  })
  it("limpia el código", () => {
    expect(limpiarRef(" Taller-A<script> ")).toBe("taller-ascript")
    expect(limpiarRef(undefined)).toBe("")
  })
  it("liga a un taller nuevo una sola vez y nunca a sí mismo", () => {
    expect(motivoNoLigar(nuevo, quien, hoy)).toBeNull()
    expect(motivoNoLigar(nuevo, null, hoy)).toMatch(/no es válida/)
    expect(motivoNoLigar({ ...nuevo, id: "sel_a" }, quien, hoy)).toMatch(/ti mismo/)
    expect(motivoNoLigar({ ...nuevo, metadata: { referido_por: "sel_x" } }, quien, hoy)).toMatch(/ya está ligado/)
    expect(motivoNoLigar({ ...nuevo, created_at: "2026-10-01T00:00:00Z" }, quien, hoy)).toMatch(/nuevos/)
  })
})
