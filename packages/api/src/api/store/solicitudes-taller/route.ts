import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../lib/resend"
import {
  T_SOLICITUD,
  type Trabajo,
  VENDOR_URL,
  asegurarTablas,
  boton,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
  nuevoId,
  nuevoToken,
  ocultarContacto,
  tablaTrabajo,
} from "../../../lib/licitacion"

// Solicitud de fabricación (licitación HETNA).
// - modo "directa": va a un taller elegido por el cliente.
// - modo "abierta": la ven todos los talleres en su panel y mandan propuesta.
// HETNA recibe todo; los talleres reciben el trabajo SIN datos de contacto;
// el cliente recibe una liga privada para comparar y elegir propuestas.

type Body = {
  taller?: string
  abierta?: boolean | string
  nombre?: string
  email?: string
  telefono?: string
  ciudad?: string
  estado_mx?: string
  servicio?: string
  material?: string
  cantidad?: string | number
  medidas?: string
  fecha?: string
  frecuencia?: string
  presupuesto?: string
  acepta_envio?: string
  descripcion?: string
  archivo_url?: string
  sitio_web?: string // trampa para bots: debe llegar vacío
}

const SITIO = process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"
const corto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)
const DIAS_ABIERTA = 7
const MAX_AVISOS = 60
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
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

  const trabajo: Trabajo = {
    descripcion,
    servicio: corto(b.servicio, 80),
    material: corto(b.material, 120),
    cantidad: corto(b.cantidad, 40),
    medidas: corto(b.medidas, 120),
    fecha: corto(b.fecha, 40),
    ciudad: corto(b.ciudad, 120),
    estado_mx: corto(b.estado_mx, 60),
    frecuencia: corto(b.frecuencia, 60),
    presupuesto: corto(b.presupuesto, 60),
    acepta_envio: corto(b.acepta_envio, 10),
    archivo: corto(b.archivo_url, 500),
  }
  const contacto = {
    nombre: corto(b.nombre, 120),
    email,
    telefono: corto(b.telefono, 40),
  }

  // Taller elegido (opcional)
  let taller: { id: string; name: string; email: string | null; handle: string } | null = null
  const handle = corto(b.taller, 120)
  if (handle) {
    try {
      taller =
        (await knex("seller")
          .where({ handle })
          .whereNull("deleted_at")
          .first("id", "name", "email", "handle")) || null
    } catch (e) {
      logger.warn(`[licitacion] no se pudo buscar el taller ${handle}: ${(e as Error).message}`)
    }
  }
  const abierta = !taller || b.abierta === true || b.abierta === "1" || b.abierta === "true"
  const modo = abierta ? "abierta" : "directa"

  // Guardar
  const token = nuevoToken()
  let folio = ""
  try {
    await asegurarTablas(knex)
    const [fila0] = await knex(T_SOLICITUD)
      .insert({
        id: nuevoId("sol"),
        token,
        modo,
        taller_id: taller?.id ?? null,
        trabajo,
        contacto,
        cierra_en: new Date(Date.now() + DIAS_ABIERTA * 864e5),
      })
      .returning(["folio"])
    folio = folioTexto(fila0.folio)
  } catch (e) {
    logger.error(`[licitacion] no se pudo guardar la solicitud: ${(e as Error).message}`)
    return res.status(500).json({ message: "No se pudo registrar tu solicitud. Intenta de nuevo en unos minutos." })
  }

  // Respondemos ya; los correos salen después (Resend permite ~2 por segundo).
  res.status(200).json({ ok: true, folio, token, taller: taller ? taller.name : null })

  const liga = ligaPropuestas(token)
  const trabajoTaller: Trabajo = { ...trabajo, descripcion: ocultarContacto(trabajo.descripcion) }

  // 1) HETNA: todo
  const destinoHetna = process.env.HETNA_LEADS_EMAIL
  if (destinoHetna) {
    const r = await sendEmail({
      to: destinoHetna,
      subject: `[${folio}] Nueva solicitud ${modo}${taller ? ` · ${taller.name}` : ""}`,
      html: marco(
        `Solicitud ${folio} (${modo})${taller ? ` para ${taller.name}` : ""}`,
        tablaTrabajo(trabajo) +
          `<table style="border-collapse:collapse;font-size:14px;margin-top:14px">` +
          fila("Nombre", contacto.nombre) +
          fila("Correo", contacto.email) +
          fila("Teléfono", contacto.telefono) +
          `</table>` +
          boton("Ver propuestas del cliente", liga)
      ),
    })
    if (!r.sent) logger.info(`[licitacion] correo a HETNA no enviado: ${r.reason}`)
    await pausa(600)
  }

  // 2) Cliente: confirmación con liga privada
  {
    const r = await sendEmail({
      to: email,
      subject: `[${folio}] Recibimos tu solicitud — ${SITIO}`,
      html: marco(
        "Recibimos tu solicitud",
        `<p style="margin:0 0 12px;color:#40403A">Hola${contacto.nombre ? ` ${esc(contacto.nombre)}` : ""}, tu folio es <strong>${esc(folio)}</strong>. ` +
          (abierta
            ? `Los talleres de la red recibirán tu solicitud y te mandarán sus propuestas durante los próximos ${DIAS_ABIERTA} días.`
            : `<strong>${esc(taller!.name)}</strong> recibirá tu solicitud y te mandará su propuesta.`) +
          ` Te avisaremos por correo cada vez que llegue una.</p>` +
          `<p style="margin:0 0 12px;color:#40403A">Guarda esta liga: ahí puedes comparar precios y tiempos y elegir la propuesta que más te convenga.</p>` +
          boton("Ver mis propuestas", liga) +
          `<hr style="border:0;border-top:1px solid #E7E4DC;margin:20px 0"/>` +
          tablaTrabajo(trabajo)
      ),
    })
    if (!r.sent) logger.info(`[licitacion] confirmación no enviada: ${r.reason}`)
    await pausa(600)
  }

  // 3) Talleres: trabajo sin contacto + liga a su panel
  const avisoTaller = (nombreTaller?: string) =>
    marco(
      nombreTaller ? `${nombreTaller}: un cliente quiere tu cotización` : "Nueva solicitud de fabricación",
      `<p style="margin:0 0 12px;color:#40403A">Folio <strong>${esc(folio)}</strong>. ` +
        `Manda tu precio y tiempo de entrega desde tu panel de HETNA. El cliente compara propuestas y elige; ` +
        `el pago y el envío se hacen dentro de la plataforma.</p>` +
        tablaTrabajo(trabajoTaller) +
        boton("Enviar mi propuesta", `${VENDOR_URL}/solicitudes`)
    )

  const destinos: { email: string; nombre?: string }[] = []
  if (taller?.email) destinos.push({ email: taller.email, nombre: taller.name })
  if (abierta) {
    try {
      const otros = (await knex("seller")
        .whereNull("deleted_at")
        .whereNotNull("email")
        .modify((q: any) => (taller ? q.whereNot({ id: taller.id }) : q))
        .limit(500)
        .select("email", "metadata")) as { email: string; metadata: any }[]
      for (const s of otros) {
        const servicios: string[] = s.metadata?.perfil?.servicios || []
        const coincide = !trabajo.servicio || !servicios.length || servicios.includes(trabajo.servicio)
        if (coincide && destinos.length < MAX_AVISOS) destinos.push({ email: s.email })
      }
    } catch (e) {
      logger.warn(`[licitacion] no se pudo listar talleres: ${(e as Error).message}`)
    }
  }
  for (const d of destinos) {
    const r = await sendEmail({
      to: d.email,
      subject: `[${folio}] Nueva solicitud de fabricación en ${SITIO}`,
      html: avisoTaller(d.nombre),
    })
    if (!r.sent) logger.info(`[licitacion] aviso a taller no enviado: ${r.reason}`)
    await pausa(600)
  }

  // 4) n8n
  const n8n = process.env.N8N_QUOTE_LEAD_WEBHOOK_URL
  if (n8n) {
    try {
      await fetch(n8n, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "solicitud_taller",
          folio,
          modo,
          taller: taller ? { nombre: taller.name, handle: taller.handle } : null,
          ...trabajo,
          ...contacto,
          liga,
        }),
      })
    } catch (e) {
      logger.warn(`[licitacion] fallo aviso n8n: ${(e as Error).message}`)
    }
  }

  logger.info(`[licitacion] ${folio} ${modo}${taller ? ` para ${taller.handle}` : ""}, avisos: ${destinos.length}`)
}
