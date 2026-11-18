// Alta segura de talleres (vendedores).
//
// Por qué: cualquiera podía registrarse en /seller con un correo ajeno o
// inventado y empezar a publicar. Ahora (con el alta automática del 17 nov 2026,
// lib/aprobar-taller.ts, el paso 2 aprueba solo y el admin sólo recibe el aviso):
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

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

import { correosDeLaCasa } from "./cuentas-casa"
import { STORE_URL, VENDOR_URL, boton, esc, fila, marco } from "./licitacion"
import { sendEmail } from "./resend"

export const ALTA_DESDE = () => new Date(process.env.ALTA_TALLER_DESDE || "2026-11-02T00:00:00Z")
const ADMIN = (process.env.ADMIN_PANEL_URL || `${STORE_URL}/dashboard`).replace(/\/$/, "")
const VIGENCIA_CONFIRMAR_DIAS = 7
const VIGENCIA_APROBAR_DIAS = 14

const secreto = () => process.env.BAJA_SECRET || process.env.COOKIE_SECRET || process.env.JWT_SECRET || ""
// La liga de confirmar firma también el correo al que se mandó: así se sabe qué
// correo quedó confirmado (lib/cloud.ts importa con él los trabajos CAM).
const firmar = (uso: "confirmar" | "aprobar", id: string, exp: number, correo?: string | null) =>
  createHmac("sha256", secreto())
    .update(`taller-${uso}:${id}:${exp}${correo ? `:${correo.trim().toLowerCase()}` : ""}`)
    .digest("base64url")
    .slice(0, 32)

/** Liga de confirmar: "correo" si la firma incluye el correo actual del taller, "anterior" si es de antes. */
export function firmaConfirmacion(id: string, exp: string, firma: string, correo: string | null | undefined): "correo" | "anterior" | null {
  const n = Number(exp)
  if (!id || !secreto() || !Number.isFinite(n) || n * 1000 < Date.now()) return null
  const igual = (x: string) => {
    const a = Buffer.from(x)
    const b = Buffer.from(String(firma || ""))
    return a.length === b.length && timingSafeEqual(a, b)
  }
  if (correo && igual(firmar("confirmar", id, n, correo))) return "correo"
  return igual(firmar("confirmar", id, n)) ? "anterior" : null
}

export function firmaValida(uso: "confirmar" | "aprobar", id: string, exp: string, firma: string): boolean {
  const n = Number(exp)
  if (!id || !secreto() || !Number.isFinite(n) || n * 1000 < Date.now()) return false
  const a = Buffer.from(firmar(uso, id, n))
  const b = Buffer.from(String(firma || ""))
  return a.length === b.length && timingSafeEqual(a, b)
}

const liga = (uso: "confirmar" | "aprobar", id: string, dias: number, correo?: string | null) => {
  const exp = Math.floor(Date.now() / 1000) + dias * 86400
  // Bajo /api/app/ de la tienda: nginx manda /api/v... a otro servicio.
  return `${STORE_URL}/api/app/${uso}-taller?s=${encodeURIComponent(id)}&e=${exp}&t=${firmar(uso, id, exp, correo)}`
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
        boton("Confirmar mi correo", liga("confirmar", t.id, VIGENCIA_CONFIRMAR_DIAS, t.email)) +
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
      `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">El botón abre una página para confirmar; nada se aprueba solo con abrir el correo. También puedes hacerlo desde <a href="${esc(`${ADMIN}/stores`)}">el panel de administración</a>.</p>`
  )
  for (const to of para) {
    await sendEmail({ to, subject: `Taller nuevo por aprobar: ${t.name || t.email || t.id}`, html }).catch(() => undefined)
  }
}

/** Alta automática: el taller ya puede publicar; HETNA lo revisa después y lo
 *  suspende desde el panel si algo no cuadra. */
export async function avisarAdminAltaAutomatica(t: TallerAlta) {
  const para = destinatariosAdmin()
  if (!para.length) return
  const html = marco(
    "Taller nuevo aprobado automáticamente",
    `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Un taller confirmó su correo y quedó aprobado solo: ya puede publicar. Revisa sus datos y sus primeros productos; si algo no cuadra, suspéndelo desde el panel.</p>` +
      `<table style="border-collapse:collapse;font-size:14px">` +
      fila("Taller", t.name || "") +
      fila("Correo", t.email || "") +
      fila("Teléfono", t.phone || "") +
      fila("Registrado", t.created_at ? new Date(t.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : "") +
      `</table>` +
      boton("Revisar o suspender en el panel", `${ADMIN}/stores/${encodeURIComponent(t.id)}`) +
      `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">Para volver a aprobar a mano cada taller, pon ALTA_AUTOMATICA=false en el .env del API.</p>`
  )
  for (const to of para) {
    await sendEmail({ to, subject: `Taller nuevo (aprobado automáticamente): ${t.name || t.email || t.id}`, html }).catch(() => undefined)
  }
}

const CUPO_FUNDADORES = 30
const WHATSAPP_HETNA = "+52 221 707 6014"

/** Cuántos lugares de taller fundador quedan (null si no se puede leer). */
async function lugaresFundador(scope?: { resolve: (k: string) => any }): Promise<number | null> {
  if (!scope) return null
  try {
    const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const fila = await knex("seller").whereRaw("metadata->>'fundador' = 'true'").whereNull("deleted_at").count({ n: "*" }).first()
    return Math.max(CUPO_FUNDADORES - Number(fila?.n || 0), 0)
  } catch {
    return null
  }
}

/**
 * Bienvenida automática al quedar aprobado (decidido por Vlado el 17 nov 2026):
 * los primeros pasos, el lugar de taller fundador, la prueba del Cotizador CNC,
 * cómo le llegan clientes y cómo cobra. Sólo datos reales de la plataforma.
 */
export async function avisarAprobado(t: TallerAlta, scope?: { resolve: (k: string) => any }) {
  if (!t.email) return
  const quedan = await lugaresFundador(scope)
  const paso = (n: number, titulo: string, texto: string, liga: string, boton_: string) =>
    `<tr><td style="vertical-align:top;padding:10px 12px 10px 0"><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#C2560A;color:#fff;text-align:center;line-height:28px;font-weight:700">${n}</span></td>` +
    `<td style="padding:10px 0"><b style="color:#142033">${titulo}</b><br><span style="color:#40403A">${texto}</span><br><a href="${liga}" style="color:#C2560A;font-weight:700">${boton_} →</a></td></tr>`
  await sendEmail({
    to: t.email,
    subject: `¡Bienvenido a HETNA CNC, ${t.name || "tu taller"}! Tus primeros pasos`,
    html: marco(
      "Tu taller ya está activo",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Hola, equipo de <strong>${esc(t.name || "tu taller")}</strong>: gracias por unirse a HETNA CNC, el marketplace mexicano de fabricación CNC. Su taller ya puede publicar, recibir solicitudes de clientes y vender.</p>` +
        `<p style="margin:0 0 4px;color:#142033;font-weight:700">Para recibir trabajo esta semana (unos 15 minutos):</p>` +
        `<table style="border-collapse:collapse;font-size:14px;line-height:1.45">` +
        paso(1, "Completen su perfil", "Municipio, servicios, máquinas, materiales y 3 a 5 fotos de trabajos terminados. Así los clientes los encuentran y confían.", `${VENDOR_URL}/perfil-taller`, "Completar mi perfil") +
        paso(
          2,
          "Pidan su lugar de taller fundador",
          `Los primeros ${CUPO_FUNDADORES} talleres verificados reciben la insignia de Taller fundador para siempre y <b>6 meses del plan Pro gratis</b> (sus propuestas salen primero).${quedan !== null ? ` Quedan <b>${quedan}</b> lugares.` : ""} Sólo revisamos que el taller sea real.`,
          `${VENDOR_URL}/verificacion`,
          "Verificar mi taller"
        ) +
        paso(3, "Publiquen su primer producto o servicio", "Publicar es gratis: sólo pagan 6% de comisión cuando venden (5% en máquinas CNC).", `${VENDOR_URL}/publicar`, "Publicar ahora") +
        `</table>` +
        `<div style="margin:18px 0;padding:14px 16px;border:2px solid #C2560A;border-radius:12px;background:#FDEEE1">` +
        `<p style="margin:0 0 6px;color:#142033;font-weight:700">🧮 Prueben el Cotizador CNC 14 días sin límite</p>` +
        `<p style="margin:0 0 8px;color:#40403A;line-height:1.5">Calculen el precio de un corte o maquinado en segundos y manden una cotización profesional por WhatsApp o correo. Después pueden seguir gratis con 5 cotizaciones al mes.</p>` +
        `<a href="${STORE_URL}/mx/herramientas-cnc" style="color:#C2560A;font-weight:700">Probar el Cotizador →</a></div>` +
        `<p style="margin:0 0 6px;color:#142033;font-weight:700">Cómo les llega el trabajo y cómo cobran</p>` +
        `<ul style="margin:0 0 12px;padding-left:18px;color:#40403A;line-height:1.5">` +
        `<li>Les llegan solicitudes de clientes con material, medidas, cantidad y archivo, en la pestaña <a href="${VENDOR_URL}/solicitudes" style="color:#C2560A">Solicitudes</a>; cotizan sólo lo que les conviene.</li>` +
        `<li>Verifiquen su WhatsApp desde su panel y les avisamos ahí de los trabajos de su zona.</li>` +
        `<li>El cliente paga con Mercado Pago dentro de HETNA y ustedes empiezan cuando el pago está confirmado. Cada taller factura directo a su cliente.</li>` +
        `<li>Pueden enviar con Envíos HETNA: guías de paquetería desde su panel.</li></ul>` +
        `<p style="margin:16px 0 0;color:#40403A;line-height:1.5">¿Dudas o quieren que les ayudemos a dejar todo listo? Respondan este correo o escríbannos por WhatsApp al ${WHATSAPP_HETNA}.</p>`
    ),
  }).catch(() => undefined)
}

/** Marca el correo como confirmado. Devuelve true si cambió (primera vez). */
export async function marcarConfirmado(scope: { resolve: (k: string) => unknown }, id: string, correo?: string | null): Promise<boolean> {
  const talleres = servicioTalleres(scope)
  const t = await talleres.retrieveSeller(id)
  const email = correo ? correo.trim().toLowerCase() : null
  if (t.metadata?.correo_confirmado === true) {
    // Ya confirmado: sólo se guarda el correo si es la primera vez que se sabe
    if (email && !t.metadata?.correo_confirmado_email) {
      await talleres.updateSellers({ id, metadata: { ...(t.metadata || {}), correo_confirmado_email: email } })
    }
    return false
  }
  await talleres.updateSellers({
    id,
    metadata: {
      ...(t.metadata || {}),
      correo_confirmado: true,
      correo_confirmado_en: new Date().toISOString(),
      ...(email ? { correo_confirmado_email: email } : {}),
    },
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
