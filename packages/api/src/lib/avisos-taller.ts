// @ts-nocheck
// Cotizador 2.0 · Fase 2 — Avisos al taller cuando su cliente se mueve en la
// liga de la cotización (hetnacnc.com/c/<token>): la abrió, la aceptó o pagó.
//
// Cada aviso va por tres caminos; si uno falla, los demás siguen y el flujo
// del cliente NUNCA se detiene por un aviso:
//   1. Alerta en la app (tabla `alertas` de Supabase; aparece en la pestaña
//      Alertas con su globo rojo).
//   2. Notificación push (Firebase Cloud Messaging HTTP v1) a los teléfonos
//      del taller (usuarios_negocio.fcm_token, lo guarda lib/services/fcm_service.dart).
//   3. Correo al taller (configuracion_empresa.correo o el del administrador).
//
// Variables (.env de packages/api):
//   FIREBASE_SERVICE_ACCOUNT   JSON de la cuenta de servicio de Firebase
//                              (proyecto hetna-cnc), en base64 o tal cual.
//                              Firebase > Configuración > Cuentas de servicio >
//                              Generar nueva clave privada. Sin ella no hay push
//                              (alerta y correo siguen funcionando).
//   RESEND_API_KEY / RESEND_FROM_EMAIL  (ya existen)
import { createSign } from "crypto"

import { supa } from "./cotizador-suscripciones"
import { sendEmail } from "./resend"

export type TipoAviso = "cotizacion_vista" | "cotizacion_aceptada" | "anticipo_pagado" | "comision_hetna"

type Aviso = {
  negocioId: string
  tipo: TipoAviso
  titulo: string // corto, para la notificación y la alerta
  cuerpo: string // una o dos frases
  cotizacionId?: string | null
  clienteId?: string | null
  pedidoId?: string | null
  mensajeCliente?: string // mensaje de WhatsApp sugerido para el cliente
  correo?: boolean // vista: no se manda correo (sería mucho ruido)
  boton?: string // texto del botón del correo (por defecto "Ver la cotización")
}

// ── Firebase Cloud Messaging (HTTP v1) ─────────────────────────────────────────────
let cuentaFirebase: any | null | undefined
function cuenta() {
  if (cuentaFirebase !== undefined) return cuentaFirebase
  const crudo = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim()
  if (!crudo) return (cuentaFirebase = null)
  try {
    const texto = crudo.startsWith("{") ? crudo : Buffer.from(crudo, "base64").toString("utf8")
    const j = JSON.parse(texto)
    cuentaFirebase = j.client_email && j.private_key && j.project_id ? j : null
  } catch {
    cuentaFirebase = null
  }
  return cuentaFirebase
}

let tokenGoogle: { valor: string; vence: number } | null = null
async function accesoGoogle(): Promise<string | null> {
  const c = cuenta()
  if (!c) return null
  if (tokenGoogle && tokenGoogle.vence - Date.now() > 60_000) return tokenGoogle.valor
  const ahora = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const sinFirma = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: c.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  })}`
  const firma = createSign("RSA-SHA256").update(sinFirma).sign(c.private_key, "base64url")
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${sinFirma}.${firma}` }),
    signal: AbortSignal.timeout(10_000),
  })
  const j = (await r.json().catch(() => ({}))) as any
  if (!r.ok || !j.access_token) throw new Error(`Google OAuth ${r.status}: ${j.error_description || j.error || ""}`)
  tokenGoogle = { valor: j.access_token, vence: Date.now() + Number(j.expires_in || 3600) * 1000 }
  return tokenGoogle.valor
}

export const pushListo = () => Boolean(cuenta())

async function push(negocioId: string, titulo: string, cuerpo: string, datos: Record<string, string>, logger?: any) {
  const acceso = await accesoGoogle()
  if (!acceso) return 0
  const filas = await supa<any[]>(
    `/rest/v1/usuarios_negocio?negocio_id=eq.${negocioId}&activo=eq.true&fcm_token=not.is.null&select=fcm_token`
  )
  const tokens = [...new Set(filas.map((f) => f.fcm_token).filter(Boolean))]
  let enviados = 0
  for (const token of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${cuenta().project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${acceso}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: titulo, body: cuerpo },
          data: datos,
          android: { priority: "HIGH", notification: { channel_id: "hetna_cnc_alerts" } },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (r.ok) {
      enviados++
    } else if (r.status === 404 || r.status === 400) {
      // Token viejo (app desinstalada o sesión cerrada): se limpia
      await supa(`/rest/v1/usuarios_negocio?fcm_token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH",
        body: JSON.stringify({ fcm_token: null }),
        headers: { Prefer: "return=minimal" },
      }).catch(() => {})
    } else {
      logger?.warn?.(`[cotizador] push ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`)
    }
  }
  return enviados
}

// ── Correo ─────────────────────────────────────────────────────────────
async function correoDelTaller(negocioId: string): Promise<string | null> {
  const cfg = await supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${negocioId}&select=correo&limit=1`)
  const c = String(cfg[0]?.correo || "").trim()
  if (/^\S+@\S+\.\S+$/.test(c)) return c
  // Si no capturó correo, el del administrador (cuenta de Supabase Auth)
  const admins = await supa<any[]>(
    `/rest/v1/usuarios_negocio?negocio_id=eq.${negocioId}&activo=eq.true&rol=in.(administrador,super_admin)&select=user_id&limit=1`
  )
  const uid = admins[0]?.user_id
  if (!uid) return null
  const u = await supa<any>(`/auth/v1/admin/users/${uid}`).catch(() => null)
  return u?.email || null
}

const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

function htmlCorreo(titulo: string, cuerpo: string, liga: string, boton = "Ver la cotización") {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1B1B18">
  <h2 style="margin:0 0 8px;font-size:20px;color:#142033">${esc(titulo)}</h2>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.5">${esc(cuerpo)}</p>
  <a href="${esc(liga)}" style="display:inline-block;background:#C2560A;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">${esc(boton)}</a>
  <p style="margin:22px 0 0;font-size:12px;color:#7A776E">Aviso automático del Cotizador HETNA. Lo ves también en la app, en Alertas.</p>
</div>`
}

/** Manda el aviso por los tres caminos. Nunca lanza. */
export async function avisarTaller(a: Aviso & { liga: string }, logger?: any) {
  const ahora = new Date().toISOString()

  // 1) Alerta en la app
  try {
    await supa(`/rest/v1/alertas`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        negocio_id: a.negocioId,
        tipo: a.tipo,
        referencia_id: a.pedidoId || a.cotizacionId || null,
        referencia_tipo: a.pedidoId ? "pedido" : a.cotizacionId ? "cotizacion" : null,
        cliente_id: a.clienteId || null,
        titulo: a.titulo,
        mensaje_wa: a.mensajeCliente || null,
        fecha_programada: ahora,
      }),
    })
  } catch (e) {
    logger?.warn?.(`[cotizador] alerta ${a.tipo}: ${(e as Error).message}`)
  }

  // 2) Push
  try {
    await push(a.negocioId, a.titulo, a.cuerpo, { tipo: a.tipo, cotizacion_id: a.cotizacionId || "", pedido_id: a.pedidoId || "" }, logger)
  } catch (e) {
    logger?.warn?.(`[cotizador] push ${a.tipo}: ${(e as Error).message}`)
  }

  // 3) Correo
  if (a.correo !== false) {
    try {
      const para = await correoDelTaller(a.negocioId)
      if (para) await sendEmail({ to: para, subject: a.titulo, html: htmlCorreo(a.titulo, a.cuerpo, a.liga, a.boton) })
    } catch (e) {
      logger?.warn?.(`[cotizador] correo ${a.tipo}: ${(e as Error).message}`)
    }
  }
}
