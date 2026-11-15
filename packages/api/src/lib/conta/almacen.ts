// Departamento de contabilidad: dónde se guarda todo.
//
// Pensado para varios contribuyentes desde el día uno: HETNA (el dueño, persona
// física) y después cada taller (seller). Todas las rutas de entrada (XML a
// mano, ZIP, descarga masiva del SAT, Facturapi, facturas de la tienda) pasan
// por guardarCfdi(): un solo camino, una sola forma de clasificar.
import { unzipSync, strFromU8 } from "fflate"

import { ErrorCfdi, leerCfdi, type Cfdi } from "./cfdi"

export const T_CONTRIBUYENTE = "hetna_conta_contribuyente"
export const T_CFDI = "hetna_conta_cfdi"
export const T_MOVIMIENTO = "hetna_conta_movimiento"
export const T_HALLAZGO = "hetna_conta_hallazgo"

// Cómo cuenta cada factura para ISR e IVA (la elige el sistema y la corrige el usuario)
export const CATEGORIAS = {
  ingreso: "Ingreso propio",
  cobro_terceros: "Cobro por cuenta de terceros (no es ingreso)",
  gasto: "Gasto deducible",
  inversion: "Inversión (se deprecia)",
  no_deducible: "No deducible",
  personal: "Personal (deducción de la anual)",
  pago: "Complemento de pago",
  nomina: "Nómina",
  ignorar: "No cuenta",
} as const
export type Categoria = keyof typeof CATEGORIAS

let listo = false
export async function asegurarConta(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_CONTRIBUYENTE))) {
    await knex.schema.createTable(T_CONTRIBUYENTE, (t: any) => {
      t.text("id").primary()
      t.text("dueno").notNullable() // hetna | seller
      t.text("seller_id").nullable().unique()
      t.text("rfc").notNullable()
      t.text("nombre").nullable()
      t.text("regimen").notNullable().defaultTo("612") // 612 actividad empresarial | 626 RESICO
      t.text("cp").nullable()
      t.text("token_excel").nullable().unique() // liga de solo lectura para Excel / Google Sheets
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_CFDI))) {
    await knex.schema.createTable(T_CFDI, (t: any) => {
      t.text("id").primary()
      t.text("contribuyente_id").notNullable().index()
      t.text("uuid").notNullable()
      t.text("direccion").notNullable() // emitido | recibido
      t.text("tipo").notNullable()      // I E P N T
      t.text("version").nullable()
      t.timestamp("fecha", { useTz: false }).notNullable()
      t.text("emisor_rfc").notNullable().index()
      t.text("emisor_nombre").nullable()
      t.text("receptor_rfc").notNullable().index()
      t.text("receptor_nombre").nullable()
      t.text("metodo").nullable()
      t.text("forma").nullable()
      t.text("moneda").nullable()
      t.decimal("tipo_cambio", 14, 6).nullable()
      t.decimal("subtotal_mxn", 14, 2).notNullable().defaultTo(0)
      t.decimal("descuento_mxn", 14, 2).notNullable().defaultTo(0)
      t.decimal("total_mxn", 14, 2).notNullable().defaultTo(0)
      t.decimal("iva_trasladado", 14, 2).notNullable().defaultTo(0)
      t.decimal("iva_retenido", 14, 2).notNullable().defaultTo(0)
      t.decimal("isr_retenido", 14, 2).notNullable().defaultTo(0)
      t.decimal("ieps", 14, 2).notNullable().defaultTo(0)
      t.text("categoria").notNullable()
      t.boolean("categoria_manual").notNullable().defaultTo(false)
      t.text("tipo_activo").nullable() // si es inversión: clave de DEPRECIACION (parametros.ts)
      t.jsonb("datos").notNullable() // el Cfdi leído completo (conceptos, relacionados, pagos…)
      t.text("xml").notNullable()
      t.text("origen").notNullable().defaultTo("xml") // xml | zip | sat | facturapi | tienda
      t.text("estatus_sat").nullable() // vigente | cancelado | no_encontrado
      t.timestamp("estatus_revisado_en", { useTz: true }).nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.unique(["contribuyente_id", "uuid"])
      t.index(["contribuyente_id", "fecha"])
    })
  }
  if (!(await knex.schema.hasTable(T_MOVIMIENTO))) {
    await knex.schema.createTable(T_MOVIMIENTO, (t: any) => {
      t.text("id").primary()
      t.text("contribuyente_id").notNullable().index()
      t.date("fecha").notNullable()
      t.text("tipo").notNullable() // ingreso | gasto
      t.text("concepto").notNullable()
      t.decimal("subtotal", 14, 2).notNullable()
      t.decimal("iva", 14, 2).notNullable().defaultTo(0)
      t.text("uuid").nullable() // si en realidad tiene factura, para conciliar
      t.text("origen").notNullable().defaultTo("excel")
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_HALLAZGO))) {
    await knex.schema.createTable(T_HALLAZGO, (t: any) => {
      t.text("id").primary()
      t.text("contribuyente_id").notNullable().index()
      t.text("clave").notNullable() // regla:uuid (estable: el loop diario no repite)
      t.text("regla").notNullable()
      t.text("uuid").nullable()
      t.text("severidad").notNullable() // alta | media | baja
      t.text("auditor").notNullable().defaultTo("fiscal") // fiscal | forense
      t.text("mensaje").notNullable()
      t.text("base_legal").nullable()
      t.text("estado").notNullable().defaultTo("abierto") // abierto | resuelto | descartado
      t.text("nota").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.unique(["contribuyente_id", "clave"])
    })
  }
  listo = true
}

const id = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** El contribuyente de HETNA (el dueño). Se crea la primera vez con el RFC que se dé. */
export async function contribuyenteHetna(knex: any, datos?: { rfc?: string; nombre?: string; regimen?: string; cp?: string }) {
  await asegurarConta(knex)
  let c = await knex(T_CONTRIBUYENTE).where({ dueno: "hetna" }).first()
  if (!c && datos?.rfc) {
    c = { id: id("ctb"), dueno: "hetna", rfc: datos.rfc.toUpperCase().trim(), nombre: datos.nombre || null, regimen: datos.regimen || "612", cp: datos.cp || null }
    await knex(T_CONTRIBUYENTE).insert(c)
  } else if (c && datos?.rfc) {
    const cambios = { rfc: datos.rfc.toUpperCase().trim(), nombre: datos.nombre ?? c.nombre, regimen: datos.regimen || c.regimen, cp: datos.cp ?? c.cp }
    await knex(T_CONTRIBUYENTE).where({ id: c.id }).update(cambios)
    c = { ...c, ...cambios }
  }
  return c || null
}

export const RFC_VALIDO = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/

/** Categoría inicial según quién emite y el tipo. El usuario la puede cambiar. */
export function categoriaInicial(c: Cfdi, direccion: "emitido" | "recibido"): Categoria {
  if (c.tipo === "P") return "pago"
  if (c.tipo === "N") return direccion === "emitido" ? "nomina" : "ignorar"
  if (c.tipo === "T") return "ignorar"
  if (direccion === "emitido") return "ingreso"
  // Recibidos: deducciones personales por uso de CFDI (D01-D10) van a la anual
  if (/^D(0[1-9]|10)$/.test(c.uso || "")) return "personal"
  if (c.uso === "S01") return "no_deducible"
  // Usos de inversión (I01-I08)
  if (/^I0[1-8]$/.test(c.uso || "")) return "inversion"
  return "gasto"
}

export type ResultadoCarga = { nuevos: number; repetidos: number; ajenos: string[]; errores: string[] }

/** Guarda un CFDI del contribuyente. Si ya estaba, actualiza los datos pero respeta la categoría que eligió el usuario. */
export async function guardarCfdi(knex: any, ctb: { id: string; rfc: string }, xml: string, origen = "xml"): Promise<"nuevo" | "repetido"> {
  await asegurarConta(knex)
  const c = leerCfdi(xml)
  const rfc = ctb.rfc.toUpperCase()
  const direccion = c.emisor_rfc === rfc ? "emitido" : c.receptor_rfc === rfc ? "recibido" : null
  if (!direccion) throw new ErrorCfdi(`El CFDI ${c.uuid} no es de ${rfc} (emisor ${c.emisor_rfc}, receptor ${c.receptor_rfc}).`)
  const previo = await knex(T_CFDI).where({ contribuyente_id: ctb.id, uuid: c.uuid }).first("id", "categoria", "categoria_manual")
  const fila = {
    contribuyente_id: ctb.id, uuid: c.uuid, direccion, tipo: c.tipo, version: c.version,
    fecha: c.fecha.replace("T", " ").slice(0, 19),
    emisor_rfc: c.emisor_rfc, emisor_nombre: c.emisor_nombre, receptor_rfc: c.receptor_rfc, receptor_nombre: c.receptor_nombre,
    metodo: c.metodo, forma: c.forma, moneda: c.moneda, tipo_cambio: c.tipo_cambio,
    subtotal_mxn: c.subtotal_mxn, descuento_mxn: c.descuento_mxn, total_mxn: c.total_mxn,
    iva_trasladado: c.impuestos.iva_trasladado, iva_retenido: c.impuestos.iva_retenido, isr_retenido: c.impuestos.isr_retenido, ieps: c.impuestos.ieps,
    datos: JSON.stringify(c), xml, origen,
  }
  if (previo) {
    await knex(T_CFDI).where({ id: previo.id }).update({ ...fila, categoria: previo.categoria_manual ? previo.categoria : categoriaInicial(c, direccion) })
    return "repetido"
  }
  await knex(T_CFDI).insert({ id: id("cfdi"), ...fila, categoria: categoriaInicial(c, direccion) })
  return "nuevo"
}

/** Carga varios archivos: XML sueltos o ZIP (como los que entrega el SAT). */
export async function cargarArchivos(knex: any, ctb: { id: string; rfc: string }, archivos: { nombre: string; datos: Buffer }[], origen = "xml"): Promise<ResultadoCarga> {
  const out: ResultadoCarga = { nuevos: 0, repetidos: 0, ajenos: [], errores: [] }
  const xmls: { nombre: string; texto: string }[] = []
  for (const a of archivos) {
    if (/\.zip$/i.test(a.nombre)) {
      try {
        const dentro = unzipSync(new Uint8Array(a.datos))
        for (const [n, bytes] of Object.entries(dentro)) if (/\.xml$/i.test(n)) xmls.push({ nombre: `${a.nombre}/${n}`, texto: strFromU8(bytes) })
      } catch (e) {
        out.errores.push(`${a.nombre}: no se pudo abrir el ZIP (${(e as Error).message})`)
      }
    } else if (/\.xml$/i.test(a.nombre)) xmls.push({ nombre: a.nombre, texto: a.datos.toString("utf8") })
    else out.errores.push(`${a.nombre}: sólo se aceptan XML o ZIP`)
  }
  for (const x of xmls) {
    try {
      const r = await guardarCfdi(knex, ctb, x.texto, origen)
      if (r === "nuevo") out.nuevos++
      else out.repetidos++
    } catch (e) {
      const m = (e as Error).message
      if (/no es de/.test(m)) out.ajenos.push(x.nombre)
      else out.errores.push(`${x.nombre}: ${m}`)
    }
  }
  return out
}
