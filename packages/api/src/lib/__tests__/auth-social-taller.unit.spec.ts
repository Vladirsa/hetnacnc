import { correoDeIdentidad, decidirTaller } from "../auth-social"
import { blindarAltaTaller } from "../../api/vendor/hetna-alta-cuenta/middlewares"

describe("correo de la identidad del taller", () => {
  it("emailpass: el correo con que se registró; red: el de la red", () => {
    expect(correoDeIdentidad([{ provider: "emailpass", entity_id: " Taller@Mail.com " }])).toBe("taller@mail.com")
    expect(correoDeIdentidad([{ provider: "google", entity_id: "123", user_metadata: { email: "a@b.mx" } }])).toBe("a@b.mx")
    expect(correoDeIdentidad([{ provider: "facebook", entity_id: "9", user_metadata: {} }])).toBe("")
    expect(correoDeIdentidad(undefined)).toBe("")
  })
})

describe("entrada del taller con red social", () => {
  const base = { proveedor: "google", email: "a@b.mx", verificado: true, miembroDeLaIdentidad: null, miembroConEseCorreo: null }
  it("ya ligada: entra", () => expect(decidirTaller({ ...base, miembroDeLaIdentidad: "mem_1" })).toEqual({ accion: "entrar", member_id: "mem_1" }))
  it("correo verificado de un taller existente: se une", () => expect(decidirTaller({ ...base, miembroConEseCorreo: "mem_2" })).toEqual({ accion: "vincular", member_id: "mem_2" }))
  it("Facebook sin verificar no se une a un taller existente", () =>
    expect(decidirTaller({ ...base, proveedor: "facebook", verificado: false, miembroConEseCorreo: "mem_2" }).accion).toBe("rechazar"))
  it("sin correo: no", () => expect(decidirTaller({ ...base, email: "" }).accion).toBe("rechazar"))
  it("nuevo: al alta", () => expect(decidirTaller(base)).toEqual({ accion: "nueva" }))
})

describe("alta de taller: el correo del miembro sale de la identidad", () => {
  const armar = (pis: any[], miembroExistente: boolean, ctx: any = { auth_identity_id: "ai_1" }) => {
    const knex: any = () => ({ whereRaw: () => ({ whereNull: () => ({ first: async () => (miembroExistente ? { id: "mem_x" } : undefined) }) }) })
    const req: any = {
      auth_context: ctx,
      body: { name: "Mi taller", member_email: "victima@otro.mx" },
      validatedBody: { name: "Mi taller", member_email: "victima@otro.mx" },
      scope: { resolve: (k: string) => (k === "auth" ? { retrieveAuthIdentity: async () => ({ provider_identities: pis }) } : knex) },
    }
    const res: any = { code: 0, body: null, status(c: number) { this.code = c; return this }, json(b: any) { this.body = b; return this } }
    const next = jest.fn()
    return { req, res, next }
  }
  it("reemplaza el correo que manda el navegador por el de la identidad", async () => {
    const { req, res, next } = armar([{ provider: "emailpass", entity_id: "yo@taller.mx" }], false)
    await blindarAltaTaller(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.body.member_email).toBe("yo@taller.mx")
    expect(req.validatedBody.member_email).toBe("yo@taller.mx")
  })
  it("no deja dar de alta si ya hay un miembro con ese correo", async () => {
    const { req, res, next } = armar([{ provider: "google", entity_id: "1", user_metadata: { email: "yo@taller.mx" } }], true)
    await blindarAltaTaller(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.code).toBe(409)
  })
  it("sin sesión: 401; miembro existente: pasa sin tocar", async () => {
    const a = armar([], false, null)
    await blindarAltaTaller(a.req, a.res, a.next)
    expect(a.res.code).toBe(401)
    const b = armar([], false, { auth_identity_id: "ai_1", actor_id: "mem_1" })
    await blindarAltaTaller(b.req, b.res, b.next)
    expect(b.next).toHaveBeenCalled()
  })
})
