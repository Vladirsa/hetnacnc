// Fase 4 de la estrategia: "HETNA responde" (como Laserhub, Xometry o Fictiv).
// Todo queda APAGADO hasta que el dueño ponga las claves en el .env del
// backend y decida con su contador y su abogado. Con FASE4_ACTIVA=1:
//
//   4.1 HETNA único responsable: toda solicitud se cobra en modo "hetna" (el
//       cliente le paga a HETNA, HETNA retiene y le paga al taller cuando el
//       cliente confirma que recibió). Usa el flujo que ya existe
//       (lib/licitacion-cobro.ts, lib/saldos-talleres.ts).
//   4.2 Fecha garantizada y exprés: si el taller entrega tarde, se calcula la
//       compensación (FASE4_COMPENSACION_PCT_DIA por día, tope
//       FASE4_COMPENSACION_TOPE_PCT) y queda pendiente en el panel para
//       aplicarla. El cliente puede pedir exprés (+FASE4_EXPRES_PCT).
//   4.3 Control de calidad: la entrega pide foto del trabajo terminado
//       (los hitos de producción ya llevan fotos).
//   4.4 Crédito a empresas: pendiente (requiere definir con el contador cómo
//       se aprueba y se cobra). FASE4_CREDITO_DIAS queda reservado.
//
// Claves (.env de packages/api):
//   FASE4_ACTIVA=1                  enciende 4.1 y 4.2
//   MERCADOPAGO_ACCESS_TOKEN        Mercado Pago de HETNA (cobra y retiene)
//   FACTURAPI_KEY_HETNA             CFDI que emite HETNA al cliente
//   FASE4_COMPENSACION_PCT_DIA=2    % del pedido por día de retraso
//   FASE4_COMPENSACION_TOPE_PCT=20  tope de la compensación
//   FASE4_EXPRES_PCT=25             sobreprecio del servicio exprés (vacío = sin exprés)
//   FASE4_CREDITO_DIAS               (reservado para el crédito a empresas, aún sin usar)
import { T_PROPUESTA, T_SOLICITUD, folioTexto } from "./licitacion"

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function configFase4(env: Record<string, string | undefined> = process.env) {
  return {
    activa: env.FASE4_ACTIVA === "1",
    compensacionPctDia: num(env.FASE4_COMPENSACION_PCT_DIA),
    compensacionTopePct: num(env.FASE4_COMPENSACION_TOPE_PCT) ?? 20,
    expresPct: num(env.FASE4_EXPRES_PCT),
    creditoDias: num(env.FASE4_CREDITO_DIAS),
  }
}

/** Lista de lo que falta para encender la Fase 4 (para el panel). */
export function listaFase4(env: Record<string, string | undefined> = process.env) {
  const c = configFase4(env)
  const hay = (k: string) => Boolean(String(env[k] || "").trim())
  return [
    { clave: "MERCADOPAGO_ACCESS_TOKEN", listo: hay("MERCADOPAGO_ACCESS_TOKEN"), para: "Cobrar y retener el pago del cliente a nombre de HETNA" },
    { clave: "FACTURAPI_KEY_HETNA", listo: hay("FACTURAPI_KEY_HETNA"), para: "Que HETNA emita el CFDI al cliente" },
    { clave: "FASE4_COMPENSACION_PCT_DIA", listo: c.compensacionPctDia != null, para: "Compensación por día de retraso (fecha garantizada)" },
    { clave: "FASE4_EXPRES_PCT", listo: c.expresPct != null, para: "Servicio exprés con sobreprecio (opcional)" },
    { clave: "FASE4_ACTIVA", listo: c.activa, para: "Interruptor general: enciende todo lo anterior" },
  ]
}

/** Compensación por entregar tarde: días de retraso × % diario, con tope. Pura. */
export function compensacion(total: number, diasTarde: number, pctDia: number | null, topePct: number): number {
  if (!pctDia || diasTarde <= 0 || !(total > 0)) return 0
  const pct = Math.min(topePct, diasTarde * pctDia)
  return Math.round(total * pct) / 100
}

export const T_COMPENSACION = "hetna_fase4_compensacion"
let lista = false
async function asegurar(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_COMPENSACION))) {
    await knex.schema.createTable(T_COMPENSACION, (t: any) => {
      t.text("solicitud_id").primary()
      t.text("folio").notNullable()
      t.decimal("total", 12, 2).notNullable()
      t.integer("dias_tarde").notNullable()
      t.decimal("monto", 12, 2).notNullable()
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | aplicada | descartada
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

/**
 * Revisa las entregas de los últimos 30 días cobradas por HETNA y anota la
 * compensación de las que llegaron tarde (una vez por solicitud). No mueve
 * dinero: queda pendiente para que HETNA la aplique (saldo a favor o reembolso).
 */
export async function revisarEntregasTarde(knex: any, logger?: any) {
  const c = configFase4()
  if (!c.activa || !c.compensacionPctDia) return { anotadas: 0 }
  await asegurar(knex)
  const { fechaPrometida } = require("./reputacion-medida")
  const desde = new Date(Date.now() - 30 * 86_400_000)
  const ev = (etapa: string) => knex.raw(`(select min(e.created_at) from hetna_solicitud_evento e where e.solicitud_id = s.id and e.etapa = ?)`, [etapa])
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .join(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
    .where("s.cobro", "hetna")
    .where("s.updated_at", ">=", desde)
    .select("s.id", "s.folio", "p.precio", "p.dias", "p.fecha_entrega", { produccion: ev("en_produccion") }, { entregada: ev("entregada") })
    .catch(() => [])) as any[]
  let anotadas = 0
  for (const f of filas) {
    if (!f.entregada) continue
    const prometida = fechaPrometida(f)
    if (prometida == null) continue
    const dias = Math.floor((new Date(f.entregada).getTime() - prometida) / 86_400_000)
    const monto = compensacion(Number(f.precio), dias, c.compensacionPctDia, c.compensacionTopePct)
    if (!monto) continue
    const n = await knex(T_COMPENSACION)
      .insert({ solicitud_id: f.id, folio: folioTexto(f.folio), total: Number(f.precio), dias_tarde: dias, monto })
      .onConflict("solicitud_id")
      .ignore()
    if ((n as any)?.rowCount !== 0) anotadas++
  }
  if (anotadas) logger?.info?.(`[fase4] ${anotadas} compensaciones por entrega tarde anotadas`)
  return { anotadas }
}

export async function panelFase4(knex: any) {
  await asegurar(knex)
  const pendientes = await knex(T_COMPENSACION).orderBy("created_at", "desc").limit(100).select("*")
  return { config: configFase4(), lista: listaFase4(), compensaciones: pendientes }
}
