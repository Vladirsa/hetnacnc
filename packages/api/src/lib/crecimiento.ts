// Los 3 números de crecimiento que se miran cada semana (estrategia nov 2026):
//   1) talleres activos: negocios con alguna cotización o avance de orden en 7 días
//   2) cotizaciones hechas con el simulador (partidas con tiempo_min) y totales
//   3) licitaciones cerradas (aceptada / en_produccion / entregada / cerrada)
// más: nuevos talleres, % que cotizó el mismo día del alta, referidos (cuando
// exista la columna), y la tendencia de 8 semanas de cada uno.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { leerTalleres, registrado, supa } from "./cotizador-crm"
import { T_SOLICITUD } from "./licitacion"

const DIA = 86_400_000
const SEMANAS = 8

type Punto = { semana: string; activos: number; cotizaciones: number; simulador: number; nuevos: number; licitaciones: number }

function inicioSemana(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  const dia = (x.getDay() + 6) % 7 // lunes = 0
  x.setDate(x.getDate() - dia)
  return x
}

export async function metricasCrecimiento(scope: any) {
  const ahora = new Date()
  const desde = new Date(inicioSemana(ahora).getTime() - (SEMANAS - 1) * 7 * DIA)
  const iso = encodeURIComponent(desde.toISOString())

  const [talleres, cots, items, avances, solicitudes] = await Promise.all([
    leerTalleres(),
    supa<{ id: string; negocio_id: string | null; created_at: string }[]>(`/rest/v1/cotizaciones?select=id,negocio_id,created_at&created_at=gte.${iso}&limit=100000`).catch(() => []),
    supa<{ cotizacion_id: string }[]>(`/rest/v1/cotizacion_items?select=cotizacion_id&tiempo_min=not.is.null&limit=100000`).catch(() => []),
    supa<{ negocio_id: string | null; created_at: string }[]>(`/rest/v1/pedido_avances?select=negocio_id,created_at&created_at=gte.${iso}&limit=100000`).catch(() => []),
    (async () => {
      try {
        const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
        return (await knex(T_SOLICITUD).select("id", "etapa", "etapa_desde", "updated_at", "created_at").where("created_at", ">=", desde)) as { etapa: string | null; etapa_desde: string | null; updated_at: string; created_at: string }[]
      } catch { return [] }
    })(),
  ])
  const conSimulador = new Set(items.map((i) => i.cotizacion_id))

  // Semanas
  const puntos: Punto[] = []
  for (let s = 0; s < SEMANAS; s++) {
    const ini = new Date(inicioSemana(ahora).getTime() - (SEMANAS - 1 - s) * 7 * DIA)
    const fin = new Date(ini.getTime() + 7 * DIA)
    const en = (iso: string | null) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= ini.getTime() && t < fin.getTime() }
    const activos = new Set<string>()
    let cotizaciones = 0, simulador = 0
    for (const c of cots) if (en(c.created_at)) { cotizaciones++; if (conSimulador.has(c.id)) simulador++; if (c.negocio_id) activos.add(c.negocio_id) }
    for (const a of avances) if (en(a.created_at) && a.negocio_id) activos.add(a.negocio_id)
    const nuevos = talleres.filter((t) => en(registrado(t)?.toISOString() || null)).length
    const licit = solicitudes.filter((x) => ["aceptada", "en_produccion", "entregada", "cerrada"].includes(x.etapa || "") && en(x.etapa_desde || x.updated_at)).length
    puntos.push({ semana: ini.toISOString().slice(0, 10), activos: activos.size, cotizaciones, simulador, nuevos, licitaciones: licit })
  }

  // Últimos 7 y 30 días
  const hace = (d: number) => Date.now() - d * DIA
  const activos7 = new Set<string>(), activos30 = new Set<string>()
  let cot7 = 0, cot30 = 0, sim7 = 0, sim30 = 0
  for (const c of cots) {
    const t = new Date(c.created_at).getTime()
    if (t >= hace(30)) { cot30++; if (conSimulador.has(c.id)) sim30++; if (c.negocio_id) activos30.add(c.negocio_id) }
    if (t >= hace(7)) { cot7++; if (conSimulador.has(c.id)) sim7++; if (c.negocio_id) activos7.add(c.negocio_id) }
  }
  for (const a of avances) {
    const t = new Date(a.created_at).getTime()
    if (a.negocio_id && t >= hace(30)) activos30.add(a.negocio_id)
    if (a.negocio_id && t >= hace(7)) activos7.add(a.negocio_id)
  }
  const nuevos30 = talleres.filter((t) => { const r = registrado(t); return r && r.getTime() >= hace(30) })
  // % que cotizó el mismo día del alta (de los nuevos en 30 días)
  const primeraCot = new Map<string, number>()
  for (const c of cots) if (c.negocio_id) { const t = new Date(c.created_at).getTime(); if (!primeraCot.has(c.negocio_id) || t < primeraCot.get(c.negocio_id)!) primeraCot.set(c.negocio_id, t) }
  const mismoDia = nuevos30.filter((t) => { const r = registrado(t)!.getTime(); const p = primeraCot.get(t.id); return p != null && p - r < DIA }).length
  const licit30 = solicitudes.filter((x) => ["aceptada", "en_produccion", "entregada", "cerrada"].includes(x.etapa || "") && new Date(x.etapa_desde || x.updated_at).getTime() >= hace(30)).length
  const referidos30 = talleres.filter((t: any) => t.referido_por && registrado(t) && registrado(t)!.getTime() >= hace(30)).length

  return {
    resumen: {
      talleres: talleres.length,
      activos_7: activos7.size, activos_30: activos30.size,
      cotizaciones_7: cot7, cotizaciones_30: cot30, simulador_7: sim7, simulador_30: sim30,
      nuevos_30: nuevos30.length, mismo_dia_pct: nuevos30.length ? Math.round((mismoDia / nuevos30.length) * 100) : null,
      licitaciones_30: licit30, referidos_30: referidos30,
    },
    semanas: puntos,
  }
}
