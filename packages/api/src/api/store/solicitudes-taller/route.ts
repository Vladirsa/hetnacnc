import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../lib/resend"

// Solicitud de cotización general, opcionalmente dirigida a un taller.
// HETNA recibe todo; el taller recibe el trabajo SIN los datos de contacto
// del cliente (la relación pasa por HETNA); el cliente recibe confirmación.

type Body = {
  taller?: string
  nombre?: string
  email?: string
  telefono?: string
  ciudad?: string
  servicio?: string
  material?: string
  cantidad?: string | number
  fecha?: string
  descripcion?: string
  archivo_url?: string
  sitio_web?: string // trampa para bots: debe llegar vacío
}

const SITIO = process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const corto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)

const fila = (k: string, v: string) =>
  v ? `<tr><td style="padding:6px 12px 6px 0;color:#6B675C;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#142033"><strong>${esc(v)}</strong></td></tr>` : ""

const marco = (titulo: string, cuerpo: string) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #E7E4DC;border-radius:12px;overflow:hidden">
  <div style="background:#142033;color:#fff;padding:18px 22px;font-size:18px;font-weight:bold">${esc(SITIO)}</div>
  <div style="padding:22px">
    <h2 style="margin:0 0 12px;color:#142033;font-size:18px">${esc(titulo)}</h2>
    ${cuerpo}
  </div>
</div>`

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const b = ((req as any).validatedBody || req.body || {}) as Body

  if (b.sitio_web) {
    return res.status(200).json({ ok: true })
  }

  const email = corto(b.email, 160)
  const descripcion = corto(b.descripcion, 3000)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Escribe un correo válido." })
  }
  if (descripcion.length < 10) {
    return res.status(400).json({ message: "Describe tu trabajo (mínimo 10 caracteres)." })
  }

  const d = {
    nombre: corto(b.nombre, 120),
    telefono: corto(b.telefono, 40),
    ciudad: corto(b.ciudad, 120),
    servicio: corto(b.servicio, 80),
    material: corto(b.material, 120),
    cantidad: corto(b.cantidad, 40),
    fecha: corto(b.fecha, 40),
    archivo: corto(b.archivo_url, 500),
  }

  let taller: { id: string; name: string; email: string | null; handle: string } | null = null
  const handle = corto(b.taller, 120)
  if (handle) {
    try {
      const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
      taller =
        (await knex("seller")
          .where({ handle })
          .whereNull("deleted_at")
          .first("id", "name", "email", "handle")) || null
    } catch (e) {
      logger.warn(`[solicitud-taller] no se pudo buscar el taller ${handle}: ${(e as Error).message}`)
    }
  }

  const trabajo =
    `<table style="border-collapse:collapse;font-size:14px">` +
    fila("Servicio", d.servicio) +
    fila("Material", d.material) +
    fila("Cantidad", d.cantidad) +
    fila("Fecha requerida", d.fecha) +
    fila("Ciudad de entrega", d.ciudad) +
    fila("Archivos", d.archivo) +
    `</table><p style="margin:14px 0 0;white-space:pre-line;color:#40403A">${esc(descripcion)}</p>`

  const contacto =
    `<table style="border-collapse:collapse;font-size:14px;margin-top:14px">` +
    fila("Nombre", d.nombre) +
    fila("Correo", email) +
    fila("Teléfono", d.telefono) +
    `</table>`

  // 1) HETNA: todo
  const destinoHetna = process.env.HETNA_LEADS_EMAIL
  if (destinoHetna) {
    const r = await sendEmail({
      to: destinoHetna,
      subject: `Nueva solicitud de cotización${taller ? ` para ${taller.name}` : ""}`,
      html: marco(
        `Solicitud${taller ? ` para ${taller.name}` : " general"}`,
        trabajo + contacto
      ),
    })
    if (!r.sent) logger.info(`[solicitud-taller] correo a HETNA no enviado: ${r.reason}`)
  } else {
    logger.info("[solicitud-taller] HETNA_LEADS_EMAIL no configurado")
  }

  // 2) Taller: el trabajo sin datos de contacto del cliente
  if (taller?.email) {
    const r = await sendEmail({
      to: taller.email,
      subject: `Nueva solicitud de cotización desde ${SITIO}`,
      html: marco(
        "Tienes una nueva solicitud de cotización",
        trabajo +
          `<p style="margin:16px 0 0;color:#40403A">Envía tu precio y tiempo de entrega respondiendo a ${esc(SITIO)}. ` +
          `Nosotros lo hacemos llegar al cliente y el pedido se paga y se envía a través de la plataforma.</p>`
      ),
    })
    if (!r.sent) logger.info(`[solicitud-taller] correo al taller no enviado: ${r.reason}`)
  }

  // 3) Cliente: confirmación
  {
    const r = await sendEmail({
      to: email,
      subject: `Recibimos tu solicitud de cotización — ${SITIO}`,
      html: marco(
        "Recibimos tu solicitud",
        `<p style="margin:0 0 12px;color:#40403A">Hola${d.nombre ? ` ${esc(d.nombre)}` : ""}, ya tenemos tu solicitud` +
          `${taller ? ` para <strong>${esc(taller.name)}</strong>` : ""}. Te enviaremos la cotización a este correo.</p>` +
          trabajo
      ),
    })
    if (!r.sent) logger.info(`[solicitud-taller] confirmación no enviada: ${r.reason}`)
  }

  // 4) n8n (misma alerta que los leads de cotización)
  const n8n = process.env.N8N_QUOTE_LEAD_WEBHOOK_URL
  if (n8n) {
    try {
      await fetch(n8n, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "solicitud_taller",
          taller: taller ? { nombre: taller.name, handle: taller.handle } : null,
          ...d,
          email,
          descripcion,
        }),
      })
    } catch (e) {
      logger.warn(`[solicitud-taller] fallo aviso n8n: ${(e as Error).message}`)
    }
  }

  logger.info(`[solicitud-taller] recibida${taller ? ` para ${taller.handle}` : ""}`)
  return res.status(200).json({ ok: true, taller: taller ? taller.name : null })
}
