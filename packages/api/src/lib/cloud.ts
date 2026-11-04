// @ts-nocheck
// HetNa Cloud: la nube del taller, organizada como se trabaja.
//
//   CLIENTE → PROYECTO → PIEZA → ARCHIVOS (cada uno con revisión y estado)
//
// Los archivos viven en el bucket PRIVADO de B2 (nunca en una URL pública):
// se descargan con ligas firmadas de 1 hora. Cada archivo tiene un estado
// (borrador → probado → liberado) y una revisión: subir otro archivo con el
// mismo nombre a la misma pieza crea la revisión siguiente, no lo pisa.
//
// Cupo por plan del taller (el mismo plan de la app y la comisión):
// Gratis 1 GB · Taller 10 GB · Pro 50 GB · Industrial 200 GB.
//
// Entradas automáticas: las licitaciones que el taller gana se importan como
// proyecto con los archivos del cliente (referencia a la misma clave de B2,
// no ocupan cupo).
import { randomBytes } from "crypto"

import { planComision } from "./licitacion-cobro"
import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, folioTexto, ocultarContacto } from "./licitacion"

export const T_CLIENTE = "hetna_cloud_cliente"
export const T_PROYECTO = "hetna_cloud_proyecto"
export const T_PIEZA = "hetna_cloud_pieza"
export const T_ARCHIVO = "hetna_cloud_archivo"
export const T_LIGA = "hetna_cloud_liga"

export const GB = 1024 ** 3
export const CUPO_GB: Record<string, number> = { gratis: 1, taller: 10, pro: 50, industrial: 200 }
export const MAX_MB_ARCHIVO = 50

export const CATEGORIAS = {
  plano: "Plano / dibujo",
  modelo: "Modelo 3D",
  vector: "Vector",
  cam: "Proyecto CAM",
  gcode: "G-code",
  foto: "Foto",
  documento: "Documento",
  otro: "Otro",
} as const
export const ESTADOS = { borrador: "Borrador", probado: "Probado en máquina", liberado: "Liberado" } as const
export const ESTADOS_PROYECTO = { activo: "Activo", produccion: "En producción", entregado: "Entregado", archivado: "Archivado" } as const

// Extensiones aceptadas: diseño, CAM, G-code, documentos y fotos. Nada
// ejecutable.
export const EXT_CLOUD = [
  "dxf", "dwg", "svg", "ai", "eps", "pdf", "cdr", "crv", "crv3d", "art", "3dm",
  "stl", "step", "stp", "iges", "igs", "3mf", "obj", "f3d", "f3z", "skp", "sldprt", "sldasm", "x_t",
  "nc", "gcode", "ngc", "tap", "cnc", "txt", "mpf", "eia", "ncc", "gc", "plt", "hpgl",
  "png", "jpg", "jpeg", "webp", "heic",
  "doc", "docx", "xls", "xlsx", "csv", "odt", "ods",
  "zip", "rar", "7z",
]

/** Categoría que se le pone a un archivo según su extensión. */
export function categoriaDe(ext: string): keyof typeof CATEGORIAS {
  if (["nc", "gcode", "ngc", "tap", "cnc", "mpf", "eia", "ncc", "gc"].includes(ext)) return "gcode"
  if (["stl", "step", "stp", "iges", "igs", "3mf", "obj", "f3d", "f3z", "skp", "sldprt", "sldasm", "x_t", "3dm"].includes(ext)) return "modelo"
  if (["svg", "ai", "eps", "cdr", "plt", "hpgl"].includes(ext)) return "vector"
  if (["dxf", "dwg"].includes(ext)) return "plano"
  if (["crv", "crv3d", "art"].includes(ext)) return "cam"
  if (["png", "jpg", "jpeg", "webp", "heic"].includes(ext)) return "foto"
  if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "odt", "ods", "txt"].includes(ext)) return "documento"
  return "otro"
}

export const nuevoId = (pre: string) => `${pre}_${randomBytes(10).toString("hex")}`

export const nombreSeguro = (nombre: string) =>
  String(nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-100) || "archivo"

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
export { texto as textoCloud }

let listo = false
export async function asegurarCloud(knex: any) {
  if (listo) return
  const crear = async (tabla: string, fn: (t: any) => void) => {
    if (await knex.schema.hasTable(tabla)) return
    try {
      await knex.schema.createTable(tabla, fn)
    } catch (e) {
      // Dos peticiones a la vez: la otra ya la creó
      if (!/already exists|duplicate key|pg_type/i.test(String((e as Error).message))) throw e
    }
  }
  await crear(T_CLIENTE, (t) => {
    t.text("id").primary()
    t.text("seller_id").notNullable().index()
    t.text("nombre").notNullable()
    t.text("empresa").nullable()
    t.text("correo").nullable()
    t.text("telefono").nullable()
    t.text("notas").nullable()
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await crear(T_PROYECTO, (t) => {
    t.text("id").primary()
    t.text("seller_id").notNullable().index()
    t.text("cliente_id").nullable().index()
    t.text("nombre").notNullable()
    t.text("estado").notNullable().defaultTo("activo")
    t.text("notas").nullable()
    t.text("origen_tipo").nullable() // licitacion | manual
    t.text("origen_ref").nullable()
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(["seller_id", "origen_tipo", "origen_ref"])
  })
  await crear(T_PIEZA, (t) => {
    t.text("id").primary()
    t.text("seller_id").notNullable()
    t.text("proyecto_id").notNullable().index()
    t.text("nombre").notNullable()
    t.text("material").nullable()
    t.integer("cantidad").nullable()
    t.text("notas").nullable()
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await crear(T_ARCHIVO, (t) => {
    t.text("id").primary()
    t.text("seller_id").notNullable().index()
    t.text("proyecto_id").notNullable().index()
    t.text("pieza_id").nullable()
    t.text("nombre").notNullable()
    t.text("ext").notNullable()
    t.text("clave").notNullable()
    t.bigInteger("tamano").notNullable().defaultTo(0)
    // Los archivos importados (de una licitación) son del cliente: no cuentan en el cupo
    t.boolean("cuenta_cupo").notNullable().defaultTo(true)
    t.text("categoria").notNullable().defaultTo("otro")
    t.integer("revision").notNullable().defaultTo(1)
    t.text("estado").notNullable().defaultTo("borrador")
    t.text("notas").nullable()
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp("deleted_at", { useTz: true }).nullable()
    // false mientras el archivo sube a B2: ya ocupa cupo, pero no se enseña
    t.boolean("subido").notNullable().defaultTo(true)
  })
  await crear(T_LIGA, (t) => {
    t.text("token").primary()
    t.text("seller_id").notNullable().index()
    t.text("proyecto_id").notNullable()
    t.boolean("solo_liberados").notNullable().defaultTo(true)
    t.timestamp("vence", { useTz: true }).notNullable()
    t.integer("vistas").notNullable().defaultTo(0)
    t.timestamp("revocada_en", { useTz: true }).nullable()
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  // Tablas creadas antes de la columna "subido"
  await knex.raw(`alter table ?? add column if not exists subido boolean not null default true`, [T_ARCHIVO])
  listo = true
}

/** Sólo los archivos que ya terminaron de subir y no se borraron. */
export const vigentes = (q: any) => q.whereNull("deleted_at").where("subido", true)

/** Mismo criterio de "nombre" que las revisiones: sin distinguir mayúsculas. */
export const ORDEN_REVISIONES = "lower(nombre) asc, revision desc"

/** Liga pública de una liga compartida. */
export const urlLiga = (token: string) =>
  `${(process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")}/mx/nube/${token}`

export const esClave = <T extends object>(obj: T, k: unknown): k is keyof T => typeof k === "string" && Object.hasOwn(obj, k)

/** Uso y cupo del taller, en bytes. */
export async function usoCloud(knex: any, sellerId: string, logger?: any) {
  const [seller, uso] = await Promise.all([
    knex("seller").where({ id: sellerId }).first("email", "metadata"),
    knex(T_ARCHIVO).where({ seller_id: sellerId, cuenta_cupo: true }).whereNull("deleted_at").sum({ n: "tamano" }).first(),
  ])
  const plan = await planComision(seller || {}, logger).catch(() => "gratis")
  const cupo = (CUPO_GB[plan] ?? CUPO_GB.gratis) * GB
  return { plan, usado: Number(uso?.n) || 0, cupo }
}

/** Siguiente revisión para un archivo con ese nombre en esa pieza (o proyecto). */
export async function siguienteRevision(knex: any, proyectoId: string, piezaId: string | null, nombre: string) {
  const q = knex(T_ARCHIVO).where({ proyecto_id: proyectoId }).whereRaw("lower(nombre) = ?", [nombre.toLowerCase()])
  if (piezaId) q.where({ pieza_id: piezaId })
  else q.whereNull("pieza_id")
  const r = await q.max({ n: "revision" }).first()
  return (Number(r?.n) || 0) + 1
}

/** Proyecto del taller o null (nunca uno ajeno). */
export const proyectoDe = (knex: any, sellerId: string, id: string) =>
  knex(T_PROYECTO).where({ id: String(id || ""), seller_id: sellerId }).first()

/**
 * Importa las licitaciones que ganó el taller (propuesta elegida) como
 * proyectos, con los archivos que subió el cliente. Es idempotente: cada
 * solicitud se importa una sola vez (índice único seller+origen).
 * Nunca se copian los datos de contacto del cliente.
 */
export async function importarLicitaciones(knex: any, sellerId: string): Promise<number> {
  await asegurarTablas(knex)
  const ganadas = (await knex(`${T_SOLICITUD} as s`)
    .join(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
    .where("p.seller_id", sellerId)
    .whereIn("s.estado", ["elegida", "pagada", "cerrada"])
    .whereNotExists(function (this: any) {
      this.select(knex.raw("1"))
        .from(T_PROYECTO)
        .where({ seller_id: sellerId, origen_tipo: "licitacion" })
        .whereRaw(`origen_ref = s.id`)
    })
    .orderBy("s.created_at", "desc")
    .limit(50)
    .select("s.id", "s.folio", "s.trabajo")) as any[]

  let n = 0
  for (const s of ganadas) {
    const trabajo = s.trabajo || {}
    const folio = folioTexto(s.folio)
    try {
      await knex.transaction(async (trx: any) => {
        // El taller nunca recibe los datos de contacto del cliente (HETNA es el
        // intermediario): el cliente queda como "Cliente HETNA" con su folio.
        const clienteId = nuevoId("ccl")
        await trx(T_CLIENTE).insert({
          id: clienteId,
          seller_id: sellerId,
          nombre: `Cliente HETNA · ${folio}`,
          notas: "Llegó por una licitación de HETNA. El contacto es por la plataforma.",
        })
        const proyectoId = nuevoId("cpr")
        const nombre = ocultarContacto(texto(trabajo.servicio || trabajo.necesidad || "", 90)) || "Trabajo"
        await trx(T_PROYECTO).insert({
          id: proyectoId,
          seller_id: sellerId,
          cliente_id: clienteId,
          nombre: `${folio} · ${nombre}`,
          estado: "activo",
          notas: ocultarContacto([
            trabajo.necesidad && String(trabajo.necesidad).slice(0, 800),
            trabajo.material && `Material: ${trabajo.material}`,
            trabajo.cantidad && `Cantidad: ${trabajo.cantidad}`,
            trabajo.medidas && `Medidas: ${trabajo.medidas}`,
            trabajo.tolerancia && `Tolerancia: ${trabajo.tolerancia}`,
            trabajo.acabado && `Acabado: ${trabajo.acabado}`,
          ]
            .filter(Boolean)
            .join("\n")
            .slice(0, 2000)) || null,
          origen_tipo: "licitacion",
          origen_ref: s.id,
        })
        const piezaId = nuevoId("cpz")
        await trx(T_PIEZA).insert({
          id: piezaId,
          seller_id: sellerId,
          proyecto_id: proyectoId,
          nombre: texto(trabajo.servicio || nombre, 90) || "Pieza",
          material: texto(trabajo.material, 90) || null,
          cantidad: parseInt(String(trabajo.cantidad || ""), 10) || null,
        })
        for (const a of Array.isArray(trabajo.archivos) ? trabajo.archivos.slice(0, 10) : []) {
          if (!a?.clave || typeof a.clave !== "string" || !a.clave.startsWith("solicitudes/")) continue
          const ext = String(a.nombre || a.clave).split(".").pop()!.toLowerCase().slice(0, 10)
          await trx(T_ARCHIVO).insert({
            id: nuevoId("car"),
            seller_id: sellerId,
            proyecto_id: proyectoId,
            pieza_id: piezaId,
            nombre: texto(a.nombre, 120) || "archivo",
            ext,
            clave: a.clave,
            tamano: Number(a.tamano) || 0,
            cuenta_cupo: false,
            categoria: categoriaDe(ext),
            revision: 1,
            estado: "borrador",
            notas: "Archivo del cliente",
          })
        }
      })
      n++
    } catch (e) {
      // Otra petición la importó al mismo tiempo (índice único): se ignora
      if (!/duplicate key|unique/i.test(String((e as Error).message))) throw e
    }
  }
  return n
}

export function tokenLiga() {
  return randomBytes(18).toString("base64url")
}
