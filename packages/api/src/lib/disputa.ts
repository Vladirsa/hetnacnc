// Problemas que el cliente reporta en un trabajo de fabricación ya elegido:
// cancelación, retraso, pieza defectuosa u otro. Política del 12 nov 2026
// (auditoría, problema 3 "confianza en cotizaciones"):
//
//   - Cancelación antes de que el taller marque "en producción": reembolso
//     total de lo que HETNA tenga cobrado. Después, aplica el SafeDeal o lo que
//     decida HETNA.
//   - Retraso: si pasan DIAS_RETRASO_CANCELACION días de la fecha prometida sin
//     entrega, el cliente puede cancelar y HETNA le devuelve lo retenido.
//   - Defecto u otro problema: HETNA retiene el pago, pide evidencia a los dos
//     y decide en DIAS_HABILES_DECISION_DISPUTA días hábiles: liberar al
//     taller, reembolso parcial o total.
//
// Mientras haya una disputa abierta la solicitud no se cierra sola y no se
// libera nada al taller. Los reembolsos y las liberaciones los ejecuta HETNA
// a mano (no hay pagos automáticos al taller): esto registra, avisa y frena.
// Mantener en sincronía con apps/storefront/src/lib/hetna/promesas.ts.
import { T_EVENTO } from "./seguimiento"

export const DIAS_RETRASO_CANCELACION = 7
export const DIAS_HABILES_DECISION_DISPUTA = 5

export const TIPOS_PROBLEMA = ["cancelar", "retraso", "defecto", "otro"] as const
export type TipoProblema = (typeof TIPOS_PROBLEMA)[number]

export const NOMBRE_PROBLEMA: Record<TipoProblema, string> = {
  cancelar: "Quiere cancelar",
  retraso: "Retraso en la entrega",
  defecto: "Pieza defectuosa o distinta a lo acordado",
  otro: "Otro problema",
}

// Etapas en las que el cliente puede reportar: ya eligió taller y el proyecto
// no ha terminado.
export const ETAPAS_REPORTABLES = ["aceptada", "en_produccion", "entregada"] as const

/** Fecha que el taller prometió: la de su propuesta, o el día en que empezó a
 *  fabricar más los días que ofreció. null si todavía no empezó. */
export async function fechaPrometida(knex: any, s: any, p: any): Promise<Date | null> {
  if (p?.fecha_entrega) {
    const f = new Date(p.fecha_entrega)
    if (!isNaN(f.getTime())) return f
  }
  if (!p?.dias) return null
  const ev = await knex(T_EVENTO)
    .where({ solicitud_id: s.id, etapa: "en_produccion" })
    .orderBy("created_at", "asc")
    .first("created_at")
    .catch(() => null)
  const inicio = ev?.created_at || (s.etapa === "en_produccion" ? s.etapa_desde : null)
  if (!inicio) return null
  return new Date(new Date(inicio).getTime() + Number(p.dias) * 864e5)
}

/** ¿Ya puede cancelar por retraso? (fecha prometida + DIAS_RETRASO_CANCELACION) */
export const retrasoCancelable = (prometida: Date | null, ahora = Date.now()) =>
  Boolean(prometida && ahora >= prometida.getTime() + DIAS_RETRASO_CANCELACION * 864e5)

/** Lo que el cliente puede esperar según el tipo y la etapa. Se guarda en el
 *  historial y se muestra en su liga. */
export function queSigue(tipo: TipoProblema, etapa: string, cancelablePorRetraso: boolean): string {
  const decide = `HETNA revisa la evidencia de los dos y decide en un máximo de ${DIAS_HABILES_DECISION_DISPUTA} días hábiles: liberar el pago al taller, reembolso parcial o reembolso total.`
  if (tipo === "cancelar" && etapa === "aceptada")
    return "El taller todavía no empieza a fabricar: te devolvemos el 100 % de lo que le hayas pagado a HETNA. Te escribimos para confirmar el reembolso."
  if (tipo === "cancelar")
    return `El taller ya empezó a fabricar. Aplica lo que diga su acuerdo SafeDeal; si no hay acuerdo, ${decide}`
  if (tipo === "retraso" && cancelablePorRetraso)
    return `Pasaron más de ${DIAS_RETRASO_CANCELACION} días de la fecha prometida: si lo pides, cancelamos y te devolvemos lo que HETNA tenga retenido.`
  if (tipo === "retraso")
    return `Le pedimos al taller una fecha nueva. Si pasan ${DIAS_RETRASO_CANCELACION} días de la fecha que prometió sin entrega, puedes cancelar y te devolvemos lo que HETNA tenga retenido.`
  return `Retenemos el pago al taller mientras se resuelve. ${decide}`
}

export const escaparHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
