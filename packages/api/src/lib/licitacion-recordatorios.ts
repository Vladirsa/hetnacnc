// Recordatorios automáticos de licitaciones: empujan los tratos que se quedaron
// detenidos, sin que nadie tenga que estar encima.
//
//   1. Cliente con propuestas que no ha elegido (la solicitud ya cerró): a los
//      2 y a los 5 días del cierre.
//   2. Cliente que eligió y no ha pagado: a 1 y a 3 días de elegir.
//   3. Taller con una contraoferta sin responder: a las 24 y a las 72 horas.
//   4. Taller con hitos de producción atrasados: al día de atraso y luego cada
//      3 días mientras siga atrasado (si mueve la fecha, la cuenta empieza de nuevo).
//
// Cada aviso tiene una clave única en hetna_recordatorio: aunque el job corra
// varias veces, cada recordatorio sale una sola vez.
import { T_PROPUESTA, T_SOLICITUD, folioTexto } from "./licitacion"
import { T_CONTRA } from "./licitacion-versiones"
import { T_HITO } from "./licitacion-hitos"

export const T_RECORDATORIO = "hetna_recordatorio"
const DIA = 86_400_000
const HORA = 3_600_000

let listo = false
export async function asegurarRecordatorios(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_RECORDATORIO))) {
    await knex.schema.createTable(T_RECORDATORIO, (t: any) => {
      t.text("clave").primary()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

/** Aparta la clave; true sólo la primera vez (así cada recordatorio sale una vez). */
export async function apartar(knex: any, clave: string) {
  const r = await knex(T_RECORDATORIO).insert({ clave }).onConflict("clave").ignore().returning("clave")
  return Array.isArray(r) && r.length > 0
}

/** Suelta la clave si el aviso no se pudo mandar, para reintentar en la próxima corrida. */
export const soltar = (knex: any, clave: string) => knex(T_RECORDATORIO).where({ clave }).delete()

/** En qué número de recordatorio va algo, según el tiempo transcurrido y los umbrales. */
export function paso(transcurridoMs: number, umbralesMs: number[]) {
  let n = 0
  umbralesMs.forEach((u, i) => { if (transcurridoMs >= u) n = i + 1 })
  return n
}

export type Pendiente =
  | { tipo: "elegir"; clave: string; n: number; s: any; propuestas: number; mejorPrecio: number | null; menosDias: number | null }
  | { tipo: "pagar"; clave: string; n: number; s: any }
  | { tipo: "contraoferta"; clave: string; n: number; s: any; c: any; sellerId: string }
  | { tipo: "hitos"; claves: string[]; s: any; sellerId: string; hitos: { nombre: string; fecha_plan: string; dias: number }[] }

const CAMPOS_SOL = ["id", "folio", "token", "contacto", "cliente_id", "estado", "etapa", "propuesta_elegida", "trabajo"]
const campos = async (knex: any) => {
  const cols = await knex(T_SOLICITUD).columnInfo()
  return CAMPOS_SOL.filter((c) => c in cols)
}

/** Lo que toca recordar hoy (sin mandar nada todavía). */
export async function pendientes(knex: any, ahora = new Date()): Promise<Pendiente[]> {
  const t = ahora.getTime()
  const out: Pendiente[] = []
  const sel = await campos(knex)
  const cols = await knex(T_SOLICITUD).columnInfo()

  // 1. Propuestas sin elegir, ya cerrada la solicitud (hasta 10 días después)
  if ("aviso_cierre" in cols) {
    const sinElegir = (await knex(T_SOLICITUD)
      .where({ estado: "abierta" })
      .whereNull("propuesta_elegida")
      .whereNotNull("aviso_cierre")
      .where("aviso_cierre", ">=", new Date(t - 10 * DIA))
      .where("aviso_cierre", "<=", new Date(t - 2 * DIA))
      .limit(200)
      .select([...sel, "aviso_cierre"])) as any[]
    if (sinElegir.length) {
      const resumen = (await knex(T_PROPUESTA)
        .whereIn("solicitud_id", sinElegir.map((s) => s.id))
        .whereNot({ estado: "descartada" })
        .groupBy("solicitud_id")
        .select("solicitud_id")
        .count("* as n")
        .min("precio as precio")
        .min("dias as dias")) as any[]
      const por = Object.fromEntries(resumen.map((r) => [r.solicitud_id, r]))
      for (const s of sinElegir) {
        const r = por[s.id]
        if (!r || !Number(r.n)) continue
        const n = paso(t - new Date(s.aviso_cierre).getTime(), [2 * DIA, 5 * DIA])
        if (n) out.push({ tipo: "elegir", clave: `elegir:${s.id}:${n}`, n, s, propuestas: Number(r.n), mejorPrecio: r.precio != null ? Number(r.precio) : null, menosDias: r.dias != null ? Number(r.dias) : null })
      }
    }
  }

  // 2. Eligió y no ha pagado (hasta 7 días)
  if ("etapa_desde" in cols) {
    const sinPagar = (await knex(T_SOLICITUD)
      .where({ estado: "elegida" })
      .where((q: any) => q.whereNull("pago_estado").orWhereNot({ pago_estado: "pagado" }))
      .where("etapa_desde", ">=", new Date(t - 7 * DIA))
      .where("etapa_desde", "<=", new Date(t - DIA))
      .limit(200)
      .select([...sel, "etapa_desde"])) as any[]
    for (const s of sinPagar) {
      const n = paso(t - new Date(s.etapa_desde).getTime(), [DIA, 3 * DIA])
      if (n) out.push({ tipo: "pagar", clave: `pagar:${s.id}:${n}`, n, s })
    }
  }

  // 3. Contraofertas sin responder (hasta 7 días)
  if (await knex.schema.hasTable(T_CONTRA)) {
    const contras = (await knex(`${T_CONTRA} as c`)
      .join(`${T_PROPUESTA} as p`, "p.id", "c.propuesta_id")
      .join(`${T_SOLICITUD} as s`, "s.id", "c.solicitud_id")
      .where("c.estado", "pendiente")
      .where("s.estado", "abierta")
      .where("c.created_at", ">=", new Date(t - 7 * DIA))
      .where("c.created_at", "<=", new Date(t - 24 * HORA))
      .limit(200)
      .select("c.id", "c.precio", "c.dias", "c.created_at", "p.seller_id", ...sel.map((k) => `s.${k} as s_${k}`))) as any[]
    for (const c of contras) {
      const n = paso(t - new Date(c.created_at).getTime(), [24 * HORA, 72 * HORA])
      const s = Object.fromEntries(sel.map((k) => [k, c[`s_${k}`]]))
      if (n) out.push({ tipo: "contraoferta", clave: `contra:${c.id}:${n}`, n, s, c, sellerId: c.seller_id })
    }
  }

  // 4. Hitos atrasados de pedidos en producción
  if (await knex.schema.hasTable(T_HITO)) {
    const hoy = new Date(t).toISOString().slice(0, 10)
    const filas = (await knex(`${T_HITO} as h`)
      .join(`${T_SOLICITUD} as s`, "s.id", "h.solicitud_id")
      .join(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
      .whereNull("h.fecha_real")
      .whereNotNull("h.fecha_plan")
      .where("h.fecha_plan", "<", hoy)
      .where("s.etapa", "en_produccion")
      .orderBy("h.orden")
      .limit(500)
      .select("h.id as hito_id", "h.nombre as hito_nombre", "h.fecha_plan", "p.seller_id", ...sel.map((k) => `s.${k} as s_${k}`))) as any[]
    const grupos = new Map<string, Extract<Pendiente, { tipo: "hitos" }>>()
    for (const f of filas) {
      const plan = new Date(f.fecha_plan).toISOString().slice(0, 10)
      const dias = Math.floor((t - new Date(`${plan}T23:59:59Z`).getTime()) / DIA) + 1
      if (dias < 1) continue
      const clave = `hito:${f.hito_id}:${plan}:${Math.floor((dias - 1) / 3)}`
      const sid = f.s_id
      if (!grupos.has(sid)) grupos.set(sid, { tipo: "hitos", claves: [], s: Object.fromEntries(sel.map((k) => [k, f[`s_${k}`]])), sellerId: f.seller_id, hitos: [] })
      const g = grupos.get(sid)!
      g.claves.push(clave)
      g.hitos.push({ nombre: f.hito_nombre, fecha_plan: plan, dias })
    }
    out.push(...grupos.values())
  }
  return out
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
export const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`
export { folioTexto }
