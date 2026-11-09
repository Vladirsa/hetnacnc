import { debePagarVerificacion, puntajePosicion, tallerVerificado, certVigente } from "../confianza"

describe("confianza (Licitaciones 3.0, Fase 3)", () => {
  it("la verificación se paga sólo en plan Gratis y una vez", () => {
    expect(debePagarVerificacion("gratis", { metadata: {} })).toBe(true)
    expect(debePagarVerificacion("taller", { metadata: {} })).toBe(false)
    expect(debePagarVerificacion("gratis", { metadata: { verificacion_pagada: { en: "2026-01-01" } } })).toBe(false)
    expect(debePagarVerificacion("gratis", { metadata: { requisitos_exento: true } })).toBe(false)
  })

  it("el posicionamiento suma verificación, empresa y certificaciones (máx. 3)", () => {
    const base = puntajePosicion({})
    expect(puntajePosicion({ verificado: true })).toBe(base + 2)
    expect(puntajePosicion({ verificado: true, empresa_verificada: true })).toBe(base + 3)
    const certs = Array.from({ length: 5 }, (_, i) => ({ tipo: "otra", nombre: `c${i}` }))
    expect(puntajePosicion({ certificaciones: certs })).toBe(base + 3)
    expect(puntajePosicion(JSON.stringify({ verificado: "true" }))).toBe(base + 2)
  })

  it("verificado y vigencia de certificaciones", () => {
    expect(tallerVerificado({ verificado: true })).toBe(true)
    expect(tallerVerificado({})).toBe(false)
    expect(certVigente({ estado: "aprobada", vigencia: null })).toBe(true)
    expect(certVigente({ estado: "aprobada", vigencia: "2000-01-01" })).toBe(false)
    expect(certVigente({ estado: "pendiente" })).toBe(false)
  })
})
