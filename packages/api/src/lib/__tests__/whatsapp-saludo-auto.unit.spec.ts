import { esMensajeAutomatico } from "../whatsapp-bot"

// knex mínimo: cuenta en cuántos otros chats ya se mandó el mismo texto
const knexCon = (n: number) =>
  ((_t: string) => {
    const q: any = { where: () => q, whereNot: () => q, countDistinct: () => q, first: async () => ({ n }), catch: () => q }
    return q
  }) as any
;(knexCon as any).raw = () => null

describe("saludo automático de WhatsApp Business", () => {
  const k = (n: number) => Object.assign(knexCon(n), { raw: () => null })

  it("el saludo de HETNA no calla al agente", async () => {
    expect(await esMensajeAutomatico(k(0), "52492", "Gracias por comunicarte con HetNa CNC. Mi nombre es Vladimir ¿Cómo podemos ayudarte? 😀")).toBe(true)
  })

  it("lo que escribe una persona sí lo calla", async () => {
    expect(await esMensajeAutomatico(k(0), "52492", "Dígame")).toBe(false)
    expect(await esMensajeAutomatico(k(0), "52492", "Por el momento no contamos con ese material pero podemos buscar un proveedor")).toBe(false)
  })

  it("un texto largo idéntico en 2 chats o más cuenta como automático", async () => {
    expect(await esMensajeAutomatico(k(2), "52492", "Estamos fuera de horario, te contestamos mañana a primera hora.")).toBe(true)
  })
})
