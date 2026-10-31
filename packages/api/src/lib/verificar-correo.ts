// Confirmación de correo de las cuentas nuevas de la tienda.
//
// Por qué: sin confirmar, cualquiera abre cuentas con correos ajenos o
// inventados (fraude, spam en mensajes, abuso de las descargas gratis). Una
// cuenta nueva no puede entrar hasta abrir la liga que le llega por correo.
//
// Qué cuentas: las que tienen contraseña (has_account) creadas desde
// VERIFICAR_CORREO_DESDE. Las de antes ya estaban y siguen igual. Las cuentas
// de la casa (lib/cuentas-casa.ts) nunca piden confirmación.
//
// Dónde queda: customer.metadata.correo_verificado = true. Lo pone sólo el
// servidor al abrir la liga firmada; el cliente no lo puede escribir porque
// api/store/customers/proteger-metadata.ts lo quita de lo que manda.
import { createHmac, timingSafeEqual } from "crypto"

import { correosDeLaCasa } from "./cuentas-casa"
import { STORE_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"

export const VERIFICAR_DESDE = () => new Date(process.env.VERIFICAR_CORREO_DESDE || "2026-10-31T02:00:00Z")
const VIGENCIA_DIAS = 7

const secreto = () => process.env.BAJA_SECRET || process.env.COOKIE_SECRET || process.env.JWT_SECRET || ""
const firmar = (id: string, exp: number) =>
  createHmac("sha256", secreto()).update(`verificar:${id}:${exp}`).digest("base64url").slice(0, 32)

export type ClienteParaVerificar = {
  id: string
  email: string | null
  has_account?: boolean | null
  created_at: Date | string | null
  metadata?: Record<string, unknown> | null
}

/** ¿Esta cuenta todavía tiene que confirmar su correo? */
export function requiereVerificacion(c: ClienteParaVerificar | null | undefined): boolean {
  if (!c || !c.has_account) return false
  if (c.metadata?.correo_verificado === true) return false
  if (c.email && correosDeLaCasa().includes(c.email.toLowerCase())) return false
  return !!c.created_at && new Date(c.created_at).getTime() >= VERIFICAR_DESDE().getTime()
}

export function ligaVerificacion(id: string): string {
  const exp = Math.floor(Date.now() / 1000) + VIGENCIA_DIAS * 86400
  // Va bajo /api/app/: en el servidor, nginx manda todo /api/v... a otro
  // servicio (Express) y /api/verificar-correo daba "Cannot GET".
  return `${STORE_URL}/api/app/verificar-correo?c=${encodeURIComponent(id)}&e=${exp}&t=${firmar(id, exp)}`
}

export function firmaVerificacionValida(id: string, exp: string, firma: string): boolean {
  const n = Number(exp)
  if (!id || !Number.isFinite(n) || n * 1000 < Date.now()) return false
  const a = Buffer.from(firmar(id, n))
  const b = Buffer.from(String(firma || ""))
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function mandarCorreoVerificacion(c: { id: string; email: string; first_name?: string | null }) {
  // El registro la manda dos veces casi juntas (el aviso de cuenta creada y
  // la tienda al ver que falta confirmar): sólo sale una por minuto.
  if (!puedeReenviar(c.id)) return { sent: false, reason: "ya se mandó hace menos de un minuto" }
  const liga = ligaVerificacion(c.id)
  return sendEmail({
    to: c.email,
    subject: "Confirma tu correo para activar tu cuenta de HETNA CNC",
    html: marco(
      "Confirma tu correo",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${c.first_name ? `Hola ${esc(c.first_name)}:` : "Hola:"} gracias por crear tu cuenta en HETNA CNC. Para activarla, confirma que este correo es tuyo:</p>` +
        boton("Confirmar mi correo", liga) +
        `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">La liga sirve ${VIGENCIA_DIAS} días. Si tú no creaste esta cuenta, ignora este correo.</p>`
    ),
  })
}

// Para no mandar diez correos si alguien presiona "reenviar" muchas veces
const ultimoEnvio = new Map<string, number>()
export function puedeReenviar(id: string): boolean {
  const t = ultimoEnvio.get(id) || 0
  if (Date.now() - t < 60_000) return false
  ultimoEnvio.set(id, Date.now())
  return true
}

/**
 * Middleware para rutas de cliente con sesión: si la cuenta no ha confirmado
 * su correo, 403. Va DESPUÉS de authenticate("customer", ...).
 */
export function exigirCorreoVerificado() {
  return async (req: any, res: any, next: () => void) => {
    const id = req.auth_context?.actor_id
    if (!id) return next()
    try {
      const { Modules } = await import("@medusajs/framework/utils")
      const [c] = await req.scope.resolve(Modules.CUSTOMER).listCustomers({ id }, { take: 1 })
      if (requiereVerificacion(c)) {
        return res.status(403).json({
          message: "Confirma tu correo para usar esta función. Te mandamos la liga al registrarte.",
          codigo: "correo_sin_confirmar",
        })
      }
    } catch {
      // si no se puede revisar, no se bloquea a nadie
    }
    next()
  }
}
