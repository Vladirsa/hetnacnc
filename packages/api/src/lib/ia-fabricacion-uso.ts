// Cuánto gasta el asistente de IA para talleres y cuándo se pausa.
//
//   - Tope del mes para TODO el asistente: IA_FABRICACION_TOPE_USD (US$50 por
//     omisión). Al llegar, se pausa solo hasta el día 1 (hora de México).
//   - Tope por taller al día: IA_FABRICACION_MENSAJES_DIA (40 por omisión), para
//     que un solo taller no se acabe el tope de todos.
//
// El tope cubre sólo este asistente. Las demás funciones que usan la misma
// llave de Claude (redes, campañas, resumen de propuestas…) no cuentan aquí.
//
// Cada llamada al modelo (un mensaje puede hacer varias, una por herramienta)
// se registra al momento con sus tokens, incluidos los de caché.

export const T_IA_USO = "hetna_ia_uso"

export const TOPE_MES_USD = () => {
  const n = Number(process.env.IA_FABRICACION_TOPE_USD)
  return Number.isFinite(n) && n >= 0 ? n : 50
}
export const MENSAJES_DIA = () => {
  const n = Number(process.env.IA_FABRICACION_MENSAJES_DIA)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 40
}

// Precio por millón de tokens (US$), entrada / salida. Si se cambia el modelo
// con IA_FABRICACION_MODELO y no está aquí, se cobra como el más caro: así el
// tope nunca se queda corto.
const PRECIOS: Record<string, { entrada: number; salida: number }> = {
  "claude-haiku-5-5": { entrada: 0.1, salida: 0.5 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10 },
  "claude-opus-5-5": { entrada: 4, salida: 20 },
}
const MAS_CARO = { entrada: 4, salida: 20 }

export type Uso = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/** Costo en US$ de una respuesta. Escribir caché cuesta 1.25×; leerla, 0.1×. */
export function costoUsd(modelo: string, u: Uso): number {
  const p = PRECIOS[String(modelo || "").replace(/-\d{8}$/, "")] || MAS_CARO
  const entrada =
    (u.input_tokens || 0) + 1.25 * (u.cache_creation_input_tokens || 0) + 0.1 * (u.cache_read_input_tokens || 0)
  return (entrada * p.entrada + (u.output_tokens || 0) * p.salida) / 1_000_000
}

let lista = false
export async function asegurarUso(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_IA_USO))) {
    await knex.schema.createTable(T_IA_USO, (t: any) => {
      t.bigIncrements("id").primary()
      t.text("seller_id").notNullable().index()
      t.text("modelo").notNullable()
      t.integer("entrada").notNullable().defaultTo(0)
      t.integer("salida").notNullable().defaultTo(0)
      t.integer("cache_escrita").notNullable().defaultTo(0)
      t.integer("cache_leida").notNullable().defaultTo(0)
      t.decimal("costo_usd", 12, 6).notNullable().defaultTo(0)
      // Una fila por mensaje del taller lleva nuevo_mensaje = true (para el tope diario)
      t.boolean("nuevo_mensaje").notNullable().defaultTo(false)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

const INICIO_MES =
  "(date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')"
const INICIO_DIA =
  "(date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')"

export async function gastoDelMes(knex: any): Promise<number> {
  const r = await knex(T_IA_USO).whereRaw(`created_at >= ${INICIO_MES}`).sum("costo_usd as s").first()
  return Number(r?.s) || 0
}

export async function mensajesDeHoy(knex: any, sellerId: string): Promise<number> {
  const r = await knex(T_IA_USO)
    .where({ seller_id: sellerId, nuevo_mensaje: true })
    .whereRaw(`created_at >= ${INICIO_DIA}`)
    .count("* as n")
    .first()
  return Number(r?.n) || 0
}

/** Marca que el taller mandó un mensaje (cuenta para su tope del día). */
export async function contarMensaje(knex: any, sellerId: string) {
  await knex(T_IA_USO).insert({ seller_id: sellerId, modelo: "-", nuevo_mensaje: true })
}

export async function registrarUso(knex: any, sellerId: string, modelo: string, u: Uso) {
  await knex(T_IA_USO).insert({
    seller_id: sellerId,
    modelo,
    entrada: u.input_tokens || 0,
    salida: u.output_tokens || 0,
    cache_escrita: u.cache_creation_input_tokens || 0,
    cache_leida: u.cache_read_input_tokens || 0,
    costo_usd: costoUsd(modelo, u),
  })
}

export type Estado = {
  pausada: boolean
  gastado_usd: number
  tope_usd: number
  mensajes_hoy: number
  mensajes_dia: number
}

export async function estadoUso(knex: any, sellerId: string): Promise<Estado> {
  await asegurarUso(knex)
  const [gastado, hoy] = await Promise.all([gastoDelMes(knex), mensajesDeHoy(knex, sellerId)])
  const tope = TOPE_MES_USD()
  return {
    pausada: gastado >= tope,
    gastado_usd: Math.round(gastado * 100) / 100,
    tope_usd: tope,
    mensajes_hoy: hoy,
    mensajes_dia: MENSAJES_DIA(),
  }
}
