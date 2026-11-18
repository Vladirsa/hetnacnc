// Cifrado en reposo de llaves de terceros (lib/cifrado-llaves.ts) y su uso en
// Mercado Pago, Facturapi y las redes (TikTok, Pinterest, Google, Threads).
import { randomBytes } from "crypto"

import { _reiniciarAviso, cifradoListo, cifrar, cifrarCampos, descifrar, estaCifrado, leerLlave, PREFIJO } from "../cifrado-llaves"

const LLAVE = randomBytes(32).toString("hex")
const OTRA = randomBytes(32).toString("hex")
const SECRETO = "APP_USR-1234567890-token-del-taller"

const conLlave = (actual?: string, anterior?: string) => {
  if (actual === undefined) delete process.env.LLAVES_CIFRADO
  else process.env.LLAVES_CIFRADO = actual
  if (anterior === undefined) delete process.env.LLAVES_CIFRADO_ANTERIOR
  else process.env.LLAVES_CIFRADO_ANTERIOR = anterior
}

afterEach(() => {
  conLlave(undefined, undefined)
  jest.restoreAllMocks()
})

describe("cifrado-llaves", () => {
  it("ida y vuelta: cifra con prefijo y descifra igual", () => {
    conLlave(LLAVE)
    const enc = cifrar(SECRETO)
    expect(enc.startsWith(PREFIJO)).toBe(true)
    expect(enc).not.toContain(SECRETO)
    expect(descifrar(enc)).toBe(SECRETO)
    // IV al azar: dos cifrados del mismo texto no se parecen
    expect(cifrar(SECRETO)).not.toBe(enc)
  })

  it("el texto plano viejo pasa tal cual", () => {
    conLlave(LLAVE)
    expect(descifrar(SECRETO)).toBe(SECRETO)
    conLlave(undefined)
    expect(descifrar(SECRETO)).toBe(SECRETO)
  })

  it("null, undefined, vacío y no-texto pasan sin cambios", () => {
    conLlave(LLAVE)
    for (const v of [null, undefined, "", 5, true]) {
      expect(cifrar(v as any)).toBe(v)
      expect(descifrar(v as any)).toBe(v)
    }
  })

  it("sin llave no cifra (y avisa una sola vez por hora)", () => {
    conLlave(undefined)
    _reiniciarAviso()
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    expect(cifradoListo()).toBe(false)
    expect(cifrar(SECRETO)).toBe(SECRETO)
    expect(cifrar(SECRETO)).toBe(SECRETO)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).not.toContain(SECRETO)
  })

  it("con llave de formato inválido tampoco cifra", () => {
    conLlave("corta")
    _reiniciarAviso()
    jest.spyOn(console, "warn").mockImplementation(() => {})
    expect(cifradoListo()).toBe(false)
    expect(cifrar(SECRETO)).toBe(SECRETO)
  })

  it("no cifra dos veces", () => {
    conLlave(LLAVE)
    const enc = cifrar(SECRETO)
    expect(cifrar(enc)).toBe(enc)
    expect(enc.split(PREFIJO)).toHaveLength(2)
  })

  it("cifrado y sin llave: error claro sin el valor", () => {
    conLlave(LLAVE)
    const enc = cifrar(SECRETO)
    conLlave(undefined)
    expect(() => descifrar(enc)).toThrow(/falta LLAVES_CIFRADO/)
  })

  it("llave equivocada: error claro sin el valor", () => {
    conLlave(LLAVE)
    const enc = cifrar(SECRETO)
    conLlave(OTRA)
    let msg = ""
    try {
      descifrar(enc)
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).toMatch(/no es la llave que cifró/)
    expect(msg).not.toContain(SECRETO)
    expect(msg).not.toContain(enc)
  })

  it("datos alterados no se aceptan", () => {
    conLlave(LLAVE)
    const enc = cifrar(SECRETO)
    const partes = enc.slice(PREFIJO.length).split(":")
    const datos = Buffer.from(partes[2], "base64url")
    datos[0] ^= 1
    expect(() => descifrar(`${PREFIJO}${partes[0]}:${partes[1]}:${datos.toString("base64url")}`)).toThrow(/no es la llave/)
    expect(() => descifrar(`${PREFIJO}abc`)).toThrow(/dañada/)
  })

  it("rotación: descifra con la anterior y cifra con la nueva", () => {
    conLlave(LLAVE)
    const vieja = cifrar(SECRETO)
    conLlave(OTRA, LLAVE)
    expect(descifrar(vieja)).toBe(SECRETO)
    const nueva = cifrar(SECRETO)
    conLlave(OTRA)
    expect(descifrar(nueva)).toBe(SECRETO)
    expect(() => descifrar(vieja)).toThrow(/no es la llave/)
  })

  it("lee la llave en hex o base64 de 32 bytes y rechaza lo demás", () => {
    const b = randomBytes(32)
    expect(leerLlave(b.toString("hex"))?.equals(b)).toBe(true)
    expect(leerLlave(b.toString("base64"))?.equals(b)).toBe(true)
    expect(leerLlave(b.toString("base64url"))?.equals(b)).toBe(true)
    expect(leerLlave(`  ${b.toString("hex")}\n`)?.equals(b)).toBe(true)
    expect(leerLlave(randomBytes(16).toString("hex"))).toBeNull()
    expect(leerLlave(randomBytes(48).toString("base64"))).toBeNull()
    expect(leerLlave("")).toBeNull()
    expect(leerLlave(undefined)).toBeNull()
    expect(leerLlave("z".repeat(64))).toBeNull()
  })

  it("cifrarCampos no toca el original", () => {
    conLlave(LLAVE)
    const v = { access: SECRETO, refresh: null, otro: "x" }
    const c = cifrarCampos(v, ["access", "refresh", "falta"])
    expect(v.access).toBe(SECRETO)
    expect(estaCifrado(c.access)).toBe(true)
    expect(c.refresh).toBeNull()
    expect(c.otro).toBe("x")
    expect("falta" in c).toBe(false)
  })
})

// ── Uso en los módulos (con base y APIs falsas) ──────────────────────────

const supaMock = jest.fn()
jest.mock("../cotizador-suscripciones", () => ({
  supa: (...a: any[]) => supaMock(...a),
  supaBase: () => "https://supa.test",
  adminDesdeToken: jest.fn(),
  ErrorSuscripcion: class ErrorSuscripcion extends Error {},
}))
jest.mock("../social-hub", () => ({ T_CONFIG_S: "cfg", T_POST: "post", asegurarSocial: async () => {} }))

/** knex falso: guarda el valor de una clave y anota lo que se escribe. */
function knexFalso(inicial: Record<string, any>) {
  const datos: Record<string, any> = { ...inicial }
  const escrito: any[] = []
  const knex: any = (_tabla: string) => ({
    where: ({ clave }: any) => ({ first: async () => (datos[clave] ? { valor: datos[clave] } : undefined) }),
  })
  knex.raw = async (sql: string, params: any[]) => {
    const clave = /values \('([a-z]+)'/.exec(sql)?.[1] as string
    const v = JSON.parse(params[1])
    datos[clave] = v
    escrito.push(v)
  }
  return { knex, datos, escrito }
}

const respuesta = (cuerpo: any, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) })

describe("tokens de redes cifrados en la configuración", () => {
  it("TikTok: descifra al usar y guarda cifrado al renovar", async () => {
    conLlave(LLAVE)
    process.env.TIKTOK_CLIENT_KEY = "k"
    process.env.TIKTOK_CLIENT_SECRET = "s"
    const { tokenTikTok } = require("../tiktok")
    const { knex, escrito } = knexFalso({ tiktok: { access: cifrar("acc-viejo"), access_hasta: Date.now() + 60_000, refresh: cifrar("ref-1") } })
    expect(await tokenTikTok(knex)).toBe("acc-viejo")

    // Vencido: renueva con el refresh en claro hacia TikTok y guarda cifrado
    const { knex: k2, escrito: e2 } = knexFalso({ tiktok: { access: cifrar("acc-viejo"), access_hasta: 0, refresh: cifrar("ref-1") } })
    const f = jest.spyOn(global, "fetch" as any).mockResolvedValue(respuesta({ access_token: "acc-nuevo", refresh_token: "ref-2", expires_in: 86400 }) as any)
    expect(await tokenTikTok(k2)).toBe("acc-nuevo")
    expect(String((f.mock.calls[0][1] as any).body)).toContain("refresh_token=ref-1")
    expect(escrito).toHaveLength(0)
    expect(e2).toHaveLength(1)
    expect(estaCifrado(e2[0].access)).toBe(true)
    expect(estaCifrado(e2[0].refresh)).toBe(true)
    expect(descifrar(e2[0].access)).toBe("acc-nuevo")
    expect(JSON.stringify(e2[0])).not.toContain("acc-nuevo")
  })

  it("TikTok: el token viejo en claro sigue sirviendo", async () => {
    conLlave(undefined)
    const { tokenTikTok } = require("../tiktok")
    const { knex } = knexFalso({ tiktok: { access: "plano", access_hasta: Date.now() + 60_000 } })
    expect(await tokenTikTok(knex)).toBe("plano")
  })

  it("Pinterest y Google: descifran al usar", async () => {
    conLlave(LLAVE)
    const { tokenPinterest } = require("../pinterest")
    const { knex } = knexFalso({ pinterest: { access: cifrar("pin-acc"), access_hasta: Date.now() + 60_000 } })
    expect(await tokenPinterest(knex)).toBe("pin-acc")

    process.env.GOOGLE_CLIENT_ID = "c"
    process.env.GOOGLE_CLIENT_SECRET = "s"
    const { estadoGoogle } = require("../fabrica/estudio-datos")
    const { knex: kg } = knexFalso({ google: { refresh: cifrar("g-ref") } })
    expect((await estadoGoogle(kg)).conectado).toBe(true)
  })

  it("Threads: descifra el renovado y, si no se puede, usa el del .env", async () => {
    conLlave(LLAVE)
    process.env.THREADS_TOKEN = "token-env-123456789012"
    const { tokenThreads } = require("../threads")
    const base = process.env.THREADS_TOKEN.slice(-12)
    const { knex } = knexFalso({ threads: { base, token: cifrar("renovado") } })
    expect(await tokenThreads(knex)).toBe("renovado")
    conLlave(OTRA)
    jest.spyOn(console, "warn").mockImplementation(() => {})
    expect(await tokenThreads(knex)).toBe(process.env.THREADS_TOKEN)
    delete process.env.THREADS_TOKEN
  })
})

describe("Mercado Pago del taller (negocios_mp)", () => {
  beforeEach(() => supaMock.mockReset())

  it("tokenDelTaller descifra; la renovación guarda cifrado", async () => {
    conLlave(LLAVE)
    const { tokenDelTaller } = require("../cotizacion-liga")
    supaMock.mockResolvedValueOnce([{ negocio_id: "n1", mp_user_id: "77", access_token: cifrar("mp-acc"), refresh_token: cifrar("mp-ref"), expira_en: null }])
    expect(await tokenDelTaller("n1")).toEqual({ token: "mp-acc", mpUserId: "77" })

    process.env.MP_APP_ID = "app"
    process.env.MP_CLIENT_SECRET = "sec"
    const pronto = new Date(Date.now() + 86_400_000).toISOString()
    supaMock.mockResolvedValueOnce([{ negocio_id: "n1", mp_user_id: "77", access_token: cifrar("mp-acc"), refresh_token: cifrar("mp-ref"), expira_en: pronto }])
    supaMock.mockResolvedValueOnce(null)
    const f = jest.spyOn(global, "fetch" as any).mockResolvedValue(respuesta({ access_token: "mp-nuevo", refresh_token: "mp-ref2", user_id: 77, expires_in: 3600 }) as any)
    expect(await tokenDelTaller("n1")).toEqual({ token: "mp-nuevo", mpUserId: "77" })
    expect(JSON.parse((f.mock.calls[0][1] as any).body).refresh_token).toBe("mp-ref")
    const cuerpo = JSON.parse(supaMock.mock.calls[2][1].body)
    expect(descifrar(cuerpo.access_token)).toBe("mp-nuevo")
    expect(descifrar(cuerpo.refresh_token)).toBe("mp-ref2")
    expect(JSON.stringify(cuerpo)).not.toContain("mp-nuevo")
    delete process.env.MP_APP_ID
    delete process.env.MP_CLIENT_SECRET
  })

  it("sin la llave correcta truena con mensaje claro (no usa basura como token)", async () => {
    conLlave(LLAVE)
    const enc = cifrar("mp-acc")
    conLlave(OTRA)
    const { tokenDelTaller } = require("../cotizacion-liga")
    supaMock.mockResolvedValueOnce([{ negocio_id: "n1", mp_user_id: "77", access_token: enc, refresh_token: null, expira_en: null }])
    await expect(tokenDelTaller("n1")).rejects.toThrow(/no es la llave/)
  })
})

describe("Facturapi del taller (negocios_facturapi)", () => {
  beforeEach(() => supaMock.mockReset())

  it("llaveDe descifra la guardada y cifra la que pide nueva", async () => {
    conLlave(LLAVE)
    const { llaveDe } = require("../cotizador-cfdi")
    expect(await llaveDe({ negocio_id: "n1", org_id: "o1", llave_prueba: cifrar("sk_test_x") }, "prueba")).toBe("sk_test_x")
    expect(await llaveDe({ negocio_id: "n1", org_id: "o1", llave_real: "sk_live_plano" }, "real")).toBe("sk_live_plano")

    jest.spyOn(global, "fetch" as any).mockResolvedValue(respuesta("sk_test_nueva") as any)
    supaMock.mockResolvedValueOnce(null)
    expect(await llaveDe({ negocio_id: "n1", org_id: "o1" }, "prueba")).toBe("sk_test_nueva")
    const cuerpo = JSON.parse(supaMock.mock.calls[0][1].body)
    expect(descifrar(cuerpo.llave_prueba)).toBe("sk_test_nueva")
    expect(JSON.stringify(cuerpo)).not.toContain("sk_test_nueva")
  })

  it("si no se puede descifrar NO pide otra llave a Facturapi", async () => {
    conLlave(LLAVE)
    const enc = cifrar("sk_live_x")
    conLlave(undefined)
    const { llaveDe } = require("../cotizador-cfdi")
    const f = jest.spyOn(global, "fetch" as any)
    await expect(llaveDe({ negocio_id: "n1", org_id: "o1", llave_real: enc }, "real")).rejects.toThrow(/falta LLAVES_CIFRADO/)
    expect(f).not.toHaveBeenCalled()
  })
})
