// POST /store/talleres-registro
// Registro de un taller que quiere unirse a la red (página /talleres/unete).
//
// No crea la cuenta del panel: eso lo hace el taller en /seller con su correo
// y contraseña. Esto guarda lo que necesita HETNA para conocerlo y darle de
// alta bien (servicios, materiales, máquinas, capacidad, fotos), avisa a HETNA
// y le manda al taller su siguiente paso. Así se arma la base de proveedores
// aunque el taller tarde en crear su cuenta.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SUBIDA, asegurarSubidas } from "../../../lib/archivo-seguro"
import { getSignedDownloadUrls } from "../../../lib/backblaze"
import { VENDOR_URL, boton, esClaveDeTaller, esc, fila, marco, nuevoId } from "../../../lib/licitacion"
import { sendEmail } from "../../../lib/resend"
import { ipCliente } from "../../../lib/ip-cliente"

export const T_PROSPECTO = "hetna_taller_prospecto"

const corto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)
const lista = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => corto(x, 60))
    .filter(Boolean)
    .slice(0, max)

// Este formulario sólo recibe fotos del taller. La carpeta "talleres" comparte
// la subida con las solicitudes (que acepta zip, rar, 7z, svg...), así que aquí
// se exige que la clave termine en una de estas extensiones.
const EXT_FOTO = ["jpg", "jpeg", "png", "webp", "heic"]
const esFoto = (clave: string) => EXT_FOTO.includes((clave.split(".").pop() || "").toLowerCase())
// El nombre que se muestra es el real (último tramo de la clave), no el que
// declare el formulario: así un comprimido no llega al correo como "fachada.jpg".
const nombreReal = (clave: string) => clave.split("/").pop() || "foto"

const POR_HORA = 10
const visitas = new Map<string, number[]>()

async function asegurarTabla(knex: any) {
  if (await knex.schema.hasTable(T_PROSPECTO)) return
  await knex.schema.createTable(T_PROSPECTO, (t: any) => {
    t.text("id").primary()
    t.text("email").notNullable().index()
    t.jsonb("datos").notNullable()
    t.text("estado").notNullable().defaultTo("nuevo") // nuevo | contactado | registrado | descartado
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as Record<string, unknown>

  if (b.sitio_web) return res.status(200).json({ ok: true }) // trampa para bots

  const ip = ipCliente(req)
  const ahora = Date.now()
  const previas = (visitas.get(ip) || []).filter((t) => ahora - t < 3600_000)
  if (previas.length >= POR_HORA) {
    return res.status(429).json({ message: "Recibimos varios registros seguidos. Intenta de nuevo en un rato." })
  }
  visitas.set(ip, [...previas, ahora])

  const email = corto(b.email, 160)
  const nombreTaller = corto(b.nombre_taller, 120)
  if (!nombreTaller) return res.status(400).json({ message: "Escribe el nombre de tu taller." })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Escribe un correo válido." })
  const whatsapp = corto(b.whatsapp, 40)
  if (whatsapp.replace(/\D/g, "").length < 10) {
    return res.status(400).json({ message: "Escribe tu WhatsApp a 10 dígitos para que podamos contactarte." })
  }

  const recibidas = (Array.isArray(b.fotos) ? b.fotos : []).filter((f: any) => f && f.clave).slice(0, 8)
  if (recibidas.some((f: any) => !esClaveDeTaller(f.clave) || !esFoto(String(f.clave)))) {
    return res.status(400).json({ message: "Aquí sólo se aceptan fotos JPG, PNG, WEBP o HEIC. Quita los demás archivos e intenta de nuevo." })
  }
  const fotos = [...new Set(recibidas.map((f: any) => String(f.clave)))].map((clave) => ({ clave, nombre: nombreReal(clave) }))
  // Sólo fotos que pasaron por /store/solicitud-archivos (contenido revisado:
  // la imagen es lo que dice su extensión) y que no usa ya otro registro.
  if (fotos.length) {
    try {
      await asegurarSubidas(knex)
      const filas = (await knex(T_SUBIDA)
        .whereIn("clave", fotos.map((f) => f.clave))
        .where({ carpeta: "talleres" })
        .whereNull("usado_en")
        .whereNull("borrado_en")
        .select("clave")) as { clave: string }[]
      const validas = new Set(filas.map((f) => f.clave))
      const falta = fotos.find((f) => !validas.has(f.clave))
      if (falta) return res.status(400).json({ message: `Vuelve a subir "${falta.nombre}": no la encontramos o ya se usó en otro registro.` })
    } catch (e) {
      logger.error(`[talleres-registro] no se pudieron revisar las fotos: ${(e as Error).message}`)
      return res.status(500).json({ message: "No pudimos guardar tu registro. Intenta de nuevo en unos minutos." })
    }
  }

  const datos = {
    nombre_taller: nombreTaller,
    contacto: corto(b.contacto, 120),
    email,
    whatsapp,
    ciudad: corto(b.ciudad, 120),
    estado_mx: corto(b.estado_mx, 60),
    servicios: lista(b.servicios, 15),
    materiales: lista(b.materiales, 20),
    maquinas: corto(b.maquinas, 1500),
    capacidad: corto(b.capacidad, 120),
    portafolio: corto(b.portafolio, 300),
    comentarios: corto(b.comentarios, 1500),
    fotos,
    // De dónde llegó (anuncio, correo…): lib/origen-visita.ts
    origen: require("../../../lib/origen-visita").limpiarOrigen(b.origen),
  }

  try {
    await asegurarTabla(knex)
    const id = nuevoId("tpro")
    await knex(T_PROSPECTO).insert({ id, email, datos })
    if (fotos.length) await knex(T_SUBIDA).whereIn("clave", fotos.map((f) => f.clave)).update({ usado_en: id })
  } catch (e) {
    logger.error(`[talleres-registro] no se pudo guardar: ${(e as Error).message}`)
    return res.status(500).json({ message: "No pudimos guardar tu registro. Intenta de nuevo en unos minutos." })
  }
  res.status(201).json({ ok: true, panel: VENDOR_URL })

  const destino = process.env.HETNA_LEADS_EMAIL
  if (destino) {
    // Todavía no hay pantalla del panel que muestre estos registros, así que
    // las fotos se abren desde aquí; pero sólo son imágenes revisadas, con su
    // nombre real y con liga que siempre descarga (nunca abre en el navegador).
    let ligas = ""
    if (fotos.length) {
      const firmadas = await getSignedDownloadUrls(fotos.map((f) => f.clave), 604800, undefined, "attachment").catch(() => new Map<string, string>())
      ligas = `${fotos.length} foto${fotos.length === 1 ? "" : "s"} (imágenes revisadas al subirse; la liga dura 7 días):<br/>`
      for (const f of fotos) {
        const url = firmadas.get(f.clave)
        ligas += url ? `<a href="${esc(url)}">${esc(f.nombre)}</a><br/>` : `${esc(f.nombre)}<br/>`
      }
    }
    const r = await sendEmail({
      to: destino,
      subject: `Taller nuevo quiere unirse: ${nombreTaller}${datos.estado_mx ? ` (${datos.estado_mx})` : ""}`,
      html: marco(
        `${nombreTaller} quiere unirse a la red`,
        `<table style="border-collapse:collapse;font-size:14px">` +
          fila("Contacto", datos.contacto) +
          fila("Correo", email) +
          fila("WhatsApp", whatsapp) +
          fila("Ubicación", [datos.ciudad, datos.estado_mx].filter(Boolean).join(", ")) +
          fila("Servicios", datos.servicios.join(", ")) +
          fila("Materiales", datos.materiales.join(", ")) +
          fila("Máquinas", datos.maquinas) +
          fila("Capacidad", datos.capacidad) +
          fila("Portafolio", datos.portafolio) +
          fila("Comentarios", datos.comentarios) +
          (ligas ? `<tr><td style="padding:6px 12px 6px 0;color:#6B675C;vertical-align:top">Fotos</td><td>${ligas}</td></tr>` : "") +
          `</table>`
      ),
    })
    if (!r.sent) logger.info(`[talleres-registro] aviso a HETNA no enviado: ${r.reason}`)
  }

  const r = await sendEmail({
    to: email,
    subject: "Recibimos tu registro en la red de talleres HETNA",
    html: marco(
      "¡Bienvenido a la red de talleres HETNA!",
      `<p style="margin:0 0 12px;color:#40403A">Hola${datos.contacto ? ` ${esc(datos.contacto)}` : ""}, recibimos los datos de <strong>${esc(nombreTaller)}</strong>.</p>` +
        `<p style="margin:0 0 12px;color:#40403A"><strong>Tu siguiente paso:</strong> crea tu cuenta en el panel de talleres con este mismo correo y completa tu perfil (servicios, materiales y máquinas). ` +
        `Con eso empiezas a recibir solicitudes de tu proceso. Después verificamos tu taller con una identificación y fotos para darte la insignia de Taller verificado.</p>` +
        boton("Crear mi cuenta de taller", VENDOR_URL) +
        `<p style="margin:16px 0 0;color:#6B675C;font-size:13px">Si tienes dudas, responde este correo o escríbenos por WhatsApp.</p>`
    ),
  })
  if (!r.sent) logger.info(`[talleres-registro] bienvenida no enviada: ${r.reason}`)
}
