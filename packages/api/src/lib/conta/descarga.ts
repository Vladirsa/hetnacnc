// Descarga masiva de CFDI del SAT (web service v1.5, con la e.firma del contribuyente).
//
// El SAT trabaja por solicitudes: se pide un periodo (emitidos o recibidos), el SAT
// prepara uno o varios paquetes ZIP (minutos u horas) y luego se descargan. Aquí:
//   - planDiario: una vez al día pide emitidos y recibidos de los últimos 3 días
//     (se traslapan a propósito; los repetidos no se duplican).
//   - pedirAnio: "traer todo el año", mes por mes.
//   - avanzar: revisa las solicitudes pendientes y descarga lo que ya esté listo.
// Los ZIP entran por cargarArchivos(), el mismo camino que la carga manual.
// No se repiten solicitudes idénticas (el SAT las rechaza: error 5002).
import { cargarArchivos } from "./almacen"
import { abrirEfirma, asegurarEfirma, T_EFIRMA } from "./efirma"
import { satws } from "./satws"

export const T_SOLICITUD_SAT = "hetna_conta_solicitud_sat"
const DIA = 86_400_000

let listo = false
export async function asegurarDescarga(knex: any) {
  if (listo) return
  await asegurarEfirma(knex)
  if (!(await knex.schema.hasTable(T_SOLICITUD_SAT))) {
    await knex.schema.createTable(T_SOLICITUD_SAT, (t: any) => {
      t.text("id").primary() // identificador de la solicitud que da el SAT
      t.text("contribuyente_id").notNullable().index()
      t.text("tipo").notNullable() // issued | received
      t.timestamp("desde", { useTz: false }).notNullable()
      t.timestamp("hasta", { useTz: false }).notNullable()
      t.text("origen").notNullable().defaultTo("diario") // diario | anio | manual
      t.text("estado").notNullable().defaultTo("enviada") // enviada | descargada | vacia | fallida
      t.text("mensaje").nullable()
      t.integer("paquetes").nullable()
      t.integer("nuevos").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ")

async function servicio(knex: any, contribuyenteId: string, motivo: string) {
  const fiel = await abrirEfirma(knex, contribuyenteId, motivo)
  if (!fiel) return null
  const m = await satws()
  return { m, svc: new m.Service(new m.FielRequestBuilder(fiel), new m.HttpsWebClient(), undefined, m.ServiceEndpoints.cfdi()) }
}

/** Pide al SAT un periodo. Devuelve el id de la solicitud o el motivo del rechazo. */
export async function solicitar(knex: any, ctb: { id: string }, tipo: "issued" | "received", desde: Date, hasta: Date, origen = "manual") {
  await asegurarDescarga(knex)
  // No repetir una solicitud igual que siga viva o ya descargada
  const igual = await knex(T_SOLICITUD_SAT).where({ contribuyente_id: ctb.id, tipo, desde: fmt(desde), hasta: fmt(hasta) }).whereNot({ estado: "fallida" }).first("id")
  if (igual) return { ok: true as const, id: igual.id, repetida: true }
  const s = await servicio(knex, ctb.id, `solicitud ${tipo} ${fmt(desde)} – ${fmt(hasta)}`)
  if (!s) return { ok: false as const, mensaje: "No hay e.firma vigente guardada." }
  const { m, svc } = s
  const params = m.QueryParameters.create(m.DateTimePeriod.createFromValues(fmt(desde), fmt(hasta)))
    .withDownloadType(new m.DownloadType(tipo))
    .withRequestType(new m.RequestType("xml"))
    .withDocumentStatus(new m.DocumentStatus("active"))
  const q = await svc.query(params)
  const st = q.getStatus()
  if (!st.isAccepted()) return { ok: false as const, mensaje: `El SAT rechazó la solicitud (${st.getCode()}): ${st.getMessage()}` }
  const id = q.getRequestId()
  await knex(T_SOLICITUD_SAT).insert({ id, contribuyente_id: ctb.id, tipo, desde: fmt(desde), hasta: fmt(hasta), origen })
  return { ok: true as const, id, repetida: false }
}

/** Revisa las solicitudes pendientes y descarga los paquetes listos. */
export async function avanzar(knex: any, ctb: { id: string; rfc: string }, logger?: any) {
  await asegurarDescarga(knex)
  const pendientes = (await knex(T_SOLICITUD_SAT).where({ contribuyente_id: ctb.id, estado: "enviada" }).orderBy("created_at").limit(20).select("*")) as any[]
  if (!pendientes.length) return { revisadas: 0, nuevos: 0 }
  const s = await servicio(knex, ctb.id, `revisar ${pendientes.length} solicitudes`)
  if (!s) return { revisadas: 0, nuevos: 0 }
  const { svc } = s
  let nuevos = 0
  for (const p of pendientes) {
    const marcar = (cambios: Record<string, unknown>) => knex(T_SOLICITUD_SAT).where({ id: p.id }).update({ ...cambios, updated_at: knex.fn.now() })
    try {
      const v = await svc.verify(p.id)
      const st = v.getStatus()
      if (!st.isAccepted()) {
        // 5004: no hay CFDI en el periodo
        if (String(st.getCode()) === "5004") await marcar({ estado: "vacia", mensaje: st.getMessage() })
        else await marcar({ mensaje: `Verificación: ${st.getCode()} ${st.getMessage()}` })
        continue
      }
      const r = v.getStatusRequest()
      if (r.isTypeOf("Expired") || r.isTypeOf("Failure") || r.isTypeOf("Rejected")) {
        await marcar({ estado: "fallida", mensaje: `El SAT no pudo completar la solicitud (${r.getValue?.() ?? "estado final"})` })
        continue
      }
      if (!r.isTypeOf("Finished")) continue // sigue en proceso
      const ids: string[] = v.getPackageIds()
      if (!ids.length) { await marcar({ estado: "vacia", paquetes: 0, nuevos: 0 }); continue }
      const zips: { nombre: string; datos: Buffer }[] = []
      for (const pid of ids) {
        const d = await svc.download(pid)
        if (!d.getStatus().isAccepted()) throw new Error(`paquete ${pid}: ${d.getStatus().getMessage()}`)
        zips.push({ nombre: `${pid}.zip`, datos: Buffer.from(d.getPackageContent(), "base64") })
      }
      const res = await cargarArchivos(knex, ctb, zips, "sat")
      nuevos += res.nuevos
      await marcar({ estado: "descargada", paquetes: ids.length, nuevos: res.nuevos, mensaje: res.errores.length ? res.errores.slice(0, 3).join("; ") : null })
    } catch (e) {
      logger?.warn?.(`[conta-sat] solicitud ${p.id}: ${(e as Error).message}`)
      await marcar({ mensaje: (e as Error).message.slice(0, 300) })
    }
  }
  return { revisadas: pendientes.length, nuevos }
}

/** Una vez al día: emitidos y recibidos de los últimos 3 días. */
export async function planDiario(knex: any, ctb: { id: string }, ahora = new Date()) {
  await asegurarDescarga(knex)
  const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
  const ya = await knex(T_SOLICITUD_SAT).where({ contribuyente_id: ctb.id, origen: "diario" }).where("created_at", ">=", hoy).first("id")
  if (ya) return []
  const desde = new Date(hoy.getTime() - 3 * DIA)
  const hasta = new Date(hoy.getTime() - 1000)
  const out: Awaited<ReturnType<typeof solicitar>>[] = []
  for (const tipo of ["issued", "received"] as const) out.push(await solicitar(knex, ctb, tipo, desde, hasta, "diario"))
  return out
}

/** "Traer todo el año": una solicitud por mes y tipo, hasta hoy. */
export async function pedirAnio(knex: any, ctb: { id: string }, anio: number, ahora = new Date()) {
  const out: { mes: number; tipo: string; ok: boolean; mensaje?: string }[] = []
  for (let mes = 0; mes < 12; mes++) {
    const desde = new Date(Date.UTC(anio, mes, 1))
    if (desde > ahora) break
    const finMes = new Date(Date.UTC(anio, mes + 1, 1) - 1000)
    const hasta = finMes > ahora ? new Date(ahora.getTime() - 60_000) : finMes
    for (const tipo of ["issued", "received"] as const) {
      const r = await solicitar(knex, ctb, tipo, desde, hasta, "anio")
      out.push({ mes: mes + 1, tipo, ok: r.ok, mensaje: r.ok ? undefined : r.mensaje })
      if (!r.ok) return out // si el SAT rechaza una, no seguir pidiendo
    }
  }
  return out
}

export async function solicitudesRecientes(knex: any, contribuyenteId: string) {
  await asegurarDescarga(knex)
  return knex(T_SOLICITUD_SAT).where({ contribuyente_id: contribuyenteId }).orderBy("created_at", "desc").limit(30)
    .select("id", "tipo", "desde", "hasta", "origen", "estado", "mensaje", "paquetes", "nuevos", "created_at", "updated_at")
}

export async function conEfirma(knex: any) {
  await asegurarDescarga(knex)
  return knex(T_EFIRMA).select("contribuyente_id")
}
