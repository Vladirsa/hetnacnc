// Entrar con Facebook y LinkedIn (Google lo trae Medusa: @medusajs/medusa/auth-google).
//
// Proveedor OAuth 2.0 sencillo: manda al usuario a la red, recibe el código, lo
// cambia por un token y lee el perfil (id, nombre, correo y si el correo está
// verificado). La identidad queda en el módulo de autenticación de Medusa; quién
// es el cliente lo decide decidirVinculo() en /store/hetna-social/completar.
//
// Seguridad (revisión del 27 nov 2026):
//   - el correo sale SIEMPRE del perfil de la red, nunca de lo que mande el navegador
//   - sólo se une a una cuenta existente si la red dice que el correo está verificado
//     (Google y LinkedIn lo dicen; Facebook no lo dice: nunca se une sola)
//   - nunca se une a una cuenta con correo sin confirmar (alguien pudo abrirla con
//     el correo de otra persona y seguir entrando con su contraseña)
import crypto from "crypto"
import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"

export type PerfilSocial = { id: string; email: string; verificado: boolean; nombre: string; given_name?: string; family_name?: string; picture?: string }

export type ConfigOAuth = {
  identificador: string
  nombre: string
  autorizar: string
  token: string
  alcances: string
  separador?: string // cómo se juntan los alcances (Facebook: coma)
  tokenPorGet?: boolean // Facebook cambia el código con GET
  perfil: (accessToken: string) => Promise<PerfilSocial>
}

type Opciones = { clientId: string; clientSecret: string; callbackUrl: string }

export function crearProveedorOAuth(cfg: ConfigOAuth) {
  class ProveedorOAuth extends AbstractAuthModuleProvider {
    static identifier = cfg.identificador
    static DISPLAY_NAME = cfg.nombre
    protected config_: Opciones

    static validateOptions(o: Opciones) {
      if (!o?.clientId || !o?.clientSecret || !o?.callbackUrl) throw new Error(`${cfg.nombre}: faltan clientId, clientSecret o callbackUrl`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(contenedor: any, opciones: Opciones) {
      // @ts-ignore
      super(...arguments)
      this.config_ = opciones
    }

    async register(): Promise<never> {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${cfg.nombre} no registra directo: usa authenticate.`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async authenticate(req: any, servicio: any) {
      if (req.query?.error) return { success: false, error: String(req.query.error_description || req.query.error) }
      const clave = crypto.randomBytes(32).toString("hex")
      // Siempre la dirección de regreso configurada (no la que mande el navegador)
      await servicio.setState(clave, { callback_url: this.config_.callbackUrl })
      const u = new URL(cfg.autorizar)
      u.searchParams.set("client_id", this.config_.clientId)
      u.searchParams.set("redirect_uri", this.config_.callbackUrl)
      u.searchParams.set("response_type", "code")
      u.searchParams.set("scope", cfg.alcances)
      u.searchParams.set("state", clave)
      return { success: true, location: u.toString() }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateCallback(req: any, servicio: any) {
      const q = req.query ?? {}
      if (q.error) return { success: false, error: String(q.error_description || q.error) }
      if (!q.code) return { success: false, error: "No llegó el código de la red social." }
      const estado = q.state ? await servicio.getState(q.state) : null
      if (!estado) return { success: false, error: "La sesión expiró: vuelve a intentarlo." }
      try {
        const params = new URLSearchParams({
          client_id: this.config_.clientId,
          client_secret: this.config_.clientSecret,
          code: String(q.code),
          redirect_uri: this.config_.callbackUrl,
          grant_type: "authorization_code",
        })
        const r = cfg.tokenPorGet
          ? await fetch(`${cfg.token}?${params}`, { signal: AbortSignal.timeout(15_000) })
          : await fetch(cfg.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(15_000) })
        if (!r.ok) throw new Error(`${cfg.nombre} no aceptó el código (${r.status})`)
        const { access_token } = (await r.json()) as { access_token?: string }
        if (!access_token) throw new Error(`${cfg.nombre} no regresó el token`)
        const p = await cfg.perfil(access_token)
        if (!p.id) throw new Error(`${cfg.nombre} no regresó el usuario`)
        const user_metadata = { email: p.email, email_verified: p.verificado, name: p.nombre, given_name: p.given_name, family_name: p.family_name, picture: p.picture }
        let authIdentity
        try {
          authIdentity = await servicio.retrieve({ entity_id: p.id })
          // El correo o el nombre pudieron cambiar en la red: se guarda lo más nuevo
          authIdentity = (await servicio.update(p.id, { user_metadata }).catch(() => null)) || authIdentity
        } catch (e) {
          if ((e as { type?: string }).type !== MedusaError.Types.NOT_FOUND) throw e
          authIdentity = await servicio.create({ entity_id: p.id, user_metadata })
        }
        return { success: true, authIdentity }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  }
  return ProveedorOAuth
}

const pedirJson = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`No se pudo leer el perfil (${r.status})`)
  return (await r.json()) as Record<string, unknown>
}
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export const FacebookAuthService = crearProveedorOAuth({
  identificador: "facebook",
  nombre: "Facebook",
  autorizar: "https://www.facebook.com/v21.0/dialog/oauth",
  token: "https://graph.facebook.com/v21.0/oauth/access_token",
  alcances: "email,public_profile",
  tokenPorGet: true,
  perfil: async (token) => {
    const d = await pedirJson(`https://graph.facebook.com/v21.0/me?fields=id,name,first_name,last_name,email&access_token=${encodeURIComponent(token)}`)
    // Facebook no dice si el correo está verificado: se trata como NO verificado
    return { id: txt(d.id), email: txt(d.email).toLowerCase(), verificado: false, nombre: txt(d.name), given_name: txt(d.first_name), family_name: txt(d.last_name) }
  },
})

export const LinkedinAuthService = crearProveedorOAuth({
  identificador: "linkedin",
  nombre: "LinkedIn",
  autorizar: "https://www.linkedin.com/oauth/v2/authorization",
  token: "https://www.linkedin.com/oauth/v2/accessToken",
  alcances: "openid profile email",
  perfil: async (token) => {
    const d = await pedirJson("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } })
    return { id: txt(d.sub), email: txt(d.email).toLowerCase(), verificado: d.email_verified === true, nombre: txt(d.name), given_name: txt(d.given_name), family_name: txt(d.family_name), picture: txt(d.picture) }
  },
})

// ---------------------------------------------------------------------
// Qué hacer con la identidad que regresó la red (pura, se prueba)
// ---------------------------------------------------------------------

export const PROVEEDORES_SOCIALES = ["google", "facebook", "linkedin"] as const
export type ProveedorSocial = (typeof PROVEEDORES_SOCIALES)[number]

export type Decision =
  | { accion: "entrar"; customer_id: string; marcarVerificado: boolean }
  | { accion: "vincular"; customer_id: string }
  | { accion: "crear"; verificado: boolean }
  | { accion: "rechazar"; motivo: string }

export function decidirVinculo(d: {
  proveedor: string
  email: string
  verificado: boolean
  clienteDeLaIdentidad: { id: string; email: string | null } | null
  cuentasConEseCorreo: { id: string; confiable: boolean }[] // clientes con cuenta (has_account) y ese correo
}): Decision {
  const red = d.proveedor === "google" ? "Google" : d.proveedor === "facebook" ? "Facebook" : "LinkedIn"
  const email = String(d.email || "").trim().toLowerCase()
  // Ya entró antes con esta red: se entra; sólo se marca el correo como verificado si es el mismo
  if (d.clienteDeLaIdentidad) {
    const mismo = !!email && String(d.clienteDeLaIdentidad.email || "").toLowerCase() === email
    return { accion: "entrar", customer_id: d.clienteDeLaIdentidad.id, marcarVerificado: d.verificado && mismo }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { accion: "rechazar", motivo: `Tu cuenta de ${red} no comparte tu correo. Crea tu cuenta con correo y contraseña.` }
  const existente = d.cuentasConEseCorreo[0]
  if (existente) {
    if (!d.verificado) return { accion: "rechazar", motivo: `Ya hay una cuenta con ${email}. Entra con tu correo y contraseña (o usa «¿Olvidaste tu contraseña?»).` }
    const confiable = d.cuentasConEseCorreo.find((c) => c.confiable)
    if (!confiable) return { accion: "rechazar", motivo: `Ya hay una cuenta con ${email} que no se ha confirmado. Usa «¿Olvidaste tu contraseña?» para recuperarla con tu correo.` }
    return { accion: "vincular", customer_id: confiable.id }
  }
  return { accion: "crear", verificado: d.verificado }
}

/** Nombre y apellidos para la cuenta nueva (de lo que dé la red). Pura. */
export function nombreDePerfil(m: { name?: string; given_name?: string; family_name?: string }) {
  const nombre = txt(m.given_name)
  const apellidos = txt(m.family_name)
  if (nombre || apellidos) return { first_name: nombre.slice(0, 80), last_name: apellidos.slice(0, 80) }
  const partes = txt(m.name).split(/\s+/).filter(Boolean)
  return { first_name: (partes[0] || "").slice(0, 80), last_name: partes.slice(1).join(" ").slice(0, 80) }
}

// ---------------------------------------------------------------------
// Talleres (panel de vendedor, actor "member")
// ---------------------------------------------------------------------

/**
 * Correo comprobado de una identidad: el de correo y contraseña es con el que se
 * registró; el de una red, el que dio la red. Nunca lo que mande el navegador. Pura.
 */
export function correoDeIdentidad(pis: { provider: string; entity_id?: string; user_metadata?: Record<string, any> | null }[] | undefined) {
  const lista = pis || []
  const ep = lista.find((p) => p.provider === "emailpass")
  const social = lista.find((p) => (PROVEEDORES_SOCIALES as readonly string[]).includes(p.provider))
  const bruto = ep ? ep.entity_id : social?.user_metadata?.email
  const email = String(bruto || "").trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

export type DecisionTaller =
  | { accion: "entrar"; member_id: string }
  | { accion: "vincular"; member_id: string }
  | { accion: "nueva" }
  | { accion: "rechazar"; motivo: string }

/**
 * Entrada de un taller con Google, Facebook o LinkedIn. Pura.
 *   - la identidad ya tiene miembro: entra
 *   - hay un miembro con ese correo: se une sólo si la red verificó el correo
 *     (Facebook no lo dice: nunca se une sola)
 *   - no hay: taller nuevo (el alta usa el correo de la red, ver blindarAltaTaller)
 */
export function decidirTaller(d: { proveedor: string; email: string; verificado: boolean; miembroDeLaIdentidad: string | null; miembroConEseCorreo: string | null }): DecisionTaller {
  const red = d.proveedor === "google" ? "Google" : d.proveedor === "facebook" ? "Facebook" : "LinkedIn"
  if (d.miembroDeLaIdentidad) return { accion: "entrar", member_id: d.miembroDeLaIdentidad }
  if (!d.email) return { accion: "rechazar", motivo: `Tu cuenta de ${red} no comparte tu correo. Entra o regístrate con correo y contraseña.` }
  if (d.miembroConEseCorreo) {
    if (!d.verificado) return { accion: "rechazar", motivo: `Ya hay un taller con ${d.email}. Entra con tu correo y contraseña (o usa «¿Olvidaste tu contraseña?»).` }
    return { accion: "vincular", member_id: d.miembroConEseCorreo }
  }
  return { accion: "nueva" }
}
