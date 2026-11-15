// Corrida del loop de auditoría para un contribuyente (la usan el job diario y el botón "Auditar ahora").
import { T_CFDI, T_CONTRIBUYENTE, asegurarConta } from "./almacen"
import { auditar, guardarHallazgos, type Hallazgo } from "./auditor"
import { leerCfdi } from "./cfdi"
import { actualizarLista, buscarEnListas, consultarEstatus, listasActualizadas } from "./sat"
import type { FilaCfdi } from "./motor"

const DIA = 86_400_000
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))
const parsear = (d: any) => (typeof d === "string" ? JSON.parse(d) : d)

/** Baja las listas del SAT si tienen más de 7 días (o nunca se bajaron). */
export async function refrescarListas(knex: any, logger?: any, forzar = false) {
  const actuales = await listasActualizadas(knex)
  const vieja = (lista: string) => {
    const l = actuales.find((x) => x.lista === lista)
    return forzar || !l || Date.now() - new Date(l.fecha).getTime() > 7 * DIA
  }
  for (const lista of ["69B", "NO_LOCALIZADO"] as const) {
    if (!vieja(lista)) continue
    try {
      const n = await actualizarLista(knex, lista)
      logger?.info?.(`[conta] lista ${lista} actualizada: ${n} RFC`)
    } catch (e) {
      logger?.warn?.(`[conta] no se pudo actualizar la lista ${lista}: ${(e as Error).message}`)
    }
  }
}

/** Consulta en el SAT el estatus de los CFDI sin revisar en 30 días (de los últimos 2 años). */
export async function revisarEstatus(knex: any, contribuyenteId: string, max = 150) {
  const pendientes = (await knex(T_CFDI)
    .where({ contribuyente_id: contribuyenteId })
    .where("fecha", ">=", new Date(Date.now() - 730 * DIA))
    .where((q: any) => q.whereNull("estatus_revisado_en").orWhere("estatus_revisado_en", "<", new Date(Date.now() - 30 * DIA)))
    .where((q: any) => q.whereNull("estatus_sat").orWhereNot({ estatus_sat: "cancelado" }))
    .orderBy("fecha", "desc")
    .limit(max)
    .select("id", "datos")) as any[]
  let revisados = 0, cancelados = 0
  for (const f of pendientes) {
    const c = parsear(f.datos)
    const r = await consultarEstatus(c)
    if (r.estado === "error") continue // se reintenta en la próxima corrida
    await knex(T_CFDI).where({ id: f.id }).update({ estatus_sat: r.estado, estatus_revisado_en: knex.fn.now() })
    revisados++
    if (r.estado === "cancelado") cancelados++
    await pausa(400) // sin saturar el servicio del SAT
  }
  return { revisados, cancelados }
}

export async function filasParaAuditar(knex: any, contribuyenteId: string): Promise<FilaCfdi[]> {
  const filas = (await knex(T_CFDI)
    .where({ contribuyente_id: contribuyenteId })
    .where("fecha", ">=", new Date(Date.now() - 730 * DIA))
    .select("uuid", "direccion", "tipo", "categoria", "tipo_activo", "estatus_sat", "datos")) as any[]
  return filas.map((f) => ({ ...f, datos: parsear(f.datos) }))
}

/** Audita un contribuyente: estatus en el SAT (opcional), listas, reglas y hallazgos. */
export async function correrAuditoria(knex: any, ctb: any, opciones: { consultarSat?: boolean; logger?: any } = {}) {
  await asegurarConta(knex)
  const estatus = opciones.consultarSat ? await revisarEstatus(knex, ctb.id) : { revisados: 0, cancelados: 0 }
  const filas = await filasParaAuditar(knex, ctb.id)
  const rfcs = [...new Set(filas.map((f) => (f.direccion === "recibido" ? f.datos.emisor_rfc : f.datos.receptor_rfc)))]
  const listas = await buscarEnListas(knex, rfcs)
  const hallazgos = auditar(filas, { rfc: ctb.rfc, regimen: ctb.regimen, cp: ctb.cp, listas })
  const r = await guardarHallazgos(knex, ctb.id, hallazgos)
  return { ...r, estatus, revisadas: filas.length }
}

/** Semáforo antes de pagar: revisa un XML de proveedor sin guardarlo. */
export async function semaforo(knex: any, ctb: any, xml: string): Promise<{ color: "verde" | "amarillo" | "rojo"; hallazgos: Hallazgo[]; estatus: string; uuid: string; emisor: string; total: number }> {
  const c = leerCfdi(xml)
  const r = await consultarEstatus(c)
  const listas = await buscarEnListas(knex, [c.emisor_rfc])
  const direccion = c.emisor_rfc === ctb.rfc ? "emitido" : "recibido"
  const fila: FilaCfdi = {
    uuid: c.uuid, direccion, tipo: c.tipo, categoria: direccion === "recibido" ? "gasto" : "ingreso",
    estatus_sat: r.estado === "error" ? null : r.estado, datos: c,
  }
  const hallazgos = auditar([fila], { rfc: ctb.rfc, regimen: ctb.regimen, cp: ctb.cp, listas })
  const color = hallazgos.some((h) => h.severidad === "alta") ? "rojo" : hallazgos.some((h) => h.severidad === "media") || r.estado === "error" ? "amarillo" : "verde"
  return { color, hallazgos, estatus: r.estado === "error" ? `No se pudo consultar al SAT (${r.codigo})` : r.codigo || r.estado, uuid: c.uuid, emisor: `${c.emisor_nombre} (${c.emisor_rfc})`, total: c.total_mxn }
}

export async function contribuyentes(knex: any) {
  await asegurarConta(knex)
  return knex(T_CONTRIBUYENTE).select("*")
}
