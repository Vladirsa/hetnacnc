// Reputación medida: lo que el taller y el cliente HICIERON, no sólo lo que opinaron.
//
// Se calcula con lo que ya se registra en cada licitación:
//   - fecha prometida: la fecha de entrega de la propuesta elegida o, si no dio
//     una, el día en que entró a producción (al pagar) + los días que ofreció;
//   - fecha real: cuándo el taller la marcó entregada;
//   - trabajos terminados (entregada o cerrada después de producción) contra los
//     cancelados ya pagados;
//   - reclamos sobre las calificaciones de esos trabajos y cuántos se resolvieron.
//
// El puntaje (0–100) sólo se muestra con MIN_TRABAJOS terminados; antes es
// "historial insuficiente". Pesos: puntualidad 40, calidad calificada 25,
// trabajos terminados 20, reclamos resueltos 15 (si falta un dato, se reparte).
import { T_PROPUESTA, T_SOLICITUD } from "./licitacion"

// Los nombres se repiten aquí (y no se importan de trust.ts y seguimiento.ts) para no crear un ciclo:
// trust.ts llama a este archivo al recalcular el perfil del taller.
const T_EVENTO = "hetna_solicitud_evento"
const T_RECLAMO = "hetna_resena_reclamo"
const T_RESENA = "hetna_resena_taller"
export const MIN_TRABAJOS = 3
const GRACIA_DIAS = 1 // entregar un día después de lo prometido todavía cuenta como a tiempo

const DIA = 86_400_000
const r1 = (x: number) => Math.round(x * 10) / 10

export type MedidaTaller = {
  terminados: number
  en_curso: number
  cancelados: number
  a_tiempo: number
  con_fecha: number
  puntualidad_pct: number | null
  retraso_promedio_dias: number | null
  terminados_pct: number | null
  reclamos: number
  reclamos_resueltos: number
  calidad: number | null
  puntaje: number | null
  suficiente: boolean
}

type Fila = {
  id: string
  etapa: string | null
  estado: string
  dias: number | null
  fecha_entrega: string | Date | null
  produccion: string | Date | null
  entregada: string | Date | null
}

async function existe(knex: any, t: string) {
  return knex.schema.hasTable(t)
}

/** Fecha prometida en ms, o null si no se puede saber. */
export function fechaPrometida(f: Pick<Fila, "dias" | "fecha_entrega" | "produccion">): number | null {
  if (f.fecha_entrega) {
    const t = new Date(f.fecha_entrega).getTime()
    // fecha sin hora: cuenta todo ese día
    if (Number.isFinite(t)) return t + DIA - 1
  }
  if (f.produccion && f.dias != null) {
    const t = new Date(f.produccion).getTime()
    if (Number.isFinite(t)) return t + Number(f.dias) * DIA
  }
  return null
}

/** Puntaje 0–100 con los pesos de arriba; null si no hay ningún dato. */
export function puntajeMedido(m: { puntualidad_pct: number | null; calidad: number | null; terminados_pct: number | null; reclamos: number; reclamos_resueltos: number }) {
  const partes: [number | null, number][] = [
    [m.puntualidad_pct == null ? null : m.puntualidad_pct / 100, 40],
    [m.calidad == null ? null : m.calidad / 5, 25],
    [m.terminados_pct == null ? null : m.terminados_pct / 100, 20],
    [m.reclamos ? m.reclamos_resueltos / m.reclamos : null, 15],
  ]
  const con = partes.filter(([v]) => v != null) as [number, number][]
  if (!con.length) return null
  const peso = con.reduce((a, [, w]) => a + w, 0)
  return Math.round((con.reduce((a, [v, w]) => a + v * w, 0) / peso) * 100)
}

export async function medirTaller(knex: any, sellerId: string): Promise<MedidaTaller> {
  const vacio: MedidaTaller = {
    terminados: 0, en_curso: 0, cancelados: 0, a_tiempo: 0, con_fecha: 0, puntualidad_pct: null, retraso_promedio_dias: null,
    terminados_pct: null, reclamos: 0, reclamos_resueltos: 0, calidad: null, puntaje: null, suficiente: false,
  }
  if (!(await existe(knex, T_SOLICITUD)) || !(await existe(knex, T_PROPUESTA))) return vacio
  const hayEventos = await existe(knex, T_EVENTO)
  const ev = (etapa: string) =>
    hayEventos ? knex.raw(`(select min(e.created_at) from ${T_EVENTO} e where e.solicitud_id = s.id and e.etapa = ?)`, [etapa]) : knex.raw("null")

  const filas: Fila[] = await knex(`${T_SOLICITUD} as s`)
    .join(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
    .where("p.seller_id", sellerId)
    .select("s.id", "s.etapa", "s.estado", "p.dias", "p.fecha_entrega", { produccion: ev("en_produccion") }, { entregada: ev("entregada") })

  const m = { ...vacio }
  let retrasoTotal = 0
  let tarde = 0
  for (const f of filas) {
    const pagada = !!f.produccion || f.estado === "pagada"
    if (!pagada) continue // sin pago no hay compromiso del taller todavía
    const terminado = !!f.entregada || f.etapa === "entregada" || (f.etapa === "cerrada" && !!f.produccion)
    if (terminado) {
      m.terminados++
      const prometida = fechaPrometida(f)
      if (prometida != null && f.entregada) {
        m.con_fecha++
        const real = new Date(f.entregada).getTime()
        if (real <= prometida + GRACIA_DIAS * DIA) m.a_tiempo++
        else {
          tarde++
          retrasoTotal += (real - prometida) / DIA
        }
      }
    } else if (f.etapa === "cancelada") m.cancelados++
    else m.en_curso++
  }
  m.puntualidad_pct = m.con_fecha ? Math.round((m.a_tiempo / m.con_fecha) * 100) : null
  m.retraso_promedio_dias = tarde ? r1(retrasoTotal / tarde) : m.con_fecha ? 0 : null
  m.terminados_pct = m.terminados + m.cancelados ? Math.round((m.terminados / (m.terminados + m.cancelados)) * 100) : null

  const ids = filas.map((f) => f.id)
  if (ids.length && (await existe(knex, T_RECLAMO))) {
    const r = await knex(T_RECLAMO).whereIn("solicitud_id", ids).select(knex.raw("count(*) as n"), knex.raw("count(*) filter (where estado <> 'abierto') as resueltos")).first()
    m.reclamos = Number(r?.n || 0)
    m.reclamos_resueltos = Number(r?.resueltos || 0)
  }
  if (await existe(knex, T_RESENA)) {
    const r = await knex(T_RESENA).where({ seller_id: sellerId }).where((w: any) => w.whereNull("visible").orWhere("visible", true)).avg({ c: "calidad" }).first().catch(() => null)
    m.calidad = r?.c != null ? r1(Number(r.c)) : null
  }
  m.suficiente = m.terminados >= MIN_TRABAJOS
  m.puntaje = m.suficiente ? puntajeMedido(m) : null
  return m
}

export type MedidaCliente = { pagados: number; recibidos: number; cancelados_tras_elegir: number; suficiente: boolean }

/** Lo que hizo el cliente como comprador: pagó, confirmó que recibió, o canceló después de elegir taller. */
export async function medirCliente(knex: any, c: { clienteId?: string | null; email?: string | null }): Promise<MedidaCliente> {
  const vacio = { pagados: 0, recibidos: 0, cancelados_tras_elegir: 0, suficiente: false }
  const email = String(c.email || "").toLowerCase().trim()
  if ((!c.clienteId && !email) || !(await existe(knex, T_SOLICITUD))) return vacio
  const tieneCliente = await knex.schema.hasColumn(T_SOLICITUD, "cliente_id")
  const hayEventos = await existe(knex, T_EVENTO)
  const q = knex(`${T_SOLICITUD} as s`)
    .whereNotNull("s.propuesta_elegida")
    .where((w: any) => {
      if (c.clienteId && tieneCliente) w.orWhere("s.cliente_id", c.clienteId)
      if (email) w.orWhereRaw("lower(s.contacto->>'email') = ?", [email])
    })
  const filas: { etapa: string | null; estado: string; pagada: boolean; recibido: boolean }[] = await q.select(
    "s.etapa",
    "s.estado",
    hayEventos ? knex.raw(`exists(select 1 from ${T_EVENTO} e where e.solicitud_id = s.id and e.etapa = 'en_produccion') as pagada`) : knex.raw("false as pagada"),
    hayEventos ? knex.raw(`exists(select 1 from ${T_EVENTO} e where e.solicitud_id = s.id and e.etapa = 'cerrada' and e.actor = 'cliente') as recibido`) : knex.raw("false as recibido")
  )
  const m = { ...vacio }
  for (const f of filas) {
    if (f.pagada || f.estado === "pagada") m.pagados++
    if (f.recibido) m.recibidos++
    if (f.etapa === "cancelada" && !(f.pagada || f.estado === "pagada")) m.cancelados_tras_elegir++
  }
  m.suficiente = m.pagados + m.cancelados_tras_elegir >= MIN_TRABAJOS
  return m
}
