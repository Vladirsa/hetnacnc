// Precios de la calculadora que el dueño ajusta a su gusto (Panel de HETNA >
// "Precios de la calculadora"). Se guardan en una sola fila y los usan:
//   - /store/precio-instantaneo, el correo del estimado y el asistente de IA
//   - la calculadora de /cotizar y "Fabrícalo con un taller" (vía /store/hetna-precios)
// Lo que no se guarda usa el valor de fábrica de estimador-referencia.ts.
import { configDeFabrica, type ConfigPrecios, MATERIALES, type TipoMaquina } from "./estimador-referencia"

export const T_PRECIOS = "hetna_precios_config"

let lista = false
async function asegurar(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_PRECIOS))) {
    await knex.schema.createTable(T_PRECIOS, (t: any) => {
      t.text("id").primary()
      t.jsonb("datos").notNullable()
      t.text("actualizado_por").nullable()
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

// Un minuto en memoria: la calculadora pide precio a cada tecla
let cache: { cfg: ConfigPrecios; en: number; actualizado: string | null } | null = null

export async function leerConfigPrecios(knex: any): Promise<{ cfg: ConfigPrecios; actualizado: string | null }> {
  if (cache && Date.now() - cache.en < 60_000) return cache
  try {
    await asegurar(knex)
    const fila = await knex(T_PRECIOS).where({ id: "principal" }).first()
    cache = { cfg: limpiarConfig(fila?.datos || {}), en: Date.now(), actualizado: fila?.updated_at ? new Date(fila.updated_at).toISOString() : null }
  } catch {
    cache = { cfg: {}, en: Date.now(), actualizado: null }
  }
  return cache
}

const num = (v: unknown, min: number, max: number): number | undefined => {
  if (v === "" || v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : undefined
}

/** Sólo pasan números en rango y llaves conocidas. */
export function limpiarConfig(v: any): ConfigPrecios {
  const o = v && typeof v === "object" ? v : {}
  const fab = configDeFabrica()
  const out: ConfigPrecios = {}
  const maquinas: ConfigPrecios["maquinas"] = {}
  for (const k of Object.keys(fab.maquinas) as TipoMaquina[]) {
    const m = o.maquinas?.[k] || {}
    const x = { costoHora: num(m.costoHora, 0, 100000), prep: num(m.prep, 0, 600), velocidadPct: num(m.velocidadPct, 10, 500) }
    if (x.costoHora != null || x.prep != null || x.velocidadPct != null) maquinas[k] = x
  }
  if (Object.keys(maquinas).length) out.maquinas = maquinas
  const campos: [keyof ConfigPrecios, number, number][] = [
    ["operadorHora", 0, 10000],
    ["fijosHora", 0, 10000],
    ["margenPct", 0, 80],
    ["markupMaterialPct", 0, 300],
    ["rangoPct", 0, 50],
    ["pedidoMinimo", 0, 100000],
  ]
  for (const [k, min, max] of campos) {
    const n = num(o[k], min, max)
    if (n != null) (out as any)[k] = n
  }
  // Sólo los precios que el dueño CAMBIÓ: si guarda el de fábrica sin tocarlo,
  // no debe tapar el precio de mercado que mide el agente (materiales-precios).
  const fabrica = new Map(MATERIALES.map((m) => [m.nombre, m.precio]))
  const precios: Record<string, number> = {}
  for (const [k, val] of Object.entries(o.preciosMaterial || {})) {
    const n = num(val, 0, 1_000_000)
    if (fabrica.has(k) && n != null && n !== fabrica.get(k)) precios[k] = n
  }
  if (Object.keys(precios).length) out.preciosMaterial = precios
  return out
}

export async function guardarConfigPrecios(knex: any, datos: unknown, quien?: string | null) {
  await asegurar(knex)
  const cfg = limpiarConfig(datos)
  await knex(T_PRECIOS)
    .insert({ id: "principal", datos: JSON.stringify(cfg), actualizado_por: quien || null, updated_at: knex.fn.now() })
    .onConflict("id")
    .merge()
  cache = null
  return cfg
}
