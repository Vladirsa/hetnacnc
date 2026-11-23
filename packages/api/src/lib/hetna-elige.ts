// «Que HETNA elija por mí» (como Factorem o Laserhub): el cliente que no quiere
// comparar marca la casilla al pedir (con un presupuesto máximo opcional).
// Cuando hay propuestas suficientes, HETNA escoge la que mejor equilibra
// precio, plazo y cumplimiento del taller (lib/asignacion.recomendarPropuesta)
// y se la manda en un solo mensaje para confirmar con un clic.
//
// No elige a escondidas: elegir cierra la solicitud, avisa a los demás talleres
// y genera el cobro, así que el cliente confirma y paga desde su liga.
//
// Cuándo: 3+ propuestas → ya; 2 → a las 24 h de la primera; 1 → a 24 h del
// cierre. Siempre dentro del tope. Una sola vez por solicitud.
// HETNA_ELIGE=0 lo apaga.
import { recomendarPropuesta, type PropuestaParaRecomendar } from "./asignacion"
import { T_PROPUESTA, T_SOLICITUD, boton, esc, fila, folioTexto, ligaPropuestas, marco } from "./licitacion"
import { pushACliente } from "./push"
import { sendEmail } from "./resend"

const HORA = 3_600_000

export type Eleccion = { id: string; razones: string[]; unica: boolean }

/** Pura: ¿ya toca elegir y cuál? null = todavía no (o ninguna dentro del tope). */
export function decidirEleccion(
  props: (PropuestaParaRecomendar & { creada: Date | string })[],
  o: { tope?: number | null; ahora?: Date; cierra_en?: Date | string | null }
): Eleccion | null {
  const ahora = o.ahora || new Date()
  const enTope = props.filter((p) => p.precio > 0 && (!o.tope || p.precio <= o.tope))
  if (!enTope.length) return null
  const primera = Math.min(...props.map((p) => new Date(p.creada).getTime()))
  const horasDesdePrimera = (ahora.getTime() - primera) / HORA
  const horasParaCierre = o.cierra_en ? (new Date(o.cierra_en).getTime() - ahora.getTime()) / HORA : Infinity
  const toca = enTope.length >= 3 || (enTope.length >= 2 && horasDesdePrimera >= 24) || horasParaCierre <= 24
  if (!toca) return null
  if (enTope.length === 1) return { id: enTope[0].id, razones: ["Es la única propuesta dentro de tu presupuesto"], unica: true }
  const r = recomendarPropuesta(enTope)
  return r ? { id: r.id, razones: r.razones, unica: false } : null
}

let listo = false
export async function asegurarElige(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasColumn(T_SOLICITUD, "elige_enviado"))) {
    await knex.schema.alterTable(T_SOLICITUD, (t: any) => t.timestamp("elige_enviado", { useTz: true }).nullable())
  }
  // La que eligió HETNA y por qué: la página del cliente la marca como recomendada
  if (!(await knex.schema.hasColumn(T_SOLICITUD, "hetna_eleccion"))) {
    await knex.schema.alterTable(T_SOLICITUD, (t: any) => t.jsonb("hetna_eleccion").nullable())
  }
  listo = true
}

async function propuestasDe(knex: any, solicitudId: string) {
  const filas = (await knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where("p.solicitud_id", solicitudId)
    .select("p.id", "p.precio", "p.dias", "p.moneda", "p.incluye_envio", "p.created_at", "v.name as taller", "v.metadata")) as any[]
  return filas.map((p) => {
    const perfil = p.metadata?.perfil || {}
    return {
      id: p.id,
      precio: Number(p.precio),
      dias: p.dias,
      moneda: p.moneda || "MXN",
      incluye_envio: p.incluye_envio === "si",
      creada: p.created_at,
      nombre: p.taller as string,
      taller: {
        calificacion: perfil.calificacion ?? null,
        resenas: Number(perfil.resenas || 0),
        verificado: p.metadata?.verificado === true || p.metadata?.verificado === "true",
        medido: perfil.medido || null,
      },
    }
  })
}

export async function correrHetnaElige(knex: any, logger: any, ahora = new Date()) {
  if (process.env.HETNA_ELIGE === "0") return 0
  await asegurarElige(knex)
  const sols = (await knex(T_SOLICITUD)
    .where("estado", "abierta")
    .whereNull("elige_enviado")
    .whereRaw(`(trabajo->'hetna_elige') is not null and (trabajo->'hetna_elige') <> 'null'::jsonb`)
    .whereExists(knex(T_PROPUESTA).whereRaw(`${T_PROPUESTA}.solicitud_id = ${T_SOLICITUD}.id`).select(knex.raw("1")))
    .limit(30)
    .select("*")
    .catch(() => [])) as any[]
  let n = 0
  for (const s of sols) {
    try {
      const props = await propuestasDe(knex, s.id)
      const tope = Number(s.trabajo?.hetna_elige?.tope) || null
      const e = decidirEleccion(props, { tope, ahora, cierra_en: s.cierra_en })
      if (!e) continue
      const marcada = await knex(T_SOLICITUD).where({ id: s.id }).whereNull("elige_enviado").update({ elige_enviado: knex.fn.now(), hetna_eleccion: JSON.stringify({ id: e.id, razones: e.razones }) })
      if (!marcada) continue
      const p = props.find((x) => x.id === e.id)!
      const folio = folioTexto(s.folio)
      const liga = ligaPropuestas(s.token)
      const precio = `$${p.precio.toLocaleString("es-MX")} ${p.moneda}`
      await pushACliente(
        knex,
        { customerId: s.cliente_id, email: s.contacto?.email },
        { titulo: "HETNA eligió por ti ✓", cuerpo: `${folio}: ${p.nombre}, ${precio}, ${p.dias} días. Confírmala y paga para que empiece.`, url: liga, etiqueta: `sol-${s.id}` },
        logger
      )
      if (s.contacto?.email) {
        const r = await sendEmail({
          to: s.contacto.email,
          subject: `[${folio}] Elegimos el mejor taller para tu pieza`,
          html: marco(
            "Elegimos por ti",
            `<p style="margin:0 0 12px;color:#40403A">Pediste que HETNA eligiera. De ${props.length} ${props.length === 1 ? "propuesta" : "propuestas"}, ésta es la que mejor equilibra precio, plazo y cumplimiento del taller${tope ? `, dentro de tu presupuesto de $${tope.toLocaleString("es-MX")}` : ""}:</p>` +
              `<table style="border-collapse:collapse;font-size:14px">` +
              fila("Taller", p.nombre) +
              fila("Precio", precio) +
              fila("Entrega", `${p.dias} días`) +
              `</table>` +
              `<ul style="color:#40403A;line-height:1.6;padding-left:20px">${e.razones.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` +
              `<p style="margin:0 0 12px;color:#40403A">Abre tu liga: la verás marcada como <strong>Recomendada por HETNA</strong>. Tócala para elegirla y paga para que el taller empiece. Si prefieres otra, también puedes elegirla ahí.</p>` +
              boton("Ver y confirmar", liga)
          ),
        })
        if (!r.sent) logger?.info?.(`[hetna-elige] correo no enviado (${folio}): ${r.reason}`)
      }
      logger?.info?.(`[hetna-elige] ${folio}: recomendada ${p.id} (${props.length} propuestas)`)
      n++
    } catch (err) {
      logger?.warn?.(`[hetna-elige] ${s.id}: ${(err as Error).message}`)
    }
  }
  return n
}
