import { FacebookAuthService, LinkedinAuthService, decidirVinculo, nombreDePerfil } from "../auth-social"

const base = { proveedor: "google", email: "ana@correo.mx", verificado: true, clienteDeLaIdentidad: null, cuentasConEseCorreo: [] as { id: string; confiable: boolean }[] }

describe("decidirVinculo (seguridad al entrar con redes sociales)", () => {
  it("identidad que ya tiene cliente: entra; marca verificado sólo si el correo coincide", () => {
    expect(decidirVinculo({ ...base, clienteDeLaIdentidad: { id: "c1", email: "ana@correo.mx" } })).toEqual({ accion: "entrar", customer_id: "c1", marcarVerificado: true })
    expect(decidirVinculo({ ...base, clienteDeLaIdentidad: { id: "c1", email: "otra@correo.mx" } })).toEqual({ accion: "entrar", customer_id: "c1", marcarVerificado: false })
    expect(decidirVinculo({ ...base, verificado: false, clienteDeLaIdentidad: { id: "c1", email: "ana@correo.mx" } })).toMatchObject({ marcarVerificado: false })
  })
  it("sin correo (o inválido) se rechaza", () => {
    expect(decidirVinculo({ ...base, email: "" }).accion).toBe("rechazar")
    expect(decidirVinculo({ ...base, email: "no-es-correo" }).accion).toBe("rechazar")
  })
  it("cuenta existente confirmada + correo verificado por la red: se une", () => {
    expect(decidirVinculo({ ...base, cuentasConEseCorreo: [{ id: "c9", confiable: true }] })).toEqual({ accion: "vincular", customer_id: "c9" })
  })
  it("cuenta existente SIN confirmar: nunca se une (alguien pudo abrirla con correo ajeno)", () => {
    const d = decidirVinculo({ ...base, cuentasConEseCorreo: [{ id: "c9", confiable: false }] })
    expect(d.accion).toBe("rechazar")
  })
  it("Facebook (correo no verificado) nunca se une a una cuenta existente", () => {
    const d = decidirVinculo({ ...base, proveedor: "facebook", verificado: false, cuentasConEseCorreo: [{ id: "c9", confiable: true }] })
    expect(d.accion).toBe("rechazar")
  })
  it("sin cuenta: crea; verificada sólo si la red verificó el correo", () => {
    expect(decidirVinculo(base)).toEqual({ accion: "crear", verificado: true })
    expect(decidirVinculo({ ...base, proveedor: "facebook", verificado: false })).toEqual({ accion: "crear", verificado: false })
  })
})

describe("nombreDePerfil", () => {
  it("usa nombre y apellidos de la red, o parte el nombre completo", () => {
    expect(nombreDePerfil({ given_name: "Ana", family_name: "López Ruiz" })).toEqual({ first_name: "Ana", last_name: "López Ruiz" })
    expect(nombreDePerfil({ name: "Juan Pérez García" })).toEqual({ first_name: "Juan", last_name: "Pérez García" })
    expect(nombreDePerfil({})).toEqual({ first_name: "", last_name: "" })
  })
})

describe("proveedores OAuth (Facebook y LinkedIn)", () => {
  const opciones = { clientId: "id", clientSecret: "secreto", callbackUrl: "https://hetnacnc.com/api/auth/social/x/regreso" }
  const servicioFalso = () => {
    const estados = new Map<string, any>()
    const identidades = new Map<string, any>()
    return {
      estados,
      identidades,
      setState: async (k: string, v: any) => void estados.set(k, v),
      getState: async (k: string) => estados.get(k) || null,
      retrieve: async ({ entity_id }: any) => {
        if (!identidades.has(entity_id)) throw Object.assign(new Error("no"), { type: "not_found" })
        return identidades.get(entity_id)
      },
      create: async (d: any) => (identidades.set(d.entity_id, { id: "au_" + d.entity_id, ...d }), identidades.get(d.entity_id)),
      update: async (id: string, d: any) => ({ ...identidades.get(id), ...d }),
    }
  }
  const real = global.fetch
  afterEach(() => (global.fetch = real))

  it("authenticate manda a la red con la dirección de regreso configurada (no la del navegador)", async () => {
    const s = servicioFalso()
    const p = new (LinkedinAuthService as any)({}, opciones)
    const r = await p.authenticate({ query: {}, body: { callback_url: "https://malo.com" } }, s)
    const u = new URL(r.location)
    expect(u.origin + u.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization")
    expect(u.searchParams.get("redirect_uri")).toBe(opciones.callbackUrl)
    expect(s.estados.get(u.searchParams.get("state")!)).toEqual({ callback_url: opciones.callbackUrl })
  })

  it("validateCallback de LinkedIn guarda correo y si está verificado", async () => {
    const s = servicioFalso()
    await s.setState("est", { callback_url: opciones.callbackUrl })
    global.fetch = (async (url: string) => {
      if (String(url).includes("accessToken")) return { ok: true, json: async () => ({ access_token: "tk" }) }
      return { ok: true, json: async () => ({ sub: "li123", email: "Ana@Correo.mx", email_verified: true, given_name: "Ana", family_name: "López" }) }
    }) as any
    const p = new (LinkedinAuthService as any)({}, opciones)
    const r = await p.validateCallback({ query: { code: "c", state: "est" } }, s)
    expect(r.success).toBe(true)
    expect(r.authIdentity.user_metadata).toMatchObject({ email: "ana@correo.mx", email_verified: true, given_name: "Ana" })
  })

  it("Facebook: el correo queda como NO verificado; sin state válido falla", async () => {
    const s = servicioFalso()
    await s.setState("est", { callback_url: opciones.callbackUrl })
    global.fetch = (async (url: string) => {
      if (String(url).includes("oauth/access_token")) return { ok: true, json: async () => ({ access_token: "tk" }) }
      return { ok: true, json: async () => ({ id: "fb1", email: "ana@correo.mx", name: "Ana López" }) }
    }) as any
    const p = new (FacebookAuthService as any)({}, opciones)
    const r = await p.validateCallback({ query: { code: "c", state: "est" } }, s)
    expect(r.authIdentity.user_metadata.email_verified).toBe(false)
    expect((await p.validateCallback({ query: { code: "c", state: "otro" } }, s)).success).toBe(false)
  })
})
