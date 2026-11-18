// "Invita a otro taller": cada taller tiene su liga (…/talleres/unete?ref=<handle>).
// Quien entra por ella y se registra queda ligado a quien lo invitó
// (seller.metadata.referido_por). Cuando al menos uno de sus invitados ya está
// aprobado y publicó algo, el que invitó recibe la insignia de Taller embajador
// (metadata.embajador = true) y sale primero en el directorio de talleres.
// Sin descuentos ni comisiones distintas (decidido por Vlado el 18 nov 2026).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

import { STORE_URL, VENDOR_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"

const DIA = 86_400_000
/** Un taller puede ligarse a quien lo invitó hasta 14 días después de registrarse. */
export const DIAS_PARA_LIGAR = 14
/** Invitados activos (aprobados y con producto) para ser embajador. */
export const INVITADOS_PARA_EMBAJADOR = 1

export const ligaInvitacion = (handle: string) => `${STORE_URL}/mx/talleres/unete?ref=${encodeURIComponent(handle)}`

/** Limpia el código de invitación que llega de la cookie o la URL. */
export const limpiarRef = (ref: unknown) =>
  String(ref || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80)

type Seller = { id: string; name?: string | null; handle?: string | null; email?: string | null; status?: string | null; created_at?: Date | string | null; metadata?: Record<string, unknown> | null }

/** ¿Se puede ligar este taller a quien lo invitó? Devuelve el motivo si no. */
export function motivoNoLigar(invitado: Seller, quienInvita: Seller | null, ahora = new Date()): string | null {
  if (!quienInvita) return "La liga de invitación no es válida."
  if (quienInvita.id === invitado.id) return "No puedes invitarte a ti mismo."
  if (invitado.metadata?.referido_por) return "Tu taller ya está ligado a una invitación."
  if (invitado.created_at && ahora.getTime() - new Date(invitado.created_at).getTime() > DIAS_PARA_LIGAR * DIA)
    return "La invitación sólo cuenta para talleres nuevos."
  return null
}

/** Liga el taller recién registrado con el taller que lo invitó (por handle). */
export async function ligarReferido(scope: { resolve: (k: string) => any }, sellerId: string, ref: unknown) {
  const handle = limpiarRef(ref)
  if (!handle) return { ok: false, motivo: "Falta el código de invitación." }
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const servicio = scope.resolve(MercurModules.SELLER) as any
  const invitado = (await servicio.retrieveSeller(sellerId)) as Seller
  const quien = ((await knex("seller").whereNull("deleted_at").where({ handle }).first("id", "name", "handle")) || null) as Seller | null
  const motivo = motivoNoLigar(invitado, quien)
  if (motivo) return { ok: false, motivo }
  await servicio.updateSellers({
    id: sellerId,
    metadata: { ...(invitado.metadata || {}), referido_por: quien!.id, referido_en: new Date().toISOString() },
  })
  return { ok: true, quien: quien!.name || quien!.handle }
}

/** Los talleres que invitó este taller, con su estado. */
export async function misInvitados(scope: { resolve: (k: string) => any }, sellerId: string) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filas = (await knex("seller")
    .whereNull("deleted_at")
    .whereRaw("metadata->>'referido_por' = ?", [sellerId])
    .select("id", "name", "status", "created_at")) as Seller[]
  let conProductos = new Set<string>()
  if (filas.length) {
    const { data } = await query.graph({ entity: "offer", fields: ["seller_id"], filters: { seller_id: filas.map((f) => f.id) } as any })
    conProductos = new Set(((data || []) as { seller_id?: string }[]).map((o) => String(o.seller_id)))
  }
  return filas.map((f) => ({
    nombre: f.name || "Taller",
    desde: f.created_at,
    activo: f.status === "open" && conProductos.has(f.id),
    estado: f.status === "open" ? (conProductos.has(f.id) ? "Ya vende" : "Aprobado, sin productos") : "Terminando su registro",
  }))
}

function correoEmbajador(t: Seller) {
  const p = (x: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.55">${x}</p>`
  return marco(
    "¡Ya son Taller embajador!",
    p(`Gracias, equipo de <strong>${esc(t.name || "su taller")}</strong>: un taller que invitaron ya está activo en HETNA CNC.`) +
      p("Desde hoy su perfil lleva la insignia de <b>Taller embajador</b> y sale entre los primeros del directorio de talleres. Sigan invitando talleres de confianza: entre más talleres haya, más clientes llegan a todos.") +
      boton("Ver a quién he invitado", `${VENDOR_URL}/tablero`)
  )
}

/** Da la insignia de embajador a quien ya tiene invitados activos. Corre en el job diario. */
export async function actualizarEmbajadores(container: MedusaContainer) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const servicio = container.resolve(MercurModules.SELLER) as any
  const invitados = (await knex("seller")
    .whereNull("deleted_at")
    .where({ status: "open" })
    .whereRaw("metadata->>'referido_por' is not null")
    .select("id", knex.raw("metadata->>'referido_por' as por"))) as { id: string; por: string }[]
  if (!invitados.length) return { nuevos: 0 }
  const { data } = await query.graph({ entity: "offer", fields: ["seller_id"], filters: { seller_id: invitados.map((i) => i.id) } as any })
  const conProductos = new Set(((data || []) as { seller_id?: string }[]).map((o) => String(o.seller_id)))
  const cuenta = new Map<string, number>()
  for (const i of invitados) if (conProductos.has(i.id)) cuenta.set(i.por, (cuenta.get(i.por) || 0) + 1)

  let nuevos = 0
  for (const [id, n] of cuenta) {
    if (n < INVITADOS_PARA_EMBAJADOR) continue
    const t = (await servicio.retrieveSeller(id).catch(() => null)) as Seller | null
    if (!t || t.metadata?.embajador === true) continue
    await servicio.updateSellers({ id, metadata: { ...(t.metadata || {}), embajador: true, embajador_desde: new Date().toISOString() } })
    nuevos++
    if (t.email) await sendEmail({ to: t.email, subject: "¡Ya son Taller embajador en HETNA CNC!", html: correoEmbajador(t) }).catch(() => undefined)
  }
  return { nuevos }
}
