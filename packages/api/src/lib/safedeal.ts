// @ts-nocheck
// Licitaciones 3.0 — Fase 4: conversación privada, HETNA SafeDeal y HETNA Sign.
// (docs/licitaciones-especificacion-maestra.md, secciones 2 y 10)
//
// Después de que el cliente elige una propuesta:
//   1. Cliente y taller conversan en privado dentro de HETNA (contacto oculto
//      hasta que el cliente lo comparta o firmen el acuerdo).
//   2. SafeDeal es OPCIONAL, pero ambos ven una alerta que lo recomienda.
//      Cualquiera de los dos prepara las condiciones (12 apartados); cada
//      cambio borra las aprobaciones. Cuando los dos aprueban, se genera el
//      PDF, se calcula su huella SHA-256 y la versión queda BLOQUEADA.
//   3. Firma electrónica simple con verificación reforzada: código de 6
//      dígitos por correo + nombre + representación + aceptación expresa. Se
//      guardan fecha, IP, navegador y la huella exacta que se firmó.
//   4. Con las dos firmas, el expediente se cierra y se comparten contactos.
//      Cambiar algo después crea una versión nueva que se vuelve a firmar; la
//      versión firmada nunca se modifica (ni HETNA puede hacerlo).
//
// El modelo de contrato todavía no lo revisa un abogado: el PDF lo dice en
// cada página mientras SAFEDEAL_REVISADO no sea "1".
import { createHash, randomInt } from "crypto"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { T_PROPUESTA, T_SOLICITUD, VENDOR_URL, boton, esc, folioTexto, ligaPropuestas, marco, nuevoId, ocultarContacto } from "./licitacion"
import { textoSeguro } from "./pdf-entrega"
import { getSignedDownloadUrls, uploadFile } from "./backblaze"
import { sendEmail } from "./resend"
import { pushACliente, pushATalleres } from "./push"

export const T_MENSAJE = "hetna_solicitud_mensaje"
export const T_CONTRATO = "hetna_contrato"
export const T_FIRMA = "hetna_contrato_firma"
export const T_OTP = "hetna_contrato_otp"
export const T_EVENTO_C = "hetna_contrato_evento"

export type Parte = "cliente" | "taller"
const OTRA = (p: Parte): Parte => (p === "cliente" ? "taller" : "cliente")
const REVISADO = () => process.env.SAFEDEAL_REVISADO === "1"
export const LEYENDA_BORRADOR = "Modelo de contrato pendiente de revisión legal. Revísenlo antes de firmar."

let listo = false
export async function asegurarSafeDeal(knex: any) {
  if (listo) return
  const crear = async (t: string, fn: (tb: any) => void) => {
    if (!(await knex.schema.hasTable(t))) await knex.schema.createTable(t, fn)
  }
  await crear(T_MENSAJE, (t) => {
    t.text("id").primary()
    t.text("solicitud_id").notNullable().index()
    t.text("autor").notNullable() // cliente | taller | hetna
    t.text("texto").notNullable()
    t.timestamp("leido_en")
    t.timestamp("created_at").defaultTo(knex.fn.now())
  })
  await crear(T_CONTRATO, (t) => {
    t.text("id").primary()
    t.text("solicitud_id").notNullable().index()
    t.text("seller_id").notNullable()
    t.integer("version").notNullable()
    t.text("estado").notNullable() // borrador | listo | firmado | reemplazado
    t.jsonb("condiciones").notNullable()
    t.timestamp("aprobo_cliente")
    t.timestamp("aprobo_taller")
    t.text("editado_por")
    t.text("sha256")
    t.text("pdf_clave")
    t.boolean("borrador_legal")
    t.timestamp("firmado_en")
    t.timestamps(true, true)
  })
  await crear(T_FIRMA, (t) => {
    t.text("id").primary()
    t.text("contrato_id").notNullable().index()
    t.text("parte").notNullable()
    t.text("nombre").notNullable()
    t.text("representacion")
    t.text("email")
    t.text("metodo").notNullable()
    t.text("ip")
    t.text("agente")
    t.text("sha256").notNullable()
    t.timestamp("created_at").defaultTo(knex.fn.now())
    t.unique(["contrato_id", "parte"])
  })
  await crear(T_OTP, (t) => {
    t.text("contrato_id").notNullable()
    t.text("parte").notNullable()
    t.text("codigo_hash").notNullable()
    t.timestamp("expira").notNullable()
    t.integer("intentos").defaultTo(0)
    t.primary(["contrato_id", "parte"])
  })
  await crear(T_EVENTO_C, (t) => {
    t.text("id").primary()
    t.text("solicitud_id").notNullable().index()
    t.text("contrato_id")
    t.text("evento").notNullable()
    t.text("actor").notNullable()
    t.jsonb("detalle")
    t.text("ip")
    t.timestamp("created_at").defaultTo(knex.fn.now())
  })
  await knex.raw(`alter table ?? add column if not exists contactos_liberados boolean`, [T_SOLICITUD])
  listo = true
}

const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex")
/** Huella de las condiciones: aprobar exige haber visto exactamente estas. */
export const huellaCondiciones = (c: any) => sha(JSON.stringify(APARTADOS.map(([k]) => (c || {})[k] || "")))
const fecha = (d: any) =>
  d ? new Date(d).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }) : ""

async function evento(knex: any, s: any, contratoId: string | null, ev: string, actor: string, detalle: any = null, ip: string | null = null) {
  await knex(T_EVENTO_C).insert({ id: nuevoId("cev"), solicitud_id: s.id, contrato_id: contratoId, evento: ev, actor, detalle: detalle ? JSON.stringify(detalle) : null, ip })
}

// ---------------------------------------------------------------------
// Partes
// ---------------------------------------------------------------------

/** Propuesta elegida con los datos del taller. null si aún no hay elegida. */
export async function elegidaDe(knex: any, s: any) {
  if (!s?.propuesta_elegida) return null
  return knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where("p.id", s.propuesta_elegida)
    .first("p.*", "v.id as seller_id", "v.name as taller", "v.email as taller_email", "v.phone as taller_telefono", "v.metadata as taller_metadata")
    .catch(() =>
      knex(`${T_PROPUESTA} as p`)
        .join("seller as v", "v.id", "p.seller_id")
        .where("p.id", s.propuesta_elegida)
        .first("p.*", "v.id as seller_id", "v.name as taller", "v.email as taller_email", "v.metadata as taller_metadata")
    )
}

/** ¿Ya se comparten los contactos? (el cliente lo autorizó o firmaron SafeDeal) */
export const contactosLiberados = (s: any) => s?.compartir_contacto === true || s?.contactos_liberados === true

export function contactoCliente(s: any) {
  const c = s?.contacto || {}
  return { nombre: c.nombre || "", empresa: c.empresa || "", email: c.email || "", telefono: c.telefono || "", whatsapp: c.whatsapp || "" }
}
export function contactoTaller(p: any) {
  const perfil = p?.taller_metadata?.perfil || {}
  return { nombre: p?.taller || "", email: p?.taller_email || "", telefono: p?.taller_telefono || perfil.telefono || "", whatsapp: perfil.whatsapp || "" }
}

// ---------------------------------------------------------------------
// Conversación privada
// ---------------------------------------------------------------------

export async function mensajesDe(knex: any, s: any, parte: Parte) {
  await asegurarSafeDeal(knex)
  const filas = await knex(T_MENSAJE).where({ solicitud_id: s.id }).orderBy("created_at", "asc").limit(500)
  // Marca como leídos los del otro
  await knex(T_MENSAJE).where({ solicitud_id: s.id, autor: OTRA(parte) }).whereNull("leido_en").update({ leido_en: knex.fn.now() })
  return filas.map((m: any) => ({ id: m.id, autor: m.autor, texto: m.texto, fecha: m.created_at, mio: m.autor === parte }))
}

export async function enviarMensaje(knex: any, s: any, parte: Parte, texto: string, logger?: any) {
  await asegurarSafeDeal(knex)
  const p = await elegidaDe(knex, s)
  if (!p) return { ok: false, status: 409, message: "La conversación se abre cuando el cliente elige una propuesta." }
  let t = String(texto || "").trim().slice(0, 2000)
  if (!t) return { ok: false, status: 400, message: "Escribe tu mensaje." }
  const libres = contactosLiberados(s)
  if (!libres) t = ocultarContacto(t)
  const id = nuevoId("msg")
  await knex(T_MENSAJE).insert({ id, solicitud_id: s.id, autor: parte, texto: t })

  // Aviso al otro (sin repetir si ya tiene mensajes sin leer de hace menos de 30 min)
  const reciente = await knex(T_MENSAJE)
    .where({ solicitud_id: s.id, autor: parte })
    .whereNull("leido_en")
    .whereNot({ id })
    .where("created_at", ">", knex.raw("now() - interval '30 minutes'"))
    .first("id")
  if (!reciente) {
    const folio = folioTexto(s.folio)
    if (parte === "taller") {
      await pushACliente(knex, { customerId: s.cliente_id, email: s.contacto?.email }, { titulo: `Mensaje de ${p.taller}`, cuerpo: t.slice(0, 120), url: ligaPropuestas(s.token), etiqueta: `msg-${s.id}` }, logger).catch(() => {})
      if (s.contacto?.email)
        await sendEmail({ to: s.contacto.email, subject: `[${folio}] ${p.taller} te escribió`, html: marco("Tienes un mensaje nuevo", `<p style="color:#40403A;white-space:pre-wrap">${esc(t.slice(0, 600))}</p>` + boton("Responder", ligaPropuestas(s.token))) }).catch(() => {})
    } else {
      await pushATalleres(knex, [p.seller_id], { titulo: `Mensaje del cliente (${folio})`, cuerpo: t.slice(0, 120), url: `${VENDOR_URL}/solicitudes`, etiqueta: `msg-${s.id}` }, logger).catch(() => {})
      if (p.taller_email)
        await sendEmail({ to: p.taller_email, subject: `[${folio}] El cliente te escribió`, html: marco("Tienes un mensaje nuevo", `<p style="color:#40403A;white-space:pre-wrap">${esc(t.slice(0, 600))}</p>` + boton("Responder en mi panel", `${VENDOR_URL}/solicitudes`)) }).catch(() => {})
    }
  }
  return { ok: true, id, oculto: !libres }
}

// ---------------------------------------------------------------------
// Condiciones del acuerdo (12 apartados de la especificación, sección 2.2)
// ---------------------------------------------------------------------

export const APARTADOS: [clave: string, titulo: string][] = [
  ["identificacion", "Identificación de las partes"],
  ["objeto", "Objeto"],
  ["especificaciones", "Especificaciones"],
  ["precio", "Precio"],
  ["pagos", "Pagos"],
  ["entrega", "Entrega"],
  ["calidad", "Calidad y aceptación"],
  ["garantias", "Garantías"],
  ["propiedad", "Propiedad intelectual"],
  ["confidencialidad", "Confidencialidad"],
  ["incumplimiento", "Incumplimiento"],
  ["controversias", "Controversias"],
]

/** Cláusula fija: qué hace y qué no hace HETNA (sección 2.3). No se edita. */
export const CLAUSULA_HETNA =
  "HETNA CNC proporciona la infraestructura tecnológica que conectó a las partes. HETNA no fabrica los productos ni presta los servicios contratados, " +
  "no fija los precios ni negocia en nombre de las partes, y no garantiza la calidad, la entrega, la solvencia ni el cumplimiento de ninguna de ellas. " +
  "La elección del taller fue decisión exclusiva del cliente. Cada parte es responsable de verificar las capacidades, obligaciones y acuerdos de la otra, " +
  "y los conflictos derivados de este contrato se resolverán entre las partes conforme a lo aquí pactado y a la legislación aplicable. " +
  "Esta cláusula no limita las obligaciones legales propias de HETNA, como la protección de datos personales y la seguridad de la información."

const corto = (v: unknown, max = 3000) => String(v ?? "").trim().slice(0, max)

export function condicionesIniciales(s: any, p: any) {
  const c = contactoCliente(s)
  const tr = s.trabajo || {}
  const moneda = p.moneda || "MXN"
  const precio = Number(p.precio).toLocaleString("es-MX", { minimumFractionDigits: 2 })
  const anticipo = Number(p.anticipo_pct || 100)
  return {
    identificacion:
      `CLIENTE: ${[c.nombre, c.empresa].filter(Boolean).join(", ") || "(nombre o razón social)"}.\n` +
      `TALLER: ${p.taller}.\n(Agreguen RFC y domicilio si los necesitan en la factura.)`,
    objeto: corto(tr.descripcion || tr.necesidad || `Fabricación según la solicitud ${folioTexto(s.folio)} de HETNA CNC.`, 1500),
    especificaciones: [
      tr.servicio && `Proceso: ${tr.servicio}`,
      (p.materiales || tr.material) && `Material: ${p.materiales || tr.material}`,
      tr.cantidad && `Cantidad: ${tr.cantidad}`,
      tr.medidas && `Medidas: ${tr.medidas}`,
      tr.tolerancia && `Tolerancia: ${tr.tolerancia}`,
      tr.acabado && `Acabado: ${tr.acabado}`,
      p.operaciones && `Operaciones: ${p.operaciones}`,
      "Conforme a los planos y archivos compartidos en la solicitud.",
    ]
      .filter(Boolean)
      .join("\n"),
    precio: `$${precio} ${moneda}${p.incluye_envio === "si" ? ", envío incluido" : ", sin envío"}. Impuestos: ${moneda === "MXN" ? "indicar si incluye IVA." : "indicar."}`,
    pagos:
      (anticipo < 100 ? `Anticipo de ${anticipo}% al firmar y el resto contra entrega.` : "Pago del 100% antes de iniciar la fabricación.") +
      (p.condiciones_pago ? `\n${p.condiciones_pago}` : "") +
      "\nLos pagos hechos dentro de HETNA quedan registrados en el folio.",
    entrega: `${p.dias} días naturales a partir del pago${p.fecha_entrega ? ` (fecha estimada: ${p.fecha_entrega})` : ""}. Lugar: ${[tr.ciudad, tr.estado_mx || tr.estado].filter(Boolean).join(", ") || "por definir"}.`,
    calidad:
      "Las piezas se aceptan si cumplen las medidas, tolerancias, material y acabado de este acuerdo. El cliente tiene 5 días hábiles desde que recibe para reportar defectos con fotos; el taller los revisa y, si proceden, corrige o repone.",
    garantias: p.garantia || "El taller corrige sin costo los defectos de fabricación reportados en el plazo de aceptación.",
    propiedad:
      "Los planos, diseños y archivos del cliente siguen siendo del cliente. El taller sólo los usa para este trabajo y no puede fabricar, vender ni compartir las piezas o los diseños con terceros.",
    confidencialidad:
      "Ambas partes guardan en secreto la información técnica y comercial que reciban de la otra durante y después de este trabajo, salvo obligación legal.",
    incumplimiento:
      "Si el taller no entrega en el plazo acordado sin causa justificada, el cliente puede cancelar y pedir la devolución de lo pagado por lo no entregado. Si el cliente no paga en los plazos acordados, el taller puede suspender el trabajo.",
    controversias:
      "Las partes intentarán resolver cualquier diferencia de buena fe en 15 días. Si no lo logran, se someten a las leyes de los Estados Unidos Mexicanos y a los tribunales competentes del domicilio del cliente.",
  }
}

function limpiarCondiciones(b: any, previas: any) {
  const out: any = {}
  for (const [k] of APARTADOS) out[k] = corto(b?.[k] ?? previas?.[k] ?? "")
  return out
}

// ---------------------------------------------------------------------
// PDF del contrato y constancia de firmas
// ---------------------------------------------------------------------

const NARANJA = rgb(0.761, 0.337, 0.039)
const TINTA = rgb(0.106, 0.106, 0.094)
const GRIS = rgb(0.42, 0.416, 0.388)

async function escritor(titulo: string, leyenda: boolean) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(textoSeguro(titulo))
  pdf.setAuthor("HETNA CNC")
  pdf.setProducer("HETNA SafeDeal")
  // Fecha fija: la huella del PDF depende sólo de su contenido
  pdf.setCreationDate(new Date(0))
  pdf.setModificationDate(new Date(0))
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595, H = 842, M = 50, ANCHO = W - 2 * M
  let pag: any = null
  let y = 0
  const nueva = () => {
    pag = pdf.addPage([W, H])
    y = H - M
    pag.drawText("HETNA", { x: M, y, size: 14, font: negrita, color: NARANJA })
    pag.drawText(textoSeguro(" SafeDeal"), { x: M + negrita.widthOfTextAtSize("HETNA", 14), y, size: 14, font: normal, color: TINTA })
    y -= 14
    if (leyenda) {
      pag.drawText(textoSeguro(LEYENDA_BORRADOR), { x: M, y, size: 8.5, font: negrita, color: NARANJA })
      y -= 12
    }
    y -= 8
  }
  const partir = (t: string, f: any, tam: number) => {
    const lineas: string[] = []
    for (const par of String(t ?? "").split(/\r?\n/).map(textoSeguro)) {
      let act = ""
      for (const w of par.split(/\s+/).filter(Boolean)) {
        const prueba = act ? `${act} ${w}` : w
        if (f.widthOfTextAtSize(prueba, tam) <= ANCHO || !act) act = prueba
        else {
          lineas.push(act)
          act = w
        }
      }
      lineas.push(act)
    }
    return lineas
  }
  const texto = (t: string, o: { tam?: number; bold?: boolean; color?: any; esp?: number } = {}) => {
    const tam = o.tam || 10
    const f = o.bold ? negrita : normal
    for (const l of partir(t, f, tam)) {
      if (!pag || y < M + 30) nueva()
      pag.drawText(l, { x: M, y, size: tam, font: f, color: o.color || TINTA })
      y -= tam * 1.4
    }
    y -= o.esp ?? 4
  }
  const pie = () => {
    const pags = pdf.getPages()
    pags.forEach((pg: any, i: number) => pg.drawText(`${i + 1} / ${pags.length}`, { x: W - M - 30, y: 25, size: 8, font: normal, color: GRIS }))
  }
  return { pdf, texto, pie, nueva }
}

export async function generarPdfContrato(s: any, p: any, k: any) {
  const folio = folioTexto(s.folio)
  const { pdf, texto, pie, nueva } = await escritor(`Contrato ${folio} v${k.version}`, k.borrador_legal ?? !REVISADO())
  nueva()
  texto("CONTRATO DE FABRICACIÓN / PRESTACIÓN DE SERVICIOS CNC", { tam: 13, bold: true, esp: 2 })
  texto(`Folio ${folio} · Versión ${k.version} · Celebrado mediante HETNA CNC (hetnacnc.com)`, { tam: 9, color: GRIS, esp: 10 })
  texto("Este contrato es entre el cliente y el taller. HETNA no es parte del contrato de fabricación.", { tam: 9, color: GRIS, esp: 10 })
  const c = k.condiciones || {}
  APARTADOS.forEach(([clave, titulo], i) => {
    texto(`${i + 1}. ${titulo.toUpperCase()}`, { tam: 10.5, bold: true, esp: 2 })
    texto(c[clave] || "(sin definir)", { tam: 10, esp: 8 })
  })
  texto(`${APARTADOS.length + 1}. PAPEL DE HETNA`, { tam: 10.5, bold: true, esp: 2 })
  texto(CLAUSULA_HETNA, { tam: 9.5, esp: 10 })
  texto(`${APARTADOS.length + 2}. FIRMA ELECTRÓNICA`, { tam: 10.5, bold: true, esp: 2 })
  texto(
    "Las partes aceptan firmar electrónicamente este documento conforme a los artículos 89 a 97 del Código de Comercio. Cada firma se otorga con la cuenta del firmante, " +
      "un código de verificación enviado a su correo y la aceptación expresa del texto. La huella SHA-256 de este PDF y la constancia de firmas forman el expediente. " +
      "Si se modifica cualquier condición se genera una nueva versión que debe firmarse de nuevo.",
    { tam: 9.5, esp: 10 }
  )
  pie()
  return pdf.save({ useObjectStreams: false })
}

export async function generarPdfConstancia(s: any, k: any, firmas: any[], eventos: any[]) {
  const folio = folioTexto(s.folio)
  const { pdf, texto, pie, nueva } = await escritor(`Constancia de firmas ${folio} v${k.version}`, !!k.borrador_legal)
  nueva()
  texto("CONSTANCIA DE FIRMAS ELECTRÓNICAS", { tam: 13, bold: true, esp: 4 })
  texto(`Folio ${folio} · Contrato versión ${k.version}`, { tam: 10, esp: 2 })
  texto(`Huella SHA-256 del contrato: ${k.sha256}`, { tam: 8.5, esp: 2 })
  texto(`Estado: ${k.estado === "firmado" ? `firmado por ambas partes el ${fecha(k.firmado_en)}` : "pendiente de firma"}`, { tam: 10, esp: 10 })
  for (const f of firmas) {
    texto(f.parte === "cliente" ? "CLIENTE" : "TALLER", { tam: 10.5, bold: true, esp: 2 })
    texto(
      [
        `Nombre: ${f.nombre}`,
        f.representacion && `En representación de: ${f.representacion}`,
        `Correo verificado: ${f.email || ""}`,
        `Método: firma electrónica simple con código de verificación por correo`,
        `Fecha y hora: ${fecha(f.created_at)} (hora del centro de México)`,
        `Dirección IP: ${f.ip || "no disponible"}`,
        `Navegador: ${(f.agente || "").slice(0, 140)}`,
        `Huella firmada: ${f.sha256}`,
      ]
        .filter(Boolean)
        .join("\n"),
      { tam: 9, esp: 8 }
    )
  }
  texto("HISTORIAL", { tam: 10.5, bold: true, esp: 2 })
  for (const e of eventos) texto(`${fecha(e.created_at)} · ${e.actor} · ${e.evento}${e.ip ? ` · IP ${e.ip}` : ""}`, { tam: 8.5, esp: 1 })
  texto(
    "HETNA conserva el contrato, esta constancia y el historial sin modificarlos. Para comprobar la integridad, calcule el SHA-256 del PDF del contrato y compárelo con la huella de arriba.",
    { tam: 8.5, color: GRIS, esp: 4 }
  )
  pie()
  return pdf.save()
}

// ---------------------------------------------------------------------
// Estado y acciones
// ---------------------------------------------------------------------

async function vigente(knex: any, s: any) {
  return knex(T_CONTRATO).where({ solicitud_id: s.id }).whereNot({ estado: "reemplazado" }).orderBy("version", "desc").first()
}

/** Lo que ve cada parte del acuerdo (y la alerta de que es opcional pero recomendado). */
export async function estadoAcuerdo(knex: any, s: any, parte: Parte) {
  await asegurarSafeDeal(knex)
  const p = await elegidaDe(knex, s)
  if (!p) return { disponible: false }
  const k = await vigente(knex, s)
  const firmas = k ? await knex(T_FIRMA).where({ contrato_id: k.id }) : []
  const firmados = await knex(T_CONTRATO).where({ solicitud_id: s.id, estado: "firmado" }).orderBy("version", "desc").select("id", "version", "firmado_en", "sha256")
  const libres = contactosLiberados(s)
  return {
    disponible: true,
    revisado_legal: REVISADO(),
    leyenda: REVISADO() ? null : LEYENDA_BORRADOR,
    apartados: APARTADOS.map(([clave, titulo]) => ({ clave, titulo })),
    clausula_hetna: CLAUSULA_HETNA,
    contrato: k
      ? {
          id: k.id,
          version: k.version,
          estado: k.estado,
          condiciones: k.condiciones,
          huella: huellaCondiciones(k.condiciones),
          aprobo_cliente: k.aprobo_cliente,
          aprobo_taller: k.aprobo_taller,
          editado_por: k.editado_por,
          sha256: k.sha256,
          firmado_en: k.firmado_en,
          firmas: firmas.map((f: any) => ({ parte: f.parte, nombre: f.nombre, representacion: f.representacion, fecha: f.created_at })),
          yo_aprobe: !!k[`aprobo_${parte}`],
          yo_firme: firmas.some((f: any) => f.parte === parte),
        }
      : null,
    // Si no hay contrato todavía, la sugerencia con los datos de la propuesta
    sugerencia: k ? null : condicionesIniciales(s, p),
    firmados,
    contactos_liberados: libres,
    contacto_otro: libres ? (parte === "cliente" ? contactoTaller(p) : contactoCliente(s)) : null,
    taller: p.taller,
  }
}

type Ctx = { ip?: string | null; agente?: string | null; logger?: any }

export async function accionAcuerdo(knex: any, s: any, parte: Parte, b: any, ctx: Ctx = {}) {
  await asegurarSafeDeal(knex)
  const p = await elegidaDe(knex, s)
  if (!p) return { ok: false, status: 409, message: "El acuerdo se prepara después de elegir una propuesta." }
  const accion = String(b?.accion || "")
  const ip = ctx.ip || null
  let k = await vigente(knex, s)
  const folio = folioTexto(s.folio)
  const avisarOtro = async (titulo: string, cuerpo: string) => {
    if (parte === "taller") {
      await pushACliente(knex, { customerId: s.cliente_id, email: s.contacto?.email }, { titulo, cuerpo, url: ligaPropuestas(s.token), etiqueta: `acuerdo-${s.id}` }, ctx.logger).catch(() => {})
      if (s.contacto?.email) await sendEmail({ to: s.contacto.email, subject: `[${folio}] ${titulo}`, html: marco(titulo, `<p style="color:#40403A">${esc(cuerpo)}</p>` + boton("Ver el acuerdo", ligaPropuestas(s.token))) }).catch(() => {})
    } else {
      await pushATalleres(knex, [p.seller_id], { titulo, cuerpo, url: `${VENDOR_URL}/solicitudes`, etiqueta: `acuerdo-${s.id}` }, ctx.logger).catch(() => {})
      if (p.taller_email) await sendEmail({ to: p.taller_email, subject: `[${folio}] ${titulo}`, html: marco(titulo, `<p style="color:#40403A">${esc(cuerpo)}</p>` + boton("Ver en mi panel", `${VENDOR_URL}/solicitudes`)) }).catch(() => {})
    }
  }

  // Guardar condiciones (crea el borrador o una versión nueva)
  if (accion === "guardar") {
    if (k && k.estado === "borrador") {
      const condiciones = limpiarCondiciones(b.condiciones, k.condiciones)
      await knex(T_CONTRATO).where({ id: k.id }).update({ condiciones: JSON.stringify(condiciones), aprobo_cliente: null, aprobo_taller: null, editado_por: parte, updated_at: knex.fn.now() })
      await evento(knex, s, k.id, "condiciones editadas", parte, null, ip)
    } else {
      // Nueva versión: la firmada (si la hay) se conserva intacta
      if (k && k.estado === "listo") {
        await knex(T_CONTRATO).where({ id: k.id }).update({ estado: "reemplazado", updated_at: knex.fn.now() })
        await knex(T_OTP).where({ contrato_id: k.id }).del()
      }
      const ultima = await knex(T_CONTRATO).where({ solicitud_id: s.id }).max("version as v").first()
      const base = k?.condiciones || condicionesIniciales(s, p)
      const id = nuevoId("ctr")
      await knex(T_CONTRATO).insert({
        id, solicitud_id: s.id, seller_id: p.seller_id, version: Number(ultima?.v || 0) + 1, estado: "borrador",
        condiciones: JSON.stringify(limpiarCondiciones(b.condiciones, base)), editado_por: parte,
      })
      await evento(knex, s, id, k ? `versión nueva (antes v${k.version})` : "acuerdo iniciado", parte, null, ip)
      if (!k) await avisarOtro("Propusieron formalizar su acuerdo con SafeDeal", "Revisa las condiciones del acuerdo, ajústalas si hace falta y apruébalas.")
    }
    return { ok: true }
  }

  if (!k) return { ok: false, status: 409, message: "Primero preparen las condiciones del acuerdo." }

  // Aprobar las condiciones tal como están
  if (accion === "aprobar") {
    if (k.estado !== "borrador") return { ok: false, status: 409, message: "Esta versión ya no se puede aprobar." }
    if (b.huella !== huellaCondiciones(k.condiciones)) return { ok: false, status: 409, message: "Las condiciones cambiaron mientras las leías. Revísalas de nuevo." }
    const n = await knex(T_CONTRATO).where({ id: k.id, estado: "borrador" }).update({ [`aprobo_${parte}`]: knex.fn.now() })
    if (!n) return { ok: false, status: 409, message: "Las condiciones cambiaron mientras las leías. Revísalas de nuevo." }
    await evento(knex, s, k.id, "condiciones aprobadas", parte, null, ip)
    k = await knex(T_CONTRATO).where({ id: k.id }).first()
    if (k.aprobo_cliente && k.aprobo_taller) {
      // Ambos aprobaron: se genera el PDF y la versión queda bloqueada
      k.borrador_legal = !REVISADO()
      const bytes = await generarPdfContrato(s, p, k)
      const huella = sha(bytes)
      const clave = `contratos/${s.id}/${k.id}-v${k.version}.pdf`
      const sub = await uploadFile(Buffer.from(bytes), clave, "application/pdf")
      if (!sub.ok) ctx.logger?.warn?.(`[safedeal] no se pudo guardar el PDF ${clave}: ${sub.reason}`)
      await knex(T_CONTRATO).where({ id: k.id }).update({ estado: "listo", sha256: huella, pdf_clave: sub.ok ? clave : null, borrador_legal: !REVISADO(), updated_at: knex.fn.now() })
      await evento(knex, s, k.id, "contrato generado y bloqueado", "hetna", { sha256: huella }, null)
      await avisarOtro("El acuerdo está listo para firmar", "Ambos aprobaron las condiciones. Revisa el PDF y fírmalo con el código que te llegará a tu correo.")
      return { ok: true, listo: true }
    }
    await avisarOtro("Aprobaron las condiciones del acuerdo", "Falta tu aprobación para generar el contrato.")
    return { ok: true }
  }

  // Pedir el código de verificación
  if (accion === "codigo") {
    if (k.estado !== "listo") return { ok: false, status: 409, message: "El contrato todavía no está listo para firmar." }
    if (await knex(T_FIRMA).where({ contrato_id: k.id, parte }).first("id")) return { ok: false, status: 409, message: "Ya firmaste esta versión." }
    const correo = parte === "cliente" ? s.contacto?.email : p.taller_email
    if (!correo) return { ok: false, status: 400, message: "No tenemos un correo para enviarte el código." }
    const previo = await knex(T_OTP).where({ contrato_id: k.id, parte }).first()
    if (previo && new Date(previo.expira).getTime() - Date.now() > 9 * 60_000) return { ok: false, status: 429, message: "Ya te enviamos un código hace un momento. Revisa tu correo (y la carpeta de spam)." }
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0")
    await knex(T_OTP).where({ contrato_id: k.id, parte }).del()
    await knex(T_OTP).insert({ contrato_id: k.id, parte, codigo_hash: sha(`${k.id}:${parte}:${codigo}`), expira: new Date(Date.now() + 10 * 60_000), intentos: 0 })
    const r = await sendEmail({
      to: correo,
      subject: `[${folio}] Tu código para firmar: ${codigo}`,
      html: marco("Código para firmar tu contrato", `<p style="color:#40403A">Tu código es:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#142033">${codigo}</p><p style="color:#6B675C;font-size:13px">Vale 10 minutos. Si tú no lo pediste, ignora este correo: nadie puede firmar sin él.</p>`),
    })
    await evento(knex, s, k.id, "código de firma enviado por correo", parte, null, ip)
    if (!r.sent) return { ok: false, status: 502, message: "No pudimos enviar el código. Intenta de nuevo en un momento." }
    const [u, dom] = String(correo).split("@")
    return { ok: true, correo: `${u.slice(0, 2)}***@${dom}` }
  }

  // Firmar
  if (accion === "firmar") {
    if (k.estado !== "listo") return { ok: false, status: 409, message: "Esta versión no está lista para firmar." }
    if (!(b.acepto === true || b.acepto === "true")) return { ok: false, status: 400, message: "Marca que leíste y aceptas el contrato." }
    const nombre = corto(b.nombre, 120)
    if (nombre.length < 5) return { ok: false, status: 400, message: "Escribe tu nombre completo." }
    if (b.sha256 && b.sha256 !== k.sha256) return { ok: false, status: 409, message: "El contrato cambió. Recarga la página y revísalo de nuevo." }
    const otp = await knex(T_OTP).where({ contrato_id: k.id, parte }).first()
    if (!otp || new Date(otp.expira).getTime() < Date.now()) return { ok: false, status: 400, message: "El código venció. Pide uno nuevo." }
    if (otp.intentos >= 5) return { ok: false, status: 429, message: "Demasiados intentos. Pide un código nuevo." }
    if (sha(`${k.id}:${parte}:${String(b.codigo || "").trim()}`) !== otp.codigo_hash) {
      await knex(T_OTP).where({ contrato_id: k.id, parte }).increment("intentos", 1)
      return { ok: false, status: 400, message: "El código no coincide." }
    }
    const correo = parte === "cliente" ? s.contacto?.email : p.taller_email
    try {
      await knex(T_FIRMA).insert({
        id: nuevoId("fir"), contrato_id: k.id, parte, nombre, representacion: corto(b.representacion, 160) || null, email: correo,
        metodo: "simple+otp_correo", ip, agente: corto(ctx.agente, 400), sha256: k.sha256,
      })
    } catch {
      return { ok: false, status: 409, message: "Ya firmaste esta versión." }
    }
    await knex(T_OTP).where({ contrato_id: k.id, parte }).del()
    await evento(knex, s, k.id, "firmó", parte, { nombre }, ip)
    const firmas = await knex(T_FIRMA).where({ contrato_id: k.id })
    if (firmas.length >= 2) {
      await knex(T_CONTRATO).where({ id: k.id }).update({ estado: "firmado", firmado_en: knex.fn.now(), updated_at: knex.fn.now() })
      await knex(T_SOLICITUD).where({ id: s.id }).update({ contactos_liberados: true })
      await evento(knex, s, k.id, "expediente cerrado; contactos compartidos", "hetna", { sha256: k.sha256 }, null)
      const ct = contactoTaller(p)
      const cc = contactoCliente(s)
      const lista = (o: any) => [o.nombre, o.empresa, o.email, o.telefono && `Tel. ${o.telefono}`, o.whatsapp && `WhatsApp ${o.whatsapp}`].filter(Boolean).map(esc).join("<br>")
      if (s.contacto?.email)
        await sendEmail({ to: s.contacto.email, subject: `[${folio}] Contrato firmado por ambas partes`, html: marco("¡Contrato firmado!", `<p style="color:#40403A">Ya pueden contactarse directamente. Datos del taller:</p><p style="color:#40403A">${lista(ct)}</p><p style="color:#6B675C;font-size:13px">Huella SHA-256: ${esc(k.sha256)}</p>` + boton("Descargar contrato y constancia", ligaPropuestas(s.token))) }).catch(() => {})
      if (p.taller_email)
        await sendEmail({ to: p.taller_email, subject: `[${folio}] Contrato firmado por ambas partes`, html: marco("¡Contrato firmado!", `<p style="color:#40403A">Ya pueden contactarse directamente. Datos del cliente:</p><p style="color:#40403A">${lista(cc)}</p><p style="color:#6B675C;font-size:13px">Huella SHA-256: ${esc(k.sha256)}</p>` + boton("Ver en mi panel", `${VENDOR_URL}/solicitudes`)) }).catch(() => {})
      return { ok: true, firmado: true }
    }
    await avisarOtro("Tu contraparte ya firmó", "Falta tu firma para cerrar el expediente y compartir contactos.")
    return { ok: true }
  }

  return { ok: false, status: 400, message: "Acción no válida." }
}

/** PDF del contrato (el guardado, byte por byte) o la constancia de firmas. */
export async function documentoAcuerdo(knex: any, s: any, tipo: string, version?: number) {
  await asegurarSafeDeal(knex)
  const q = knex(T_CONTRATO).where({ solicitud_id: s.id }).whereIn("estado", ["listo", "firmado"])
  const k = version ? await q.andWhere({ version }).first() : await q.orderBy("version", "desc").first()
  if (!k) return null
  if (tipo === "constancia") {
    const firmas = await knex(T_FIRMA).where({ contrato_id: k.id }).orderBy("created_at")
    const eventos = await knex(T_EVENTO_C).where({ contrato_id: k.id }).orderBy("created_at")
    const bytes = await generarPdfConstancia(s, k, firmas, eventos)
    return { bytes, nombre: `constancia-${folioTexto(s.folio)}-v${k.version}.pdf` }
  }
  // El contrato: el PDF guardado en B2 (con la huella original)
  if (k.pdf_clave) {
    const url = (await getSignedDownloadUrls([k.pdf_clave], 600).catch(() => new Map())).get(k.pdf_clave)
    if (url) {
      const r = await fetch(url).catch(() => null)
      if (r?.ok) {
        const bytes = new Uint8Array(await r.arrayBuffer())
        if (sha(bytes) === k.sha256) return { bytes, nombre: `contrato-${folioTexto(s.folio)}-v${k.version}.pdf` }
      }
    }
  }
  // Respaldo: regenerarlo (mismo contenido y fechas fijas -> misma huella)
  const p = await elegidaDe(knex, s)
  const bytes = await generarPdfContrato(s, p, k)
  return { bytes, nombre: `contrato-${folioTexto(s.folio)}-v${k.version}.pdf`, regenerado: sha(bytes) !== k.sha256 }
}
