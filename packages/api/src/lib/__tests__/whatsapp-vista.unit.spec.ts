import { conVistaPublicidad } from "../whatsapp-bot"
import { STORE_URL } from "../licitacion"

describe("liga de cotizar con anuncio en la vista previa", () => {
  it("agrega wa=N a la liga sin query", () => {
    expect(conVistaPublicidad(`Publica aquí: ${STORE_URL}/mx/cotizar con tus datos`, 7)).toBe(`Publica aquí: ${STORE_URL}/mx/cotizar?wa=7 con tus datos`)
  })
  it("respeta la query y el punto final", () => {
    expect(conVistaPublicidad(`Entra a ${STORE_URL}/mx/cotizar?utm_source=whatsapp.`, 3)).toBe(`Entra a ${STORE_URL}/mx/cotizar?utm_source=whatsapp&wa=3.`)
  })
  it("no toca otras páginas", () => {
    const t = `Mira ${STORE_URL}/mx/cotizar/corte-laser y ${STORE_URL}/mx`
    expect(conVistaPublicidad(t, 1)).toBe(t)
  })
})
