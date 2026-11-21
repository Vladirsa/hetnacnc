import { huellaNda, textoNda } from "../licitacion-nda"
import { faltaNda, puedeDescargar, trabajoParaTaller } from "../licitacion-privacidad"

const base = (privacidad: Record<string, string> = {}, archivos: any[] = [{ clave: "a", nombre: "plano.pdf", tamano: 1 }, { clave: "b", nombre: "modelo.step", tamano: 1, solo_elegido: true }]) => ({
  id: "s1",
  folio: "A-1",
  modo: "abierta",
  privacidad,
  trabajo: { descripcion: "Pieza secreta", archivos },
})
const rel = (x: Partial<{ invitado: boolean; acceso: any; propuso: boolean; elegido: boolean; nda: boolean }> = {}) => ({ invitado: false, acceso: "ninguno" as const, propuso: false, elegido: false, nda: false, ...x })

describe("acuerdo de confidencialidad y permisos por archivo", () => {
  it("sin NDA aceptado no se ve la descripción ni se baja nada", () => {
    const s = base({ nda: "requerido" })
    expect(faltaNda(s, rel())).toBe(true)
    expect(puedeDescargar(s, rel(), "plano.pdf")).toBe(false)
    const t = trabajoParaTaller(s, rel())
    expect(t.descripcion).toBe("")
    expect(t.nda_requerido).toBe(true)
  })
  it("con NDA aceptado se ve y se baja lo permitido", () => {
    const s = base({ nda: "requerido" })
    expect(puedeDescargar(s, rel({ nda: true }), "plano.pdf")).toBe(true)
    expect(trabajoParaTaller(s, rel({ nda: true })).descripcion).toContain("Pieza secreta")
  })
  it("un archivo 'sólo el taller que elija' no lo baja nadie más", () => {
    const s = base()
    expect(puedeDescargar(s, rel({ invitado: true }), "modelo.step")).toBe(false)
    expect(puedeDescargar(s, rel({ elegido: true }), "modelo.step")).toBe(true)
    expect(puedeDescargar(s, rel(), "plano.pdf")).toBe(true)
  })
  it("el texto lleva el folio y su huella cambia si cambia el texto", () => {
    expect(textoNda("A-1")).toContain("A-1")
    expect(huellaNda(textoNda("A-1"))).not.toBe(huellaNda(textoNda("A-2")))
  })
})
