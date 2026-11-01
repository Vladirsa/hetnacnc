// Alta segura de talleres (vendedores).
//
// Por qué: cualquiera podía registrarse en /seller con un correo ajeno o
// inventado y empezar a publicar. Ahora:
//   1. Al registrarse, el taller recibe una liga para confirmar su correo.
//   2. Al confirmarlo, el administrador recibe un correo con el botón
//      "Aprobar taller" (y aparece en el Centro de control).
//   3. Mientras la tienda no esté aprobada (status "open"), no puede publicar
//      productos ni ofertas (api/vendor/hetna-alta/middlewares.ts).
//   4. Al aprobarla, el taller recibe un correo de bienvenida.
//
// Mercur ya deja a los talleres que se registran solos en "pending_approval" y
// esconde sus ofertas de la tienda; esto agrega la confirmación de correo, el
// aviso al administrador y el bloqueo de publicar (nuestro "Publicar rápido"
// publicaba directo aunque la tienda no estuviera aprobada).
//
// Dónde queda: seller.metadata.correo_confirmado = true (+ correo_confirmado_en).
// El taller no puede escribirla: está en PROTEGIDAS de
// api/vendor/hetna-verificacion/middlewares.ts.
//
// Talleres de antes (creados antes de ALTA_TALLER_DESDE) no tienen que
// confirmar nada: ya estaban y siguen igual.
import { createHmac, timingSafeEqual } from "crypto"

import { MercurModules } from "@mercurjs/types"

import { correosDeLaCasa } from "./cuentas-casa"
import { STORE_URL, VENDOR_URL, boton, esc, fila, marco } from "./licitacion"
import { sendEmail } from "./resend"

export const ALTA_DESDE = () => new Date(process.env.ALTA_TALLER_DESDE || "2026-11-02T00:00:00Z")
const ADMIN = (process.env.ADMIN_PANEL_URL || `${STORE_URL}/dashboard`).replace(/\/$/, "")
const VIGENCIA_CONFIRMAR_DIAS = 7
const VIGENCIA_APROBAR_DIAS = 14

const secreto = () => process.env.BAJA_SECRET || process.env.COOKIE_SECRET || process.env.JWT_SECRET || ""
const firmar = (uso: "confirmar" | "aprobar", id: string, exp: number) =>
  createHmac("sha256", secreto()).update(`taller-${uso}:${id}:${exp}`).digest("base64url").slice(0, 32)

export function firmaValida(uso: "confirmar" | "aprobar", id: string, exp: string, firma: string): boolean {
  const n = Number(exp)
  if (!id || !secreto() || !Number.isFinite(n) || n * 1000 < Date.now()) return false
  const a = Buffer.from(firmar(uso, id, n))
  const b = Buffer.from(String(firma || ""))
  return a.length === b.length && timingSafeEqual(a, b)
}

const liga = (uso: "confirmar" | "aprobar", id: string, dias: number) => {
  const exp = Math.floor(Date.now() / 1000) + dias * 86400
  // Bajo /api/app/ de la tienda: nginx manda /api/v... a otro servicio.
  return `${STORE_URL}/api/app/${uso}-taller?s=${encodeURIComponent(id)}&e=${exp}&t=${firmar(uso, id, exp)}`
}

export type TallerAlta = {
  id: string
  name?: string | null
  handle?: string | null
  email?: string | null
  phone?: string | null
  status?: string | null
  created_at?: Date | string | null
  metadata?: Record<string, unknown> | null
}

type ServicioTalleres = {
  retrieveSeller: (id: string) => Promise<TallerAlta>
  updateSellers: (d: { id: string; metadata: Record<string, unknown> }) => Promise<unknown>
}

export const servicioTalleres = (scope: { resolve: (k: string) => unknown }) =>
  scope.resolve(MercurModules.SELLER) as ServicioTalleres

/** ¿Este taller ya confirmó su correo (o no tiene que hacerlo)? */
export function correoConfirmado(t: TallerAlta | null | undefined): boolean {
  if (!t) return false
  if (t.metadata?.correo_confirmado === true) return true
  if (t.email && correosDeLaCasa().includes(t.email.toLowerCase())) return true
  return !t.created_at || new Date(t.created_at).getTime() < ALTA_DESDE().getTime()
}

// Para no mandar diez correos si alguien presiona "reenviar" muchas veces
const ultimoEnvio = new Map<string, number>()
const puedeEnviar = (clave: string) => {
  const t = ultimoEnvio.get(clave) || 0
  if (Date.now() - t < 60_000) return false
  ultimoEnvio.set(clave, Date.now())
  return true
}

export async function mandarConfirmacion(t: TallerAlta) {
  if (!t.email) return { sent: false, reason: "el taller no tiene correo" }
  if (!puedeEnviar(`confirmar:${t.id}`)) return { sent: false, reason: "ya se mandó hace menos de un minuto" }
  return sendEmail({
    to: t.email,
    subject: "Confirma tu correo para activar tu taller en HETNA CNC",
    html: marco(
      "Confirma tu correo",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Hola: recibimos el registro de <strong>${esc(t.name || "tu taller")}</strong> en HETNA CNC. Para seguir, confirma que este correo es tuyo:</p>` +
        boton("Confirmar mi correo", liga("confirmar", t.id, VIGENCIA_CONFIRMAR_DIAS)) +
        `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">Después revisamos tu taller y te avisamos por correo cuando puedas publicar (normalmente en menos de un día hábil). La liga sirve ${VIGENCIA_CONFIRMAR_DIAS} días. Si tú no te registraste, ignora este correo.</p>`
    ),
  })
}

const destinatariosAdmin = () =>
  String(process.env.ALTA_TALLER_AVISAR || process.env.CONTROL_AVISOS_PARA || correosDeLaCasa()[0] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

export async function avisarAdmin(t: TallerAlta) {
  const para = destinatariosAdmin()
  if (!para.length) return
  const html = marco(
    "Taller nuevo por aprobar",
    `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Un taller se registró y ya confirmó su correo. Mientras no lo apruebes, no puede publicar.</p>` +
      `<table style="border-collapse:collapse;font-size:14px">` +
      fila("Taller", t.name || "") +
      fila("Correo", t.email || "") +
      fila("Teléfono", t.phone || "") +
      fila("Registrado", t.created_at ? new Date(t.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : "") +
      `</table>` +
      boton("Revisar y aprobar", liga("aprobar", t.id, VIGENCIA_APROBAR_DIAS)) +
      `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">El botón abre una página para confirmar; nada se aprueba solo con abrir el correo. También puedes hacerlo desde <a href="${esc(`${ADMIN}/sellers`)}">el panel de administración</a>.</p>`
  )
  for (const to of para) {
    await sendEmail({ to, subject: `Taller nuevo por aprobar: ${t.name || t.email || t.id}`, html }).catch(() => undefined)
  }
}

export async function avisarAprobado(t: TallerAlta) {
  if (!t.email) return
  await sendEmail({
    to: t.email,
    subject: "¡Tu taller ya está aprobado en HETNA CNC!",
    html: marco(
      "Tu taller ya está aprobado",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Listo: <strong>${esc(t.name || "tu taller")}</strong> ya puede publicar productos y recibir pedidos en HETNA CNC.</p>` +
        boton("Publicar mi primer producto", `${VENDOR_URL}/publicar`) +
        `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">Consejo: completa tu perfil y pide la insignia de taller verificado; los clientes confían más y te compran más.</p>`
    ),
  }).catch(() => undefined)
}

/** Marca el correo como confirmado. Devuelve true si cambió (primera vez). */
export async function marcarConfirmado(scope: { resolve: (k: string) => unknown }, id: string): Promise<boolean> {
  const talleres = servicioTalleres(scope)
  const t = await talleres.retrieveSeller(id)
  if (t.metadata?.correo_confirmado === true) return false
  await talleres.updateSellers({
    id,
    metadata: { ...(t.metadata || {}), correo_confirmado: true, correo_confirmado_en: new Date().toISOString() },
  })
  return true
}

/** Mensaje para el taller cuando intenta publicar sin estar aprobado. null = puede publicar. */
export function motivoParaNoPublicar(t: TallerAlta): string | null {
  if (t.status === "open") return null
  if (t.status === "suspended") return "Tu tienda está suspendida. Escríbenos por WhatsApp para revisarlo."
  if (t.status === "terminated") return "Esta tienda está cerrada."
  if (!correoConfirmado(t)) {
    return "Antes de publicar confirma tu correo: te mandamos una liga al registrarte. Si no te llegó, búscala en spam o pide otra desde Mi tablero."
  }
  return "Tu tienda está en revisión. Te avisamos por correo en cuanto la aprobemos (normalmente en menos de un día hábil) y entonces podrás publicar."
}
