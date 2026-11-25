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
import { secretoLigas } from "./secreto-ligas"

export const VERIFICAR_DESDE = () => new Date(process.env.VERIFICAR_CORREO_DESDE || "2026-10-31T02:00:00Z")
const VIGENCIA_DIAS = 7

// Sin secreto propio (lib/secreto-ligas.ts) no hay firma: "" y ninguna liga vale.
const firmar = (id: string, exp: number) => {
  const s = secretoLigas()
  return s ? createHmac("sha256", s).update(`verificar:${id}:${exp}`).digest("base64url").slice(0, 32) : ""
}

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

/** Ids de las cuentas de cliente con ese correo en las que se puede confiar:
 *  correo confirmado (o cuentas de antes de pedir confirmación). El registro de
 *  la tienda no verifica el correo, así que alguien podía abrir una cuenta con
 *  el correo de otra persona y recibir sus avisos de pedido (auditoría Thermos,
 *  15 nov 2026). */
export async function clientesConCorreoConfiable(knex: any, email: string | null | undefined): Promise<string[]> {
  const correo = String(email || "").trim().toLowerCase()
  if (!correo) return []
  const filas = await knex("customer")
    .whereRaw("lower(email) = ?", [correo])
    .whereNull("deleted_at")
    .select("id", "email", "has_account", "metadata", "created_at")
  return filas
    .map((f: any) => ({ ...f, metadata: typeof f.metadata === "string" ? JSON.parse(f.metadata) : f.metadata }))
    .filter((f: any) => !requiereVerificacion(f))
    .map((f: any) => String(f.id))
}

/** "" si no hay secreto para firmar (no se manda una liga que no va a servir). */
export function ligaVerificacion(id: string): string {
  const exp = Math.floor(Date.now() / 1000) + VIGENCIA_DIAS * 86400
  const t = firmar(id, exp)
  if (!t) return ""
  // Va bajo /api/app/: en el servidor, nginx manda todo /api/v... a otro
  // servicio (Express) y /api/verificar-correo daba "Cannot GET".
  return `${STORE_URL}/api/app/verificar-correo?c=${encodeURIComponent(id)}&e=${exp}&t=${t}`
}

export function firmaVerificacionValida(id: string, exp: string, firma: string): boolean {
  const n = Number(exp)
  if (!id || !Number.isFinite(n) || n * 1000 < Date.now()) return false
  const esperada = firmar(id, n)
  if (!esperada) return false
  const a = Buffer.from(esperada)
  const b = Buffer.from(String(firma || ""))
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── Código de 6 dígitos (25 nov 2026) ───────────────────────────────────────
// Va en el mismo correo que la liga, para quien abre el correo en el celular
// pero se registró en la computadora. No se guarda: sale de la firma de la
// cuenta y de la hora en que se mandó, y sirve CODIGO_HORAS. Para que no se
// pueda adivinar, cada cuenta tiene CODIGO_MAX_FALLOS intentos fallidos al día
// (se cuentan en customer.metadata.codigo_fallos, que el cliente no puede tocar).
export const CODIGO_HORAS = 24
export const CODIGO_MAX_FALLOS = 8
const HORA = 3600_000

export function codigoVerificacion(id: string, hora = Math.floor(Date.now() / HORA)): string {
  const s = secretoLigas()
  if (!s || !id) return ""
  const h = createHmac("sha256", s).update(`codigo:${id}:${hora}`).digest()
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, "0")
}

export function codigoValido(id: string, codigo: string, ahora = Date.now()): boolean {
  const limpio = String(codigo || "").replace(/[^0-9]/g, "")
  if (limpio.length !== 6) return false
  const hora = Math.floor(ahora / HORA)
  for (let i = 0; i < CODIGO_HORAS; i++) {
    const esperado = codigoVerificacion(id, hora - i)
    if (esperado && timingSafeEqual(Buffer.from(esperado), Buffer.from(limpio))) return true
  }
  return false
}

type Fallos = { n: number; desde: string }
/** Fallos del día de esta cuenta (se reinician a las 24 h del primero). */
export function fallosVigentes(meta: Record<string, unknown> | null | undefined, ahora = Date.now()): Fallos {
  const f = (meta?.codigo_fallos || null) as Fallos | null
  if (!f || !f.desde || ahora - new Date(f.desde).getTime() > 24 * HORA) return { n: 0, desde: new Date(ahora).toISOString() }
  return { n: Number(f.n) || 0, desde: f.desde }
}

export async function mandarCorreoVerificacion(c: { id: string; email: string; first_name?: string | null }) {
  // El registro la manda dos veces casi juntas (el aviso de cuenta creada y
  // la tienda al ver que falta confirmar): sólo sale una por minuto.
  const liga = ligaVerificacion(c.id)
  if (!liga) return { sent: false, reason: "falta el secreto para firmar la liga (BAJA_SECRET)" }
  if (!puedeReenviar(c.id)) return { sent: false, reason: "ya se mandó hace menos de un minuto" }
  const codigo = codigoVerificacion(c.id)
  return sendEmail({
    to: c.email,
    subject: "Confirma tu correo para activar tu cuenta de HETNA CNC",
    html: marco(
      "Confirma tu correo",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${c.first_name ? `Hola ${esc(c.first_name)}:` : "Hola:"} gracias por crear tu cuenta en HETNA CNC. Para activarla, confirma que este correo es tuyo:</p>` +
        boton("Confirmar mi correo", liga) +
        (codigo
          ? `<p style="margin:18px 0 6px;color:#40403A;line-height:1.5">¿Te registraste en otro aparato? Escribe este código en la página donde creaste tu cuenta:</p>` +
            `<p style="margin:0;font-size:30px;font-weight:700;letter-spacing:8px;color:#142033">${codigo}</p>` +
            `<p style="margin:4px 0 0;color:#6B6A63;font-size:13px">El código sirve ${CODIGO_HORAS} horas.</p>`
          : "") +
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
