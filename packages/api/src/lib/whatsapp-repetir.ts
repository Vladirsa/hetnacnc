// Asistente de compras por WhatsApp (estrategia 3.5, como el copiloto de
// compras de Geomiq o Accio): cuando una empresa o cliente escribe "necesito
// otras 200 como la del mes pasado", el agente encuentra sus pedidos
// anteriores y le manda la solicitud ya llena para que sólo confirme.
//
// Privacidad: sólo se usan pedidos cuyo teléfono o WhatsApp de contacto es el
// MISMO número que escribe (WhatsApp ya verificó que el número es suyo). La
// liga la pone el código, nunca la IA.
import { STORE_URL, T_PROPUESTA, T_SOLICITUD, folioTexto } from "./licitacion"

export type PedidoAnterior = { folio: string; token: string; conCuenta: boolean; resumen: string; fecha: string; taller: string | null }

const ultimos10 = (v: unknown) => String(v || "").replace(/\D/g, "").slice(-10)

/** Hasta 5 pedidos de fabricación anteriores de este número (más recientes primero). */
export async function pedidosDelNumero(knex: any, numero: string): Promise<PedidoAnterior[]> {
  const n10 = ultimos10(numero)
  if (n10.length !== 10) return []
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .leftJoin(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
    .leftJoin("seller as v", "v.id", "p.seller_id")
    .whereRaw(
      `(right(regexp_replace(coalesce(s.contacto->>'whatsapp',''), '\\D', '', 'g'), 10) = ? or right(regexp_replace(coalesce(s.contacto->>'telefono',''), '\\D', '', 'g'), 10) = ?)`,
      [n10, n10]
    )
    .orderBy("s.created_at", "desc")
    .limit(5)
    .select("s.folio", "s.token", "s.cliente_id", "s.trabajo", "s.created_at", "v.name as taller")
    .catch(() => [])) as any[]
  return filas.map((f) => {
    const t = f.trabajo || {}
    const resumen = [String(t.descripcion || "").split(/[.\n]/)[0].slice(0, 90), t.material, t.cantidad && `${t.cantidad}`, t.medidas]
      .filter(Boolean)
      .join(" · ")
    return {
      folio: folioTexto(f.folio),
      token: f.token,
      conCuenta: Boolean(f.cliente_id),
      resumen,
      fecha: new Date(f.created_at).toISOString().slice(0, 10),
      taller: f.taller || null,
    }
  })
}

/** Liga para repetir: con cuenta, Mis piezas (lleva sus archivos); sin cuenta, la solicitud prellenada. */
export function ligaRepetir(p: PedidoAnterior): string {
  return p.conCuenta ? `${STORE_URL}/mx/user/piezas/${encodeURIComponent(p.folio)}` : `${STORE_URL}/mx/cotizar?repite=${encodeURIComponent(p.token)}`
}

/** Bloque para el prompt del agente (sin tokens ni ligas: esos los pone el código). */
export function textoPedidos(pedidos: PedidoAnterior[]): string {
  if (!pedidos.length) return ""
  return (
    "\n\nPedidos anteriores de ESTE número (puedes mencionarlos; si pide repetir uno, pon su folio en repetir_folio):\n" +
    pedidos.map((p) => `- ${p.folio} (${p.fecha}): ${p.resumen}${p.taller ? ` · lo hizo ${p.taller}` : ""}`).join("\n")
  )
}
