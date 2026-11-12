// Problemas que el cliente reporta en un trabajo de fabricación ya elegido:
// cancelación, retraso, pieza defectuosa u otro. Política del 12 nov 2026
// (auditoría, problema 3 "confianza en cotizaciones"):
//
//   - Cancelación antes de que el taller reporte avance de fabricación:
//     reembolso total. Después, aplica el SafeDeal o lo que decida HETNA.
//     (No se usa la etapa "en_produccion": el pago la pone sola.)
//   - Retraso: si pasan DIAS_RETRASO_CANCELACION días de la fecha prometida sin
//     entrega, el cliente puede cancelar y HETNA le devuelve lo retenido.
//   - Defecto u otro problema: HETNA retiene el pago, pide evidencia a los dos
//     y decide en DIAS_HABILES_DECISION_DISPUTA días hábiles: liberar al
//     taller, reembolso parcial o total.
//
// Mientras haya una disputa abierta la solicitud no se cierra sola y no se
// libera nada al taller. Los reembolsos y las liberaciones los ejecuta HETNA
// a mano (no hay pagos automáticos al taller): esto registra, avisa y frena.
// Con cobro directo (s.cobro === "taller") HETNA no retiene nada: el taller
// hace el reembolso que HETNA decida.
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

/** ¿El taller ya empezó a fabricar? El pago pasa la solicitud a
 *  "en_produccion" en automático (lib/licitacion-cobro), así que eso no
 *  sirve: cuenta que el taller haya reportado un avance o movido la etapa. */
export async function tallerEmpezo(knex: any, s: any): Promise<boolean> {
  const ev = await knex(T_EVENTO).where({ solicitud_id: s.id, actor: "taller" }).first("id").catch(() => null)
  return Boolean(ev)
}

/** Lo que el cliente puede esperar según el tipo, si el taller ya empezó y
 *  quién cobró. Se guarda en el historial y se muestra en su liga. */
export function queSigue(
  tipo: TipoProblema,
  o: { empezo: boolean; cancelablePorRetraso: boolean; cobroTaller: boolean }
): string {
  // Con cobro directo el dinero ya está en la cuenta del taller: HETNA no lo
  // tiene, pero le exige el reembolso que decida (términos de vendedores, cl. 8).
  const devolucion = o.cobroTaller
    ? "el taller te devuelve lo que le pagaste (le pagaste directo a su cuenta; HETNA se lo exige y, si no cumple, se suspende su cuenta)"
    : "HETNA te devuelve lo que tenga retenido"
  const decide = `HETNA revisa la evidencia de los dos y decide en un máximo de ${DIAS_HABILES_DECISION_DISPUTA} días hábiles: ${
    o.cobroTaller ? "dar por bueno el trabajo" : "liberar el pago al taller"
  }, reembolso parcial o reembolso total.`
  if (tipo === "cancelar" && !o.empezo)
    return `El taller todavía no reporta avance de fabricación: confirmamos con él y ${devolucion}, al 100 %.`
  if (tipo === "cancelar")
    return `El taller ya reportó avance de fabricación. Aplica lo que diga su acuerdo SafeDeal; si no hay acuerdo, ${decide}`
  if (tipo === "retraso" && o.cancelablePorRetraso)
    return `Pasaron más de ${DIAS_RETRASO_CANCELACION} días de la fecha prometida: si lo confirmas, cancelamos y ${devolucion}.`
  if (tipo === "retraso")
    return `Le pedimos al taller una fecha nueva. Si pasan ${DIAS_RETRASO_CANCELACION} días de la fecha que prometió sin entrega, puedes cancelar y ${devolucion}.`
  return `${o.cobroTaller ? "" : "Retenemos el pago al taller mientras se resuelve. "}${decide}`
}

export const escaparHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
