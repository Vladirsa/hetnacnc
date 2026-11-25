// Confirmación de correo (lib/verificar-correo.ts). Llega desde la tienda:
//   GET  /hooks/verificar-correo?c=<cliente>&e=<vence>&t=<firma>  -> sólo revisa la liga (no cambia nada)
//   POST /hooks/verificar-correo  { c, e, t }                      -> confirma
//   POST /hooks/verificar-correo  { email }                        -> reenvía la liga
//   POST /hooks/verificar-correo  { email, codigo }                -> confirma con el código de 6 dígitos
// El GET no confirma a propósito: los antivirus del correo abren las ligas
// solos y con eso un extraño podía dejar confirmada una cuenta con correo ajeno.
// El reenvío no dice si el correo existe (para no regalar qué correos tienen cuenta).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { ligarSolicitudesPorCorreo } from "../../../lib/afiliacion"

import {
  CODIGO_MAX_FALLOS,
  VERIFICAR_DESDE,
  codigoValido,
  fallosVigentes,
  firmaVerificacionValida,
  mandarCorreoVerificacion,
  requiereVerificacion,
} from "../../../lib/verificar-correo"
import { sendEmail } from "../../../lib/resend"
import { welcomeEmailHtml } from "../../../lib/email-templates"

type Leido = { error: number; motivo: string } | { c: any; clientes: any }

const leer = async (req: MedusaRequest, d: Record<string, unknown>): Promise<Leido> => {
  const id = String(d.c || "")
  if (!firmaVerificacionValida(id, String(d.e || ""), String(d.t || ""))) return { error: 400, motivo: "liga" }
  const clientes = req.scope.resolve(Modules.CUSTOMER) as any
  const [c] = await clientes.listCustomers({ id }, { take: 1 })
  if (!c) return { error: 404, motivo: "cuenta" }
  return { c, clientes }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const r = await leer(req, (req.query || {}) as Record<string, unknown>)
  if ("error" in r) return res.status(r.error).json({ ok: false, motivo: r.motivo })
  res.json({ ok: true, ya: r.c.metadata?.correo_verificado === true })
}

async function confirmar(req: MedusaRequest, res: MedusaResponse, d: Record<string, unknown>) {
  const r = await leer(req, d)
  if ("error" in r) return res.status(r.error).json({ ok: false, motivo: r.motivo })
  const ya = await marcarConfirmado(req, r.c, r.clientes)
  res.json({ ok: true, ya })
}

/** Con el código de 6 dígitos del correo. No dice si el correo tiene cuenta. */
async function confirmarConCodigo(req: MedusaRequest, res: MedusaResponse, correo: string, codigo: string) {
  const clientes = req.scope.resolve(Modules.CUSTOMER) as any
  const [c] = await clientes.listCustomers({ email: correo, has_account: true }, { take: 1 })
  const malo = () => res.status(400).json({ ok: false, message: "El código no es correcto. Revisa el último correo que te mandamos." })
  if (!c) return malo()
  if (c.metadata?.correo_verificado === true) return res.json({ ok: true, ya: true })
  const fallos = fallosVigentes(c.metadata)
  if (fallos.n >= CODIGO_MAX_FALLOS) {
    return res.status(429).json({ ok: false, message: "Demasiados intentos. Usa la liga del correo o intenta mañana." })
  }
  if (!codigoValido(c.id, codigo)) {
    await clientes.updateCustomers(c.id, { metadata: { ...(c.metadata || {}), codigo_fallos: { n: fallos.n + 1, desde: fallos.desde } } })
    return malo()
  }
  const ya = await marcarConfirmado(req, c, clientes)
  res.json({ ok: true, ya })
}

/** Deja la cuenta confirmada (una sola vez) y hace lo que sigue. Devuelve true si ya lo estaba. */
async function marcarConfirmado(req: MedusaRequest, c: any, clientes: any): Promise<boolean> {
  const ya = c.metadata?.correo_verificado === true
  if (!ya) {
    const { codigo_fallos: _f, ...resto } = (c.metadata || {}) as Record<string, unknown>
    await clientes.updateCustomers(c.id, {
      metadata: { ...resto, correo_verificado: true, correo_verificado_en: new Date().toISOString() },
    })
    req.scope.resolve("logger").info(`[verificar-correo] ${c.email} confirmó su correo`)
    // Con el correo confirmado, sus solicitudes enviadas sin cuenta pasan a
    // «Mis solicitudes» (antes se ligaban sin confirmar; auditoría Thermos).
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const ligadas = await ligarSolicitudesPorCorreo(knex, c.email, c.id).catch(() => 0)
    if (ligadas) req.scope.resolve("logger").info(`[verificar-correo] ${ligadas} solicitudes ligadas a ${c.id}`)
    // La bienvenida va ahora, ya con el correo confirmado. Las cuentas de antes
    // (que confirman al activar el Cotizador) ya la recibieron al registrarse.
    const nueva = !c.created_at || new Date(c.created_at).getTime() >= VERIFICAR_DESDE().getTime()
    if (nueva) await sendEmail({
      to: c.email,
      subject: `¡Bienvenido a ${process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"}!`,
      html: welcomeEmailHtml({ name: c.first_name || "" }),
    }).catch(() => undefined)
  }
  return ya
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  // Con la firma de la liga (c, e, t) es la confirmación; con { email }, el reenvío.
  if (b.c || b.t) return confirmar(req, res, b)
  const correo = String(b.email || "").trim().toLowerCase()
  if (b.codigo !== undefined) {
    if (!correo.includes("@")) return res.status(400).json({ ok: false, message: "Falta el correo." })
    return confirmarConCodigo(req, res, correo, String(b.codigo))
  }
  if (correo.includes("@")) {
    const clientes = req.scope.resolve(Modules.CUSTOMER) as any
    const lista = await clientes.listCustomers({ email: correo, has_account: true }, { take: 1 })
    const c = lista[0]
    if (c && requiereVerificacion(c)) {
      await mandarCorreoVerificacion({ id: c.id, email: c.email, first_name: c.first_name }).catch(() => undefined)
    }
  }
  res.json({ ok: true })
}
