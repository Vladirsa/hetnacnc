// @ts-nocheck
// Marketing HETNA — Talleres promotores.
// (docs/pendientes-marketing.md · docs/investigacion-marketing-viral.md, idea A y B)
//
// 1. Kit de difusión: cada taller recibe insignias para presumir en sus redes
//    ("Taller verificado", "Top 3 en corte láser en Puebla", calificación,
//    certificaciones), su QR y textos listos. Todo apunta a SU perfil con una
//    liga medida del Social Hub, así se cuenta lo que trae cada taller.
//    Las imágenes se dibujan en el navegador del taller (panel /promocion).
// 2. Videos de trabajos: el taller sube videos de sus máquinas o del antes y
//    después, con autorización expresa (texto versionado, fecha e IP). HETNA
//    los revisa en el Social Hub y, al aprobarlos, los publica con crédito y
//    liga al perfil del taller. Así HETNA tiene contenido original y legal.
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { STORE_URL, T_PROPUESTA, T_SOLICITUD, nuevoId } from "./licitacion"
import { ligaPara, urlCorta, T_LIGA, T_EVENTO_S, crearPublicacion, leerConfig, dentroDeHorario, asegurarSocial } from "./social-hub"
import { sendEmail } from "./resend"

export const T_VIDEO = "hetna_taller_video"
export const MAX_MB_VIDEO = 60
export const VERSION_AUTORIZACION = "2026-11-09"
export const TEXTO_AUTORIZACION =
  "Autorizo a HETNA CNC a publicar este video en hetnacnc.com, en sus redes sociales y en su publicidad, con crédito a mi taller y liga a mi perfil, " +
  "de forma gratuita y no exclusiva mientras no lo retire. Declaro que el video es mío, que no contiene música ni imágenes de terceros sin permiso, " +
  "y que tengo permiso del cliente para mostrar la pieza o que en el video no se reconoce su diseño ni información confidencial."

// Mismas especialidades que la página pública /talleres/ranking
export const ESPECIALIDADES: { clave: string; nombre: string; re: RegExp }[] = [
  { clave: "laser", nombre: "Corte láser", re: /l[aá]ser/i },
  { clave: "plasma", nombre: "Plasma", re: /plasma/i },
  { clave: "fresado", nombre: "Fresado y torno", re: /fresad|torno|maquinad|centro de/i },
  { clave: "router", nombre: "Router CNC", re: /router/i },
  { clave: "3d", nombre: "Impresión 3D", re: /3d|impresi[oó]n/i },
  { clave: "moldes", nombre: "Moldes", re: /molde/i },
]
const PRIOR = 4
const PESO = 3
const bayes = (valor: number | null | undefined, n: number) => (valor == null || !n ? 0 : (PRIOR * PESO + Number(valor) * n) / (PESO + n))
const textoPerfil = (p: any) => [...(p?.servicios || []), ...(p?.capacidades || []), ...(p?.maquinas || []).map((m: any) => JSON.stringify(m))].join(" ")

let listo = false
export async function asegurarPromocion(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_VIDEO))) {
    await knex.schema.createTable(T_VIDEO, (t: any) => {
      t.text("id").primary()
      t.text("seller_id").notNullable().index()
      t.text("file_id")
      t.text("url").notNullable()
      t.text("mime")
      t.integer("tamano")
      t.text("descripcion")
      t.text("solicitud_id")
      t.text("autorizo_version").notNullable()
      t.timestamp("autorizo_en", { useTz: true }).notNullable()
      t.text("autorizo_ip")
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | aprobado | rechazado | retirado
      t.text("motivo")
      t.text("post_id")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
  listo = true
}

// ---------------------------------------------------------------------
// Posición del taller en el ranking (para la insignia "Top N")
// ---------------------------------------------------------------------

/** Lugar del taller por especialidad, en su estado y en todo México. Sólo con evaluaciones reales. */
export async function posicionesRanking(knex: any, sellerId: string) {
  const todos = await knex("seller").whereNull("deleted_at").where({ status: "open" }).select("id", "metadata").catch(() => knex("seller").whereNull("deleted_at").select("id", "metadata"))
  const yo = todos.find((t: any) => t.id === sellerId)
  const p = yo?.metadata?.perfil || {}
  if (!yo || !(p.resenas > 0) || yo.metadata?.prueba) return []
  const evaluados = todos.filter((t: any) => !t.metadata?.prueba && (t.metadata?.perfil?.resenas || 0) > 0)
  const lugar = (lista: any[]) => {
    const orden = lista
      .map((t) => ({ id: t.id, s: bayes(t.metadata?.perfil?.calificacion, t.metadata?.perfil?.resenas || 0), n: t.metadata?.perfil?.resenas || 0 }))
      .sort((a, b) => b.s - a.s || b.n - a.n)
    const i = orden.findIndex((x) => x.id === sellerId)
    return i < 0 ? null : { lugar: i + 1, de: orden.length }
  }
  const out: { especialidad: string; clave: string; region: string; lugar: number; de: number }[] = []
  for (const e of ESPECIALIDADES) {
    if (!e.re.test(textoPerfil(p))) continue
    const misma = evaluados.filter((t: any) => e.re.test(textoPerfil(t.metadata?.perfil)))
    if (p.estado) {
      const r = lugar(misma.filter((t: any) => t.metadata?.perfil?.estado === p.estado))
      if (r) out.push({ especialidad: e.nombre, clave: e.clave, region: p.estado, ...r })
    }
    const r = lugar(misma)
    if (r) out.push({ especialidad: e.nombre, clave: e.clave, region: "México", ...r })
  }
  // Sólo vale la pena presumir los primeros 10 lugares
  return out.filter((x) => x.lugar <= 10).sort((a, b) => a.lugar - b.lugar)
}

// ---------------------------------------------------------------------
// Kit de difusión
// ---------------------------------------------------------------------

export async function kitDifusion(knex: any, sellerId: string) {
  await asegurarPromocion(knex)
  const v = await knex("seller").where({ id: sellerId }).first("id", "name", "handle", "photo", "metadata").catch(() => knex("seller").where({ id: sellerId }).first("id", "name", "handle", "metadata"))
  if (!v) return null
  const m = v.metadata || {}
  const p = m.perfil || {}
  const perfilUrl = `${STORE_URL}/mx/talleres/${v.handle}`
  const codigo = await ligaPara(knex, null, "talleres", perfilUrl, `taller:${v.id}`)
  const liga = urlCorta(codigo)
  const [clics, eventos] = await Promise.all([
    knex(T_LIGA).where({ codigo }).first("clics"),
    knex(T_EVENTO_S).where({ codigo }).whereNot({ tipo: "clic" }).groupBy("tipo").select("tipo").count({ n: "*" }),
  ])
  const lugar = [p.ciudad, p.estado].filter(Boolean).join(", ")
  const ranking = await posicionesRanking(knex, sellerId).catch(() => [])
  const insignias: { clave: string; titulo: string; detalle: string; tono: string }[] = [
    { clave: "en-hetna", titulo: "Encuéntranos en HETNA", detalle: [lugar, "Cotiza tu pieza en línea"].filter(Boolean).join(" · "), tono: "marca" },
  ]
  if (m.verificado === true || m.verificado === "true") insignias.push({ clave: "verificado", titulo: "Taller verificado por HETNA", detalle: "Identidad y taller revisados", tono: "verde" })
  if (m.empresa_verificada === true) insignias.push({ clave: "empresa", titulo: "Empresa verificada", detalle: "Constancia fiscal revisada por HETNA", tono: "verde" })
  for (const r of ranking.slice(0, 3)) {
    insignias.push({ clave: `top-${r.clave}-${r.region}`, titulo: r.lugar <= 3 ? `Top ${r.lugar} en ${r.especialidad}` : `#${r.lugar} en ${r.especialidad}`, detalle: `${r.region} · Ranking HETNA por evaluaciones de clientes`, tono: "oro" })
  }
  if (p.calificacion && p.resenas) {
    insignias.push({ clave: "calificacion", titulo: `★ ${p.calificacion} de 5`, detalle: `${p.resenas} ${p.resenas === 1 ? "trabajo evaluado" : "trabajos evaluados"} en HETNA`, tono: "oro" })
  }
  for (const c of (Array.isArray(m.certificaciones) ? m.certificaciones : []).slice(0, 2)) {
    insignias.push({ clave: `cert-${c.tipo}-${c.nombre}`, titulo: c.nombre, detalle: "Certificación revisada por HETNA", tono: "verde" })
  }
  if (m.fundador === true) insignias.push({ clave: "fundador", titulo: "Taller fundador de HETNA", detalle: "De los primeros en la plataforma", tono: "marca" })

  const nombre = v.name
  const textos = {
    whatsapp: `Ya estamos en HETNA CNC 🔧 Cotiza tus piezas con nosotros en línea, con pago seguro y seguimiento: ${liga}`,
    facebook: `📣 ${nombre} ya está en HETNA CNC, el marketplace de fabricación CNC en México.${lugar ? `\n📍 ${lugar}` : ""}\n\nMándanos tus planos y cotiza en línea, con pago seguro y seguimiento de tu pedido 👇\n${liga}`,
    instagram: `📣 Ya estamos en HETNA CNC 🔧${lugar ? `\n📍 ${lugar}` : ""}\nCotiza tus piezas en línea con pago seguro. Liga en nuestra bio 👆\n\n#CNC #CorteLaser #Maquinado #HechoEnMexico #HETNACNC`,
    linkedin: `${nombre} ya forma parte de HETNA CNC, el marketplace de fabricación CNC en México. Si tu empresa necesita piezas a la medida, cotiza con nosotros en línea: ${liga}`,
  }
  const videos = await knex(T_VIDEO).where({ seller_id: sellerId }).orderBy("created_at", "desc").limit(30)
  return {
    taller: {
      nombre, handle: v.handle, logo: v.photo || null, lugar, perfil_url: perfilUrl,
      verificado: m.verificado === true || m.verificado === "true",
    },
    liga, codigo,
    resultados: { clics: Number(clics?.clics || 0), ...Object.fromEntries(eventos.map((e: any) => [e.tipo, Number(e.n)])) },
    insignias,
    ranking,
    textos,
    autorizacion: { version: VERSION_AUTORIZACION, texto: TEXTO_AUTORIZACION },
    videos: videos.map((x: any) => ({ id: x.id, url: x.url, descripcion: x.descripcion, estado: x.estado, motivo: x.motivo, fecha: x.created_at, publicado: !!x.post_id })),
    max_mb: MAX_MB_VIDEO,
  }
}

// ---------------------------------------------------------------------
// Videos de trabajos (con autorización)
// ---------------------------------------------------------------------

const firma = (b: Buffer) => {
  // MP4/MOV: "ftyp" en el byte 4; WebM: 1A 45 DF A3
  if (b.toString("ascii", 4, 8) === "ftyp") return b.toString("ascii", 8, 10) === "qt" ? "video/quicktime" : "video/mp4"
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm"
  return null
}

export async function subirVideo(scope: any, sellerId: string, archivo: any, campos: any, ip: string | null) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromocion(knex)
  if (!(campos.autorizo === true || campos.autorizo === "true" || campos.autorizo === "1")) {
    throw Object.assign(new Error("Para publicarlo necesitamos tu autorización: marca la casilla."), { status: 400 })
  }
  if (!archivo?.buffer?.length) throw Object.assign(new Error("Sube un video."), { status: 400 })
  const mime = firma(archivo.buffer)
  if (!mime) throw Object.assign(new Error("Formato no válido. Sube un video MP4, MOV o WebM."), { status: 400 })
  const pendientes = await knex(T_VIDEO).where({ seller_id: sellerId, estado: "pendiente" }).count({ n: "*" }).first()
  if (Number(pendientes?.n || 0) >= 10) throw Object.assign(new Error("Tienes 10 videos en revisión. Espera a que HETNA los revise."), { status: 429 })
  let solicitudId: string | null = String(campos.solicitud_id || "").trim() || null
  if (solicitudId) {
    // Sólo pedidos que ganó este taller
    const ok = await knex(`${T_SOLICITUD} as s`)
      .join(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
      .where({ "s.id": solicitudId, "p.seller_id": sellerId })
      .first("s.id")
      .catch(() => null)
    if (!ok) solicitudId = null
  }
  const id = nuevoId("tvid")
  const ext = mime === "video/webm" ? "webm" : mime === "video/quicktime" ? "mov" : "mp4"
  const archivos = scope.resolve(Modules.FILE)
  const [f] = await archivos.createFiles([{ filename: `taller-video-${id}.${ext}`, mimeType: mime, content: archivo.buffer.toString("base64"), access: "public" }])
  await knex(T_VIDEO).insert({
    id, seller_id: sellerId, file_id: f?.id || null, url: f.url, mime, tamano: archivo.buffer.length,
    descripcion: String(campos.descripcion || "").trim().slice(0, 300) || null, solicitud_id: solicitudId,
    autorizo_version: VERSION_AUTORIZACION, autorizo_en: new Date(), autorizo_ip: ip,
  })
  if (process.env.HETNA_LEADS_EMAIL) {
    const v = await knex("seller").where({ id: sellerId }).first("name")
    await sendEmail({ to: process.env.HETNA_LEADS_EMAIL, subject: `Video nuevo de ${v?.name || "un taller"} para redes`, html: `<p>${v?.name || "Un taller"} subió un video de su trabajo con autorización para publicarlo. Revísalo en Admin → Social Hub → Videos de talleres.</p>` }).catch(() => {})
  }
  return { id }
}

/** El taller retira su video (antes o después de publicarse en HETNA). */
export async function retirarVideo(scope: any, sellerId: string, id: string) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromocion(knex)
  const v = await knex(T_VIDEO).where({ id, seller_id: sellerId }).first()
  if (!v) return false
  await knex(T_VIDEO).where({ id }).update({ estado: "retirado" })
  // Lo que todavía no sale se cancela; lo ya publicado en redes lo baja HETNA a mano
  if (v.post_id) await knex("hetna_social_post").where({ id: v.post_id }).whereIn("estado", ["borrador", "programada"]).update({ estado: "descartada" })
  if (v.file_id && !v.post_id) await scope.resolve(Modules.FILE).deleteFiles([v.file_id]).catch(() => {})
  return true
}

export async function videosParaRevisar(knex: any, estado = "pendiente") {
  await asegurarPromocion(knex)
  return knex(`${T_VIDEO} as x`)
    .join("seller as v", "v.id", "x.seller_id")
    .where("x.estado", estado)
    .orderBy("x.created_at", "desc")
    .limit(100)
    .select("x.*", "v.name as taller", "v.handle", "v.email")
}

/** HETNA aprueba: se crea la publicación con crédito al taller y se programa. */
export async function aprobarVideo(knex: any, id: string, d: { texto?: string; redes?: string[] }, logger?: any) {
  await asegurarPromocion(knex)
  const x = await knex(`${T_VIDEO} as x`).join("seller as v", "v.id", "x.seller_id").where("x.id", id).first("x.*", "v.name as taller", "v.handle", "v.email", "v.metadata")
  if (!x || x.estado !== "pendiente") throw Object.assign(new Error("Este video ya no está pendiente."), { status: 409 })
  const lugar = [x.metadata?.perfil?.ciudad, x.metadata?.perfil?.estado].filter(Boolean).join(", ")
  const base =
    d.texto?.trim() ||
    `🔧 ${x.descripcion || "Así trabaja un taller de HETNA"}\n\nHecho por ${x.taller}${lugar ? ` (${lugar})` : ""}. ¿Necesitas algo así? Cotízalo con ellos: {{liga}}`
  const cfg = await leerConfig(knex)
  const postId = await crearPublicacion(
    knex,
    {
      origen: "taller_video",
      origen_id: x.id,
      titulo: `Video de ${x.taller}`,
      texto_base: base,
      url: `${STORE_URL}/mx/talleres/${x.handle}`,
      medios: [{ url: x.url, tipo: "video" }],
      redes: d.redes as any,
      estado: "programada",
      programada_para: dentroDeHorario(new Date(Date.now() + 15 * 60_000), cfg.horario),
    },
    logger
  )
  await knex(T_VIDEO).where({ id }).update({ estado: "aprobado", post_id: postId })
  if (x.email)
    await sendEmail({
      to: x.email,
      subject: "¡Tu video sale en las redes de HETNA!",
      html: `<p>Aprobamos tu video y lo vamos a publicar en las redes de HETNA con el nombre de tu taller y la liga a tu perfil.</p><p>Compártelo también desde tus redes: cada visita que llegue por tu liga cuenta para ti.</p>`,
    }).catch(() => {})
  return { post_id: postId }
}

export async function rechazarVideo(knex: any, id: string, motivo: string) {
  await asegurarPromocion(knex)
  const x = await knex(`${T_VIDEO} as x`).join("seller as v", "v.id", "x.seller_id").where("x.id", id).first("x.*", "v.email")
  if (!x) throw Object.assign(new Error("Video no encontrado."), { status: 404 })
  await knex(T_VIDEO).where({ id }).update({ estado: "rechazado", motivo: String(motivo || "").slice(0, 300) || null })
  if (x.email && motivo)
    await sendEmail({ to: x.email, subject: "Sobre el video que subiste a HETNA", html: `<p>Esta vez no pudimos publicar tu video: ${String(motivo).replace(/</g, "&lt;")}</p><p>Puedes subir otro desde Promociona tu taller.</p>` }).catch(() => {})
  return { ok: true }
}
