import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../lib/backblaze"
import { sendEmail } from "../../../lib/resend"
import { avisarRedes } from "../../../lib/redes"
import {
  type ArchivoSolicitud,
  MAX_ARCHIVOS_SOLICITUD,
  T_SOLICITUD,
  type Trabajo,
  VENDOR_URL,
  asegurarTablas,
  boton,
  esClaveDeSolicitud,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  ligaTrabajo,
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
  whatsapp?: string
  ciudad?: string
  estado_mx?: string
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
const MAX_AVISOS = 60
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ¿El taller dice trabajar el material que pidió el cliente? El cliente
// escribe libre ("MDF de 6 mm", "acero negro cal. 14") y el taller pone una
// lista ("MDF", "Acero"), así que se compara sin acentos ni mayúsculas y
// basta con que una palabra de la lista del taller aparezca en el pedido.
const sinAcentos = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
function trabajaMaterial(materialesTaller: unknown, pedido?: string) {
  if (!pedido || !Array.isArray(materialesTaller)) return false
  const texto = ` ${sinAcentos(pedido)} `
  return materialesTaller.some((m) => {
    const clave = sinAcentos(String(m || "")).trim()
    return clave.length >= 3 && texto.includes(clave)
  })
}

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

  // Guardar
  const token = nuevoToken()
  let folio = ""
  let folioNum = 0
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
    folioNum = Number(fila0.folio)
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
          fila("WhatsApp", contacto.whatsapp) +
          // fila() escapa el valor; las ligas van en HTML ya escapado.
          (archivos.length
            ? `<tr><td style="padding:6px 12px 6px 0;color:#6B675C;vertical-align:top">Descargar</td><td style="padding:6px 0">${await ligasDeArchivos(archivos)}</td></tr>`
            : "") +
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
      // "Otro" no es un servicio que un taller pueda tener en su perfil: si
      // se compara literal, la solicitud no le llega a nadie.
      const servicioPedido = trabajo.servicio && trabajo.servicio !== "Otro" ? trabajo.servicio : ""
      const coinciden = otros.filter((s) => {
        const servicios: string[] = s.metadata?.perfil?.servicios || []
        return !servicioPedido || !servicios.length || servicios.includes(servicioPedido)
      })
      // Con el tope de avisos, el orden decide quién se entera. Primero los
      // que trabajan el material que pide el cliente (si el taller lo puso
      // en su perfil), luego los de su mismo estado, que entregan sin flete
      // caro y son los que más contestan.
      const prioridad = (s: { metadata: any }) =>
        (trabajaMaterial(s.metadata?.perfil?.materiales, trabajo.material) ? 0 : 2) +
        (Boolean(trabajo.estado_mx) && s.metadata?.perfil?.estado === trabajo.estado_mx ? 0 : 1)
      coinciden.sort((x, y) => prioridad(x) - prioridad(y))
      for (const s of coinciden) {
        if (destinos.length >= MAX_AVISOS) break
        destinos.push({ email: s.email })
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

  // Aviso a redes: solo solicitudes abiertas y solo datos publicos (sin contacto)
  if (abierta) {
    await avisarRedes({ tipo: "licitacion", titulo: [trabajo.servicio, trabajo.material].filter(Boolean).join(" - ") || "Trabajo de fabricacion CNC", resumen: [trabajo.cantidad ? "Cantidad: " + trabajo.cantidad : "", trabajo.fecha ? "Para: " + trabajo.fecha : ""].filter(Boolean).join(". "), lugar: [trabajo.ciudad, trabajo.estado_mx].filter(Boolean).join(", "), url: ligaTrabajo(folioNum) }, logger)
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
