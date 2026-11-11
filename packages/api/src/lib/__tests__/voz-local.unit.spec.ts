import { vozLocal, vozLocalLista } from "../fabrica/voz-local"

describe("Voz local (Piper)", () => {
  it("sin Piper instalado no truena: regresa null", async () => {
    process.env.PIPER_DIR = "/no/existe"
    expect(vozLocalLista("es")).toBe(false)
    expect(await vozLocal(["hola"], "es")).toBeNull()
  })
})
