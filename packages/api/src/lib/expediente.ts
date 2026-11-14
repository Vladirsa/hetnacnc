// Expediente digital de fabricación (diferenciación, paso 2): todo lo que pasó
// en un proyecto, en un solo lugar y en orden. Junta lo que vive repartido en
// varias tablas: la solicitud y sus archivos, la propuesta elegida, el taller
// responsable, la línea de tiempo (etapas, avances, pagos, mensajes,
// preguntas, descargas de planos, contrato SafeDeal y sus firmas, disputa,
// entrega y reseña).
//
// Lo ven dos partes y cada una sólo lo que le toca:
//   - el cliente, con el token de su solicitud;
//   - el taller ELEGIDO, con una liga firmada de 1 hora que pide desde su panel.
// Nunca salen IPs, correos ni teléfonos (los textos pasan por ocultarContacto).
//
// La "huella" (SHA-256 del contenido) identifica esta versión del expediente:
// si dos copias impresas tienen la misma huella, dicen lo mismo.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { T_ACCESO_ARCHIVO } from "./archivo-acceso"
import { T_SUBIDA } from "./archivo-seguro"
import { T_PROPUESTA, T_SOLICITUD, folioTexto, ocultarContacto } from "./licitacion"
import { T_PAGO } from "./licitacion-cobro"
import { T_PREGUNTA, T_RESENA } from "./licitacion-extra"
import { clienteVisible } from "./licitacion-privacidad"
import { T_EVENTO_C, T_FIRMA, T_MENSAJE, T_CONTRATO } from "./safedeal"
import { NOMBRE_ETAPA, T_EVENTO, etapaDe, type Etapa } from "./seguimiento"

export type Visor = { tipo: "cliente" } | { tipo: "taller"; sellerId: string }
export type Suceso = { fecha: string; tipo: string; quien: string; texto: string }

const iso = (d: any) => (d ? new Date(d).toISOString() : "")
const corto = (t: unknown, n = 400) => ocultarContacto(String(t ?? "")).slice(0, n)
const QUIEN: Record<string, string> = { cliente: "Cliente", taller: "Taller", hetna: "HETNA", sistema: "HETNA" }
const PAGO: Record<string, string> = { anticipo: "Anticipo", resto: "Pago del resto", total: "Pago total" }
const nada = () => [] as any[]

export async function armarExpediente(knex: any, s: any, visor: Visor) {
  const t = s.trabajo || {}
  const elegida = s.propuesta_elegida
    ? await knex(`${T_PROPUESTA} as p`)
        .join("seller as v", "v.id", "p.seller_id")
        .where("p.id", s.propuesta_elegida)
        .first("p.*", "v.name as taller", "v.handle as taller_handle")
        .catch(() => null)
    : null
  const taller = elegida?.taller || "Taller"
  const nombreCliente = visor.tipo === "cliente" ? s.contacto?.nombre || "Tú" : clienteVisible(s)

  const [eventos, pagos, mensajes, preguntas, descargas, contratos, firmas, eventosC, resenas, subidas] = await Promise.all([
    knex(T_EVENTO).where({ solicitud_id: s.id, visible_cliente: true }).orderBy("created_at").select("*").catch(nada),
    knex(T_PAGO).where({ solicitud_id: s.id }).whereIn("estado", ["approved", "refunded", "charged_back"]).select("*").catch(nada),
    knex(T_MENSAJE).where({ solicitud_id: s.id }).orderBy("created_at").select("autor", "texto", "created_at").catch(nada),
    elegida ? knex(T_PREGUNTA).where({ solicitud_id: s.id, seller_id: elegida.seller_id }).select("*").catch(nada) : [],
    knex(T_ACCESO_ARCHIVO).where({ solicitud_id: s.id }).whereNot({ accion: "negada" }).select("nombre", "actor", "actor_nombre", "accion", "created_at").catch(nada),
    knex(T_CONTRATO).where({ solicitud_id: s.id }).select("id", "version", "estado", "firmado_en").catch(nada),
    knex(`${T_FIRMA} as f`).join(`${T_CONTRATO} as c`, "c.id", "f.contrato_id").where("c.solicitud_id", s.id).select("f.parte", "f.nombre", "f.metodo", "f.created_at").catch(nada),
    knex(T_EVENTO_C).where({ solicitud_id: s.id }).select("evento", "actor", "created_at").catch(nada),
    knex(T_RESENA).where({ solicitud_id: s.id }).select("promedio", "created_at").catch(nada),
    knex(T_SUBIDA).whereIn("clave", ((t.archivos || []) as any[]).map((a) => a.clave)).select("clave", "sha256", "created_at").catch(nada),
  ])

  // Línea de tiempo
  const linea: Suceso[] = [{ fecha: iso(s.created_at), tipo: "solicitud", quien: nombreCliente, texto: `Solicitud ${folioTexto(s.folio)} creada.` }]
  for (const e of eventos as any[]) {
    const etapa = e.etapa ? NOMBRE_ETAPA[e.etapa as Etapa] : ""
    const quien = e.actor === "taller" ? taller : e.actor === "cliente" ? nombreCliente : QUIEN[e.actor] || "HETNA"
    linea.push({ fecha: iso(e.created_at), tipo: e.etapa ? "etapa" : "nota", quien, texto: [etapa && `Etapa: ${etapa}.`, corto(e.nota)].filter(Boolean).join(" ") })
  }
  for (const p of pagos as any[]) {
    const que = PAGO[p.tipo] || "Pago"
    const estado = p.estado === "approved" ? "confirmado" : p.estado === "refunded" ? "reembolsado" : "en contracargo"
    linea.push({
      fecha: iso(p.created_at),
      tipo: "pago",
      quien: nombreCliente,
      texto: `${que} ${estado}: $${Number(p.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })} por ${p.proveedor === "paypal" ? "PayPal" : "Mercado Pago"} (${p.cobra === "taller" ? "directo al taller" : "a HETNA"}).`,
    })
  }
  for (const m of mensajes as any[]) {
    linea.push({ fecha: iso(m.created_at), tipo: "mensaje", quien: m.autor === "taller" ? taller : m.autor === "cliente" ? nombreCliente : "HETNA", texto: corto(m.texto, 280) })
  }
  for (const q of preguntas as any[]) {
    linea.push({ fecha: iso(q.created_at || s.created_at), tipo: "pregunta", quien: taller, texto: `Preguntó: ${corto(q.pregunta, 280)}` })
    if (q.respuesta) linea.push({ fecha: iso(q.respondida_en || q.created_at), tipo: "pregunta", quien: nombreCliente, texto: `Respondió: ${corto(q.respuesta, 280)}` })
  }
  for (const d of descargas as any[]) {
    linea.push({ fecha: iso(d.created_at), tipo: "descarga", quien: d.actor === "hetna" ? "HETNA" : d.actor_nombre || "Taller", texto: `${d.accion === "vista" ? "Vio" : "Descargó"} ${d.nombre}.` })
  }
  for (const e of eventosC as any[]) {
    linea.push({ fecha: iso(e.created_at), tipo: "contrato", quien: QUIEN[e.actor] || e.actor || "HETNA", texto: `Acuerdo SafeDeal: ${String(e.evento).replace(/_/g, " ")}.` })
  }
  for (const f of firmas as any[]) {
    linea.push({ fecha: iso(f.created_at), tipo: "firma", quien: f.parte === "taller" ? taller : nombreCliente, texto: `Firmó el acuerdo SafeDeal${f.nombre ? ` (${corto(f.nombre, 80)})` : ""}.` })
  }
  for (const r of resenas as any[]) {
    linea.push({ fecha: iso(r.created_at), tipo: "resena", quien: nombreCliente, texto: `Calificó al taller con ${Number(r.promedio).toFixed(1)} de 5.` })
  }
  if (s.disputa) linea.push({ fecha: iso(s.disputa_desde), tipo: "disputa", quien: nombreCliente, texto: "Reportó un problema; HETNA lo está revisando." })
  linea.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const subidaDe = new Map((subidas as any[]).map((x) => [x.clave, x]))
  const archivos = [
    ...((t.archivos || []) as any[]).map((a) => ({
      nombre: a.nombre,
      tamano: Number(a.tamano) || 0,
      de: "Cliente",
      fecha: iso(subidaDe.get(a.clave)?.created_at || s.created_at),
      huella: subidaDe.get(a.clave)?.sha256 ? String(subidaDe.get(a.clave).sha256).slice(0, 16) : null,
      borrado: false,
    })),
    ...((t.archivos_borrados || []) as any[]).map((a) => ({ nombre: a.nombre, tamano: Number(a.tamano) || 0, de: "Cliente", fecha: iso(s.created_at), huella: null, borrado: true })),
    ...(((elegida?.adjuntos || []) as any[]).map((a) => ({ nombre: a.nombre, tamano: Number(a.tamano) || 0, de: taller, fecha: iso(elegida.created_at), huella: null, borrado: false }))),
  ]

  const etapa = etapaDe(s)
  const cuerpo = {
    folio: folioTexto(s.folio),
    etapa,
    etapa_nombre: NOMBRE_ETAPA[etapa],
    creada: iso(s.created_at),
    trabajo: {
      descripcion: corto(t.descripcion, 3000),
      servicio: t.servicio || null,
      material: t.material || null,
      cantidad: t.cantidad || null,
      medidas: t.medidas || t.medidas_archivo || null,
      tolerancia: t.tolerancia || null,
      acabado: t.acabado || null,
      para: t.fecha || null,
    },
    responsables: {
      cliente: nombreCliente,
      taller: elegida ? { nombre: taller, handle: elegida.taller_handle } : null,
      plataforma: "HETNA CNC",
    },
    propuesta: elegida
      ? {
          precio: Number(elegida.precio),
          moneda: elegida.moneda || "MXN",
          dias: elegida.dias,
          fecha_entrega: elegida.fecha_entrega || null,
          anticipo_pct: elegida.anticipo_pct ?? null,
          incluye_envio: elegida.incluye_envio === "si",
          garantia: elegida.garantia ? corto(elegida.garantia) : null,
          condiciones: elegida.condiciones ? corto(elegida.condiciones, 1000) : null,
        }
      : null,
    contrato: (contratos as any[])[0] ? { version: (contratos as any[])[0].version, estado: (contratos as any[])[0].estado, firmado_en: iso((contratos as any[])[0].firmado_en) || null } : null,
    entrega: { paqueteria: s.paqueteria || null, guia: s.guia || null },
    archivos,
    linea,
  }
  const huella = createHash("sha256").update(JSON.stringify(cuerpo)).digest("hex")
  return { ...cuerpo, visor: visor.tipo, huella, generado: new Date().toISOString() }
}

// ---------- Liga firmada para el taller elegido ----------

const secreto = () => {
  const s = process.env.ARCHIVOS_SECRETO || process.env.JWT_SECRET || ""
  if (!s || s === "supersecret") throw new Error("Falta ARCHIVOS_SECRETO o JWT_SECRET")
  return s
}
const firma = (c: string) => createHmac("sha256", secreto()).update(`expediente:${c}`).digest("base64url")

export function tokenExpedienteTaller(solicitudId: string, sellerId: string, minutos = 60): string {
  const c = Buffer.from(JSON.stringify({ s: solicitudId, i: sellerId, e: Date.now() + minutos * 60_000, r: randomBytes(3).toString("hex") })).toString("base64url")
  return `t.${c}.${firma(c)}`
}

export function leerTokenExpedienteTaller(token: string): { s: string; i: string } | null {
  const [pre, c, f] = String(token || "").split(".")
  if (pre !== "t" || !c || !f) return null
  let esperada: Buffer
  try {
    esperada = Buffer.from(firma(c))
  } catch {
    return null
  }
  const recibida = Buffer.from(f)
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null
  try {
    const p = JSON.parse(Buffer.from(c, "base64url").toString("utf8"))
    return p?.s && p?.i && Number(p.e) > Date.now() ? { s: p.s, i: p.i } : null
  } catch {
    return null
  }
}

/** Solicitud y visor a partir de la clave de la liga (token del cliente o liga firmada del taller). */
export async function solicitudDeClave(knex: any, clave: string): Promise<{ s: any; visor: Visor } | null> {
  const deTaller = leerTokenExpedienteTaller(clave)
  if (deTaller) {
    const s = await knex(T_SOLICITUD).where({ id: deTaller.s }).first()
    if (!s?.propuesta_elegida) return null
    // Sigue siendo el taller elegido (la liga no sobrevive a un cambio)
    const p = await knex(T_PROPUESTA).where({ id: s.propuesta_elegida }).first("seller_id")
    return p?.seller_id === deTaller.i ? { s, visor: { tipo: "taller", sellerId: deTaller.i } } : null
  }
  if (String(clave).length < 32) return null
  const s = await knex(T_SOLICITUD).where({ token: clave }).first()
  return s ? { s, visor: { tipo: "cliente" } } : null
}
