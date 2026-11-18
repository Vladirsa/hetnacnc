import { ligaWhatsapp, pasoAtorado, tocaConfirmar } from "../alta-recordatorios"

const base = { id: "sel_1", name: "CORTA.MX", email: "contacto@corta.mx", status: "pending_approval", created_at: "2026-11-16T15:00:00Z", metadata: {} }

describe("recordatorios del alta de talleres", () => {
  it("reenvía la confirmación al día 1, 3 y 7, nunca dos veces seguidas", () => {
    expect(tocaConfirmar(base, new Date("2026-11-16T20:00:00Z"))).toBeNull()
    expect(tocaConfirmar(base, new Date("2026-11-18T12:00:00Z"))).toBe(0)
    const uno = { ...base, metadata: { aviso_confirmar: { n: 1, ultimo: "2026-11-18T12:00:00Z" } } }
    expect(tocaConfirmar(uno, new Date("2026-11-18T20:00:00Z"))).toBeNull()
    expect(tocaConfirmar(uno, new Date("2026-11-19T20:00:00Z"))).toBe(1)
    const tres = { ...base, metadata: { aviso_confirmar: { n: 3 } } }
    expect(tocaConfirmar(tres, new Date("2026-12-01T12:00:00Z"))).toBeNull()
  })
  it("no molesta a quien ya confirmó", () => {
    expect(tocaConfirmar({ ...base, metadata: { correo_confirmado: true } }, new Date("2026-11-18T12:00:00Z"))).toBeNull()
  })
  it("describe el paso en que va", () => {
    expect(pasoAtorado(base, false)).toBe("no ha confirmado su correo")
    expect(pasoAtorado({ ...base, metadata: { correo_confirmado: true } }, false)).toBe("espera tu aprobación")
    expect(pasoAtorado({ ...base, status: "open", metadata: { correo_confirmado: true } }, false)).toBe("aprobado, sin productos")
    expect(pasoAtorado({ ...base, status: "open", metadata: { correo_confirmado: true } }, true)).toBeNull()
  })
  it("arma la liga de WhatsApp con lada de México", () => {
    expect(ligaWhatsapp("999 123 4567", "CORTA.MX", "no ha confirmado su correo")).toMatch(/^https:\/\/wa\.me\/529991234567\?text=/)
    expect(ligaWhatsapp("+52 1 999 123 4567", "X", "x")).toMatch(/wa\.me\/529991234567/)
    expect(ligaWhatsapp("123", "X", "x")).toBe("")
  })
})
