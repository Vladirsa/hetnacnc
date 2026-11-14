// Pedido del taller ganador (ya pagado) y sus hitos con ligas firmadas a las fotos.
// Lo usan las rutas del panel del taller (hitos y fotos).
import { getSignedDownloadUrls } from "./backblaze"
import { T_PROPUESTA, T_SOLICITUD } from "./licitacion"
import { asegurarSeguimiento, T_EVENTO } from "./seguimiento"
import { hitosDe, vistaHitos } from "./licitacion-hitos"

/** El pedido del taller ganador, ya pagado; si no, la respuesta de error */
type Pedido = { ok: false; error: readonly [number, string] } | { ok: true; s: any; inicio: any }
export async function pedidoDelTaller(knex: any, id: string, sellerId: string): Promise<Pedido> {
  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ id }).first()
  if (!s) return { ok: false, error: [404, "Solicitud no encontrada."] }
  const p = s.propuesta_elegida ? await knex(T_PROPUESTA).where({ id: s.propuesta_elegida }).first("seller_id") : null
  if (!p || p.seller_id !== sellerId) return { ok: false, error: [403, "Este pedido no es tuyo."] }
  if (s.estado !== "pagada" && s.pago_estado !== "pagado" && !["en_produccion", "entregada", "cerrada"].includes(String(s.etapa || ""))) {
    return { ok: false, error: [409, "El cliente todavía no paga. Los hitos empiezan con el pago."] }
  }
  const ev = await knex(T_EVENTO).where({ solicitud_id: s.id, etapa: "en_produccion" }).min({ inicio: "created_at" }).first().catch(() => null)
  return { ok: true, s, inicio: ev?.inicio || null }
}

/** Hitos con las ligas firmadas (1 hora) de sus fotos */
export async function hitosConFotos(knex: any, s: any, inicio: any) {
  const vista = vistaHitos(await hitosDe(knex, s, inicio))
  const claves = vista.flatMap((h) => h.fotos.map((f) => f.clave))
  const ligas = claves.length ? await getSignedDownloadUrls(claves, 3600).catch(() => new Map<string, string>()) : new Map<string, string>()
  return vista.map((h) => ({ ...h, fotos: h.fotos.map((f) => ({ clave: f.clave, nombre: f.nombre, url: ligas.get(f.clave) || null })) }))
}

