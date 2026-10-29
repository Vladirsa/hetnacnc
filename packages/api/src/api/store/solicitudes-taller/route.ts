import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../lib/backblaze"
import { sendEmail } from "../../../lib/resend"
import { difundirSolicitud } from "../../../lib/difusion"
import { ADMIN_URL, asegurarSeguimiento, cambiarEtapa, horasRevision, revisionActiva } from "../../../lib/seguimiento"
import {
  type ArchivoSolicitud,
  MAX_ARCHIVOS_SOLICITUD,
  T_SOLICITUD,
  type Trabajo,
  boton,
  esClaveDeSolicitud,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
  nuevoId,
  nuevoToken,
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
  whatsapp?: string
  ciudad?: string
  estado_mx?: string
  cp?: string
  necesidad?: string
  tiene_archivo?: string
  acabado?: string
  // Lo que devolvió /store/solicitud-archivos, uno por archivo subido.
  archivos?: { clave?: string; nombre?: string; tamano?: number }[] | string
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
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Sólo se aceptan claves que generó /store/solicitud-archivos: así nadie
// cuelga a su solicitud un archivo ajeno del bucket.
function leerArchivos(v: Body["archivos"]): ArchivoSolicitud[] {
  let lista: unknown = v
  if (typeof v === "string") {
    try {
      lista = JSON.parse(v)
    } catch {
      lista = []
    }
  }
  if (!Array.isArray(lista)) return []
  return lista
    .filter((a) => a && esClaveDeSolicitud(a.clave))
    .slice(0, MAX_ARCHIVOS_SOLICITUD)
    .map((a) => ({
      clave: String(a.clave),
      nombre: corto(a.nombre || String(a.clave).split("/").pop(), 120),
      tamano: Math.max(0, Math.round(Number(a.tamano) || 0)),
    }))
}

// Ligas firmadas para el correo de HETNA: duran lo más que deja B2 (7 días).
async function ligasDeArchivos(archivos: ArchivoSolicitud[]) {
  const filas: string[] = []
  for (const a of archivos) {
    const r = await getSignedDownloadUrl(a.clave)
    filas.push(r.ok ? `<a href="${esc(r.url)}">${esc(a.nombre)}</a>` : esc(a.nombre))
  }
  return filas.join("<br/>")
}

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

  const archivos = leerArchivos(b.archivos)
  const trabajo: Trabajo = {
    descripcion,
    necesidad: corto(b.necesidad, 80),
    tiene_archivo: corto(b.tiene_archivo, 80),
    acabado: corto(b.acabado, 120),
    archivos,
    servicio: corto(b.servicio, 80),
    material: corto(b.material, 120),
    cantidad: corto(b.cantidad, 40),
    medidas: corto(b.medidas, 120),
    fecha: corto(b.fecha, 40),
    ciudad: corto(b.ciudad, 120),
    estado_mx: corto(b.estado_mx, 60),
    cp: /^\d{5}$/.test(String(b.cp || "")) ? String(b.cp) : "",
    frecuencia: corto(b.frecuencia, 60),
    presupuesto: corto(b.presupuesto, 60),
    acepta_envio: corto(b.acepta_envio, 10),
    archivo: corto(b.archivo_url, 500),
  }
  const contacto = {
    nombre: corto(b.nombre, 120),
    email,
    telefono: corto(b.telefono, 40),
    whatsapp: corto(b.whatsapp, 40),
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

  // Guardar. Con revisión, la solicitud nace en "revision": no la ve ningún
  // taller ni sale en el tablero hasta que HETNA la aprueba, y sus 7 días
  // para recibir propuestas empiezan a contar desde la aprobación.
  const revision = revisionActiva()
  const token = nuevoToken()
  let folio = ""
  let sol: any = null
  try {
    await asegurarSeguimiento(knex)
    const [fila0] = await knex(T_SOLICITUD)
      .insert({
        id: nuevoId("sol"),
        token,
        modo,
        taller_id: taller?.id ?? null,
        estado: revision ? "revision" : "abierta",
        trabajo,
        contacto,
        cierra_en: revision ? null : new Date(Date.now() + DIAS_ABIERTA * 864e5),
      })
      .returning(["id", "folio", "token", "modo", "taller_id", "trabajo", "contacto"])
    sol = fila0
    folio = folioTexto(fila0.folio)
    await cambiarEtapa(knex, sol, "nueva", { actor: "cliente", correo: false })
    await cambiarEtapa(knex, sol, revision ? "en_revision" : "enviada_talleres", { actor: "sistema", correo: false })
  } catch (e) {
    logger.error(`[licitacion] no se pudo guardar la solicitud: ${(e as Error).message}`)
    return res.status(500).json({ message: "No se pudo registrar tu solicitud. Intenta de nuevo en unos minutos." })
  }

  // Respondemos ya; los correos salen después (Resend permite ~2 por segundo).
  res.status(200).json({ ok: true, folio, token, taller: taller ? taller.name : null, revision })

  const liga = ligaPropuestas(token)

  // 1) HETNA: todo, y si hay revisión, la liga para aprobarla
  const destinoHetna = process.env.HETNA_LEADS_EMAIL
  if (destinoHetna) {
    const r = await sendEmail({
      to: destinoHetna,
      subject: `[${folio}] ${revision ? "Revisar y aprobar" : "Nueva"} solicitud ${modo}${taller ? ` · ${taller.name}` : ""}`,
      html: marco(
        `Solicitud ${folio} (${modo})${taller ? ` para ${taller.name}` : ""}`,
        (revision
          ? `<p style="margin:0 0 12px;color:#40403A">Revísala y apruébala en el dashboard. Si nadie la revisa en ${horasRevision()} horas, se envía sola a los talleres.</p>`
          : "") +
          tablaTrabajo(trabajo) +
          `<table style="border-collapse:collapse;font-size:14px;margin-top:14px">` +
          fila("Nombre", contacto.nombre) +
          fila("Correo", contacto.email) +
          fila("Teléfono", contacto.telefono) +
          fila("WhatsApp", contacto.whatsapp) +
          // fila() escapa el valor; las ligas van en HTML ya escapado.
          (archivos.length
            ? `<tr><td style="padding:6px 12px 6px 0;color:#6B675C;vertical-align:top">Descargar</td><td style="padding:6px 0">${await ligasDeArchivos(archivos)}</td></tr>`
            : "") +
          `</table>` +
          (revision ? boton("Revisar en el dashboard", `${ADMIN_URL}/solicitudes`) : boton("Ver la solicitud del cliente", liga))
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
          (revision
            ? `Primero revisamos que tenga lo necesario para cotizar (normalmente en menos de ${horasRevision()} horas); si falta algo te escribimos. Luego la enviamos ` +
              (abierta ? `a los talleres de la red, que te mandan propuestas durante ${DIAS_ABIERTA} días.` : `a <strong>${esc(taller!.name)}</strong> para que te cotice.`)
            : abierta
              ? `Los talleres de la red recibirán tu solicitud y te mandarán sus propuestas durante los próximos ${DIAS_ABIERTA} días.`
              : `<strong>${esc(taller!.name)}</strong> recibirá tu solicitud y te mandará su propuesta.`) +
          ` Te avisaremos por correo en cada paso.</p>` +
          `<p style="margin:0 0 12px;color:#40403A">Guarda esta liga: ahí ves en qué va tu solicitud, comparas propuestas y eliges.</p>` +
          boton("Seguir mi solicitud", liga) +
          `<hr style="border:0;border-top:1px solid #E7E4DC;margin:20px 0"/>` +
          tablaTrabajo(trabajo)
      ),
    })
    if (!r.sent) logger.info(`[licitacion] confirmación no enviada: ${r.reason}`)
    await pausa(600)
  }

  // 3) Talleres y redes: ya, o cuando HETNA la apruebe
  const avisados = revision ? 0 : await difundirSolicitud(knex, logger, sol)

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

  logger.info(`[licitacion] ${folio} ${modo}${taller ? ` para ${taller.handle}` : ""}, ${revision ? "en revisión" : `avisos: ${avisados}`}`)
}
