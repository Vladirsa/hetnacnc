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

// ---------------------------------------------------------------------
// Archivos que viven en el módulo de archivos de Medusa (servicio CAM):
// la clave se guarda como "medusa:<file_id>" y se descargan con la liga que
// da el módulo, sin copiarlos a B2 (no ocupan cupo).
// ---------------------------------------------------------------------

export const PREFIJO_MEDUSA = "medusa:"
export const esDeMedusa = (clave: string) => String(clave || "").startsWith(PREFIJO_MEDUSA)

/** Liga de descarga de un archivo guardado en el módulo de archivos de Medusa. */
export async function ligaMedusa(scope: { resolve: (k: string) => any }, clave: string): Promise<string | null> {
  if (!esDeMedusa(clave)) return null
  try {
    const archivo = await scope.resolve("file").retrieveFile(clave.slice(PREFIJO_MEDUSA.length))
    return archivo?.url || null
  } catch {
    return null
  }
}

const ESTADOS_CAM_LISTOS = ["paid", "in_review", "delivered"]

/**
 * Importa los trabajos del servicio CAM de HETNA que pidió el taller (con
 * el correo de su cuenta de vendedor) como proyectos con su modelo, su G-code
 * y los entregables. Idempotente, como las licitaciones.
 */
export async function importarCam(knex: any, sellerId: string): Promise<number> {
  if (!(await knex.schema.hasTable("cam_job"))) return 0
  const seller = await knex("seller").where({ id: sellerId }).first("email")
  const correo = String(seller?.email || "").trim().toLowerCase()
  if (!correo) return 0
  const clientes = (await knex("customer").whereRaw("lower(email) = ?", [correo]).whereNull("deleted_at").pluck("id")) as string[]

  const trabajos = (await knex("cam_job as j")
    .whereIn("j.status", ESTADOS_CAM_LISTOS)
    .whereNull("j.deleted_at")
    .where((q: any) => {
      q.whereRaw("lower(j.email) = ?", [correo])
      if (clientes.length) q.orWhereIn("j.customer_id", clientes)
    })
    .whereNotExists(function (this: any) {
      this.select(knex.raw("1"))
        .from(T_PROYECTO)
        .where({ seller_id: sellerId, origen_tipo: "cam" })
        .whereRaw(`origen_ref = j.id`)
    })
    .orderBy("j.created_at", "desc")
    .limit(50)
    .select("j.id", "j.model_name", "j.model_file_id", "j.gcode_file_id", "j.deliverables", "j.service", "j.controller", "j.stats")) as any[]

  let n = 0
  for (const j of trabajos) {
    const archivos: { nombre: string; id: string }[] = []
    if (j.model_file_id) archivos.push({ nombre: j.model_name || "modelo", id: j.model_file_id })
    if (j.gcode_file_id) archivos.push({ nombre: `${String(j.model_name || "pieza").replace(/\.[^.]+$/, "")}.nc`, id: j.gcode_file_id })
    for (const d of Array.isArray(j.deliverables) ? j.deliverables : []) {
      if (d?.id) archivos.push({ nombre: String(d.name || d.id), id: String(d.id) })
    }
    try {
      await knex.transaction(async (trx: any) => {
        const proyectoId = nuevoId("cpr")
        const nombre = texto(j.model_name, 90) || "Pieza"
        await trx(T_PROYECTO).insert({
          id: proyectoId,
          seller_id: sellerId,
          nombre: `CAM · ${nombre}`,
          estado: "activo",
          notas: [`Servicio CAM de HETNA (${j.service})`, j.controller && `Controlador: ${j.controller}`].filter(Boolean).join("\n"),
          origen_tipo: "cam",
          origen_ref: j.id,
        })
        const piezaId = nuevoId("cpz")
        await trx(T_PIEZA).insert({ id: piezaId, seller_id: sellerId, proyecto_id: proyectoId, nombre })
        for (const a of archivos.slice(0, 30)) {
          const ext = (a.nombre.split(".").pop() || "").toLowerCase().slice(0, 10)
          await trx(T_ARCHIVO).insert({
            id: nuevoId("car"),
            seller_id: sellerId,
            proyecto_id: proyectoId,
            pieza_id: piezaId,
            nombre: texto(a.nombre, 120) || "archivo",
            ext,
            clave: `${PREFIJO_MEDUSA}${a.id}`,
            tamano: 0,
            cuenta_cupo: false,
            categoria: categoriaDe(ext),
            revision: 1,
            estado: "borrador",
            notas: "Del servicio CAM de HETNA",
          })
        }
      })
      n++
    } catch (e) {
      if (!/duplicate key|unique/i.test(String((e as Error).message))) throw e
    }
  }
  return n
}

/**
 * Importa los pedidos pagados de la tienda del taller (últimos 90 días) como
 * proyectos: el cliente con su nombre y una pieza por producto. Lo pide el
 * taller con un botón (no es automático: hay talleres con muchos pedidos).
 */
export async function importarPedidos(scope: { resolve: (k: string) => any }, knex: any, sellerId: string): Promise<number> {
  const query = scope.resolve("query")
  const { data: vinculos } = await query.graph({
    entity: "order_seller",
    fields: ["order_id"],
    filters: { seller_id: sellerId } as any,
  })
  const ids = (vinculos as any[]).map((v) => v.order_id).filter(Boolean)
  if (!ids.length) return 0
  const ya = new Set(
    (await knex(T_PROYECTO).where({ seller_id: sellerId, origen_tipo: "pedido" }).whereIn("origen_ref", ids).pluck("origen_ref")) as string[]
  )
  const faltan = ids.filter((id) => !ya.has(id))
  if (!faltan.length) return 0

  const desde = Date.now() - 90 * 86400_000
  const { data: pedidos } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "status", "payment_status", "created_at",
      "shipping_address.first_name", "shipping_address.last_name", "shipping_address.company", "shipping_address.phone",
      "email", "items.title", "items.product_title", "items.variant_title", "items.quantity",
    ],
    filters: { id: faltan.slice(0, 200) } as any,
  })
  const PAGADO = new Set(["captured", "partially_captured", "authorized", "partially_authorized"])
  let n = 0
  for (const o of (pedidos as any[])
    .filter((o) => o.status !== "canceled" && PAGADO.has(String(o.payment_status)) && new Date(o.created_at).getTime() >= desde)
    .slice(0, 50)) {
    const dir = o.shipping_address || {}
    const nombreCliente = [dir.first_name, dir.last_name].filter(Boolean).join(" ").trim() || String(o.email || "").split("@")[0] || "Cliente"
    try {
      await knex.transaction(async (trx: any) => {
        // Un cliente por correo: si ya existe, se reusa
        let cliente = o.email
          ? await trx(T_CLIENTE).where({ seller_id: sellerId }).whereRaw("lower(correo) = ?", [String(o.email).toLowerCase()]).first("id")
          : null
        if (!cliente) {
          cliente = { id: nuevoId("ccl") }
          await trx(T_CLIENTE).insert({
            id: cliente.id,
            seller_id: sellerId,
            nombre: texto(nombreCliente, 120),
            empresa: texto(dir.company, 120) || null,
            correo: texto(o.email, 160) || null,
            telefono: texto(dir.phone, 40) || null,
            notas: "Cliente de la tienda HETNA",
          })
        }
        const proyectoId = nuevoId("cpr")
        await trx(T_PROYECTO).insert({
          id: proyectoId,
          seller_id: sellerId,
          cliente_id: cliente.id,
          nombre: `Pedido #${o.display_id}`,
          estado: "activo",
          origen_tipo: "pedido",
          origen_ref: o.id,
        })
        for (const it of (o.items || []).slice(0, 50)) {
          await trx(T_PIEZA).insert({
            id: nuevoId("cpz"),
            seller_id: sellerId,
            proyecto_id: proyectoId,
            nombre: texto([it.product_title || it.title, it.variant_title].filter(Boolean).join(" · "), 120) || "Producto",
            cantidad: Number(it.quantity) || null,
          })
        }
      })
      n++
    } catch (e) {
      if (!/duplicate key|unique/i.test(String((e as Error).message))) throw e
    }
  }
  return n
}
