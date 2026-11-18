// Etapas de un trabajo ganado, como las ve el taller en /mx/panel-taller:
//
//   En corte → En producción → En acabado → Listo para entregar
//
// Van en su propia tabla (no se toca hetna_solicitud). Cada vez que el taller
// avanza, se marcan los hitos de producción que corresponden (los que ve el
// cliente en su liga, lib/licitacion-hitos.ts), queda anotado en el
// seguimiento y el cliente recibe aviso por correo y al celular. La entrega
// (paquetería y guía) sigue por /avance { tipo: "entregada" }.
import { pushACliente } from "./push"
import { sendEmail } from "./resend"
import { boton, esc, folioTexto, ligaPropuestas, marco } from "./licitacion"
import { actualizarHito, hitosDe } from "./licitacion-hitos"
import { anotar } from "./seguimiento"

export const T_ETAPA_TALLER = "hetna_etapa_taller"

export const ETAPAS_TALLER = ["en_corte", "en_produccion", "en_acabado", "listo"] as const
export type EtapaTaller = (typeof ETAPAS_TALLER)[number]

export const NOMBRE_ETAPA_TALLER: Record<EtapaTaller, string> = {
  en_corte: "En corte",
  en_produccion: "En producción",
  en_acabado: "En acabado",
  listo: "Listo para entregar",
}

// Hitos que quedan hechos al LLEGAR a cada etapa
const HITOS_AL_LLEGAR: Record<EtapaTaller, string[]> = {
  en_corte: [],
  en_produccion: ["archivo_aprobado", "corte"],
  en_acabado: [],
  listo: ["acabado", "inspeccion"],
}

let lista = false
export async function asegurarEtapaTaller(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_ETAPA_TALLER))) {
    await knex.schema.createTable(T_ETAPA_TALLER, (t: any) => {
      t.text("solicitud_id").primary()
      t.text("etapa").notNullable()
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

/** Etapa guardada de cada solicitud (las que no tienen fila van "En corte"). */
export async function etapasDe(knex: any, ids: string[]): Promise<Record<string, EtapaTaller>> {
  await asegurarEtapaTaller(knex)
  if (!ids.length) return {}
  const filas = (await knex(T_ETAPA_TALLER).whereIn("solicitud_id", ids).select("solicitud_id", "etapa")) as any[]
  const out: Record<string, EtapaTaller> = {}
  for (const f of filas) if ((ETAPAS_TALLER as readonly string[]).includes(f.etapa)) out[f.solicitud_id] = f.etapa
  return out
}

export function siguienteEtapa(actual: EtapaTaller): EtapaTaller | null {
  const i = ETAPAS_TALLER.indexOf(actual)
  return i >= 0 && i < ETAPAS_TALLER.length - 1 ? ETAPAS_TALLER[i + 1] : null
}

/**
 * Pasa el pedido a la siguiente etapa. `s` es la solicitud (ya validada como
 * pedido pagado de este taller, ver pedidoDelTaller).
 */
export async function avanzarEtapa(knex: any, s: any, inicio: any, logger?: any) {
  await asegurarEtapaTaller(knex)
  const fila = await knex(T_ETAPA_TALLER).where({ solicitud_id: s.id }).first()
  const actual: EtapaTaller = (ETAPAS_TALLER as readonly string[]).includes(fila?.etapa) ? fila.etapa : "en_corte"
  const nueva = siguienteEtapa(actual)
  if (!nueva) return { ok: false as const, status: 409, message: "Este trabajo ya está listo para entregar." }

  await knex(T_ETAPA_TALLER)
    .insert({ solicitud_id: s.id, etapa: nueva, updated_at: knex.fn.now() })
    .onConflict("solicitud_id")
    .merge()

  // Hitos que ve el cliente en su liga (si el pedido ya los tiene)
  try {
    await hitosDe(knex, s, inicio)
    for (const clave of HITOS_AL_LLEGAR[nueva]) {
      await actualizarHito(knex, s, clave, { hecho: true }).catch(() => null)
    }
  } catch (e: any) {
    logger?.info?.(`[etapa-taller] hitos no actualizados (${s.id}): ${e?.message || e}`)
  }

  const nombre = NOMBRE_ETAPA_TALLER[nueva]
  const folio = folioTexto(s.folio)
  await anotar(knex, s.id, "taller", `Tu pedido pasó a: ${nombre}.`).catch(() => null)
  await pushACliente(
    knex,
    { customerId: s.cliente_id, email: s.contacto?.email },
    { titulo: `Tu pedido: ${nombre}`, cuerpo: `${folio}: el taller avanzó tu pedido a "${nombre}".`, url: ligaPropuestas(s.token), etiqueta: `etapa-${s.id}` },
    logger
  ).catch(() => null)
  if (s.contacto?.email) {
    const m = await sendEmail({
      to: s.contacto.email,
      subject: `[${folio}] Tu pedido: ${nombre}`,
      html: marco(
        `Tu pedido va: ${esc(nombre)}`,
        `<p style="margin:0 0 12px;color:#40403A">El taller avanzó tu pedido a <b>${esc(nombre)}</b>.</p>` +
          boton("Ver mi pedido", ligaPropuestas(s.token))
      ),
    }).catch((e: any) => ({ sent: false, reason: e?.message }))
    if (!m.sent) logger?.info?.(`[etapa-taller] aviso no enviado (${folio}): ${m.reason}`)
  }
  return { ok: true as const, etapa: nueva, nombre }
}
