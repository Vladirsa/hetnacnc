// Correos automáticos del CAM Studio: llevan a quien usa el plan Gratis hacia
// un plan de pago en el momento en que más le sirve.
//
//   cam_bloqueo   quiso bajar algo que su plan no trae (torno, grabado en el
//                 torno, 4 y 5 ejes): es la señal más clara de que lo necesita.
//   cam_limite    se acabó sus 5 programas del mes.
//   cam_proyecto  guardó su primer proyecto hace 1 a 7 días.
//   cam_primera   bajó su primer programa hace 1 a 5 días: consejos y lo que sigue.
//
// Sólo le llegan a cuentas en plan Gratis. Comparten con el resto del
// marketing el registro de envíos (no se repite un correo), la lista de bajas
// y el tope diario. Además: un correo del CAM por persona cada 3 días.
// CAM_CORREOS=off los apaga.
import type { MedusaContainer } from "@medusajs/framework/types"

import { ligaBaja, T_BAJA } from "./baja"
import { mesActual } from "./cotizador-plan"
import { PLANES_COTIZADOR } from "./cotizador-suscripciones"
import { planDelCliente } from "./descargas-gratis"
import { boton, esc, marco, STORE_URL } from "./licitacion"
import { asegurarTablaPromo, T_PROMO } from "./marketing-correos"
import { sendEmail } from "./resend"

export const T_INTENTO = "hetna_cam_intento"
const T_USO = "hetna_cam_uso"
const T_PROYECTO = "hetna_cam_proyecto"
export const TIPOS_CORREO_CAM = ["cam_bloqueo", "cam_limite", "cam_proyecto", "cam_primera"] as const
export type TipoCorreoCam = (typeof TIPOS_CORREO_CAM)[number]
const DIAS_ENTRE_CORREOS = 3
const maxDia = () => Math.max(0, Number(process.env.MARKETING_MAX_DIA) || 80)
export const correosCamApagados = () => (process.env.CAM_CORREOS || "").toLowerCase() === "off"

let listo = false
async function asegurarTablaIntento(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_INTENTO))) {
    await knex.schema.createTable(T_INTENTO, (t: any) => {
      t.bigIncrements("id").primary()
      t.text("customer_id").notNullable().index()
      t.text("tipo").notNullable()
      // "plan" = su plan no lo incluye; "cupo" = se acabó los del mes
      t.text("codigo").notNullable()
      t.text("plan_necesario").notNullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

/** Anota que alguien quiso bajar un programa y su plan no lo dejó. Uno por tipo al día. Nunca lanza. */
export async function anotarIntentoCam(knex: any, customerId: string, tipo: string, codigo: "plan" | "cupo", planNecesario: string) {
  try {
    await asegurarTablaIntento(knex)
    const hoy = new Date()
    hoy.setUTCHours(0, 0, 0, 0)
    const ya = await knex(T_INTENTO).where({ customer_id: customerId, tipo, codigo }).where("created_at", ">=", hoy).first("id")
    if (!ya) await knex(T_INTENTO).insert({ customer_id: customerId, tipo, codigo, plan_necesario: planNecesario })
  } catch {
    // el registro es para marketing: si falla, la descarga responde igual
  }
}

// ---------------------------------------------------------------------------
// Los correos
// ---------------------------------------------------------------------------
const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${t}</p>`
const lista = (items: string[]) => `<ul style="margin:0 0 12px;padding-left:20px;color:#40403A;line-height:1.6">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`
const hola = (nombre?: string | null) => (nombre ? `Hola, ${esc(nombre)}:` : "Hola:")
const liga = (tipo: TipoCorreoCam, ruta = "/mx/servicios/cotizador-cnc", ancla = "#planes") =>
  `${STORE_URL}${ruta}?utm_source=correo&utm_medium=automatico&utm_campaign=${tipo}${ancla}`
const precio = (plan: "taller" | "pro" | "industrial") => `$${PLANES_COTIZADOR[plan].precio.toLocaleString("es-MX")} al mes`

const QUE_ES: Record<string, { que: string; plan: "taller" | "pro" | "industrial"; trae: string[] }> = {
  torno: {
    que: "un programa de torno CNC",
    plan: "taller",
    trae: ["<b>Torno CNC</b>: 30 programas al mes para balaustres, patas y columnas", "<b>CAM 2D y 3D sin límite</b> (en Gratis son 5 al mes)", "Hasta 100 proyectos guardados en tu cuenta"],
  },
  torno_grabado: {
    que: "un grabado sobre la pieza torneada",
    plan: "pro",
    trae: ["<b>Grabado 2D y relieve 3D en el torno</b>: tu logo o un tallado sobre el balaustre", "<b>Torno CNC sin límite</b>", "CAM 2D y 3D sin límite y hasta 300 proyectos guardados"],
  },
  multieje: {
    que: "un programa de 4 o 5 ejes",
    plan: "industrial",
    trae: ["<b>4 y 5 ejes</b>: rotativo, indexado por caras y 5 ejes simultáneos", "21 controladores: Mach3, GRBL, LinuxCNC, Fanuc, Haas, Siemens, DSP y más", "Todo el CAM Studio sin límite y hasta 1,000 proyectos guardados"],
  },
}

export function correoCam(tipo: TipoCorreoCam, d: { nombre?: string | null; que?: string | null }): { asunto: string; html: string } {
  switch (tipo) {
    case "cam_bloqueo": {
      const q = QUE_ES[d.que || ""] || QUE_ES.torno
      const plan = PLANES_COTIZADOR[q.plan].nombre
      return {
        asunto: `Tu programa quedó listo: te falta el plan ${plan} para bajarlo`,
        html: marco(
          `Lo que armaste se desbloquea con el plan ${plan}`,
          p(`${hola(d.nombre)} en el CAM Studio preparaste ${q.que} y tu plan Gratis no lo incluye. Con el plan <b>${plan}</b> (${precio(q.plan)}) lo bajas hoy mismo:`) +
            lista(q.trae) +
            p(q.plan === "taller" ? "Si es la primera vez que lo activas, tienes <b>14 días de prueba sin costo</b> y cancelas cuando quieras." : "Se paga por mes y cancelas cuando quieras.") +
            boton(`Ver el plan ${plan}`, liga(tipo))
        ),
      }
    }
    case "cam_limite":
      return {
        asunto: "Ya usaste tus 5 programas gratis de este mes",
        html: marco(
          "Se acabaron tus 5 programas del mes",
          p(`${hola(d.nombre)} este mes ya bajaste los 5 programas que trae el plan Gratis del CAM Studio. El día 1 se renuevan; si no quieres esperar, con el plan <b>Taller</b> (${precio("taller")}) sigues hoy:`) +
            lista(["<b>CAM 2D y 3D sin límite</b>", "<b>Torno CNC</b>: 30 programas al mes", "Hasta 100 proyectos guardados para retomarlos o compartirlos con una liga"]) +
            p("Si es la primera vez que lo activas, tienes <b>14 días de prueba sin costo</b>.") +
            boton("Seguir sin límite", liga(tipo))
        ),
      }
    case "cam_proyecto":
      return {
        asunto: "Tu proyecto quedó guardado en HETNA",
        html: marco(
          "Tu proyecto está en tu cuenta",
          p(`${hola(d.nombre)} guardaste tu primer proyecto en el CAM Studio. Lo puedes abrir desde cualquier equipo y pasarlo a un compañero o a tu cliente con una liga: quien la abre recibe su propia copia.`) +
            p("El plan Gratis guarda hasta 5 proyectos y entrega 5 programas al mes. Cuando el taller te pida más:") +
            lista([`<b>Taller</b> (${precio("taller")}): 2D y 3D sin límite, torno CNC y 100 proyectos`, `<b>Pro</b> (${precio("pro")}): torno sin límite con grabado y relieve`, `<b>Industrial</b> (${precio("industrial")}): 4 y 5 ejes`]) +
            boton("Abrir mis proyectos", liga(tipo, "/mx/cam/subir", ""))
        ),
      }
    case "cam_primera":
      return {
        asunto: "¿Cómo te fue con tu primer programa?",
        html: marco(
          "Tu primer programa del CAM Studio",
          p(`${hola(d.nombre)} ya bajaste tu primer programa. Tres cosas para que salga bien a la primera:`) +
            `<ol style="margin:0 0 12px;padding-left:20px;color:#40403A;line-height:1.6">` +
            `<li><b>Córrelo primero en vacío</b>, arriba del material y con el avance reducido.</li>` +
            `<li><b>Revisa el cero de pieza</b>: el programa dice en su encabezado dónde lo espera.</li>` +
            `<li><b>Cuéntanos cómo salió</b> con el botón "Probé este programa": tu reporte le sirve al siguiente taller que usa tu mismo control.</li>` +
            `</ol>` +
            p("En tu plan Gratis te quedan programas este mes. También tienes el laboratorio 3D, el torno CNC y la calculadora de avances, que siempre es gratis.") +
            boton("Volver al CAM Studio", liga(tipo, "/mx/cam/subir", ""))
        ),
      }
  }
}

// ---------------------------------------------------------------------------
// A quién le toca
// ---------------------------------------------------------------------------
export type CandidatoCam = { tipo: TipoCorreoCam; customer_id: string; ref: string; que?: string }
const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000)
const existe = async (knex: any, tabla: string) => !!(await knex.schema.hasTable(tabla))

/** Candidatos por señal, del más urgente al menos. Todavía sin revisar plan, bajas ni envíos previos. */
export async function candidatosCam(knex: any): Promise<CandidatoCam[]> {
  const out: CandidatoCam[] = []
  const mes = mesActual()
  if (await existe(knex, T_INTENTO)) {
    const filas = await knex(T_INTENTO).where("created_at", ">=", hace(3)).orderBy("created_at", "desc").select("customer_id", "tipo", "codigo")
    const visto = new Set<string>()
    for (const f of filas) {
      if (f.codigo !== "plan" || visto.has(f.customer_id)) continue
      visto.add(f.customer_id)
      out.push({ tipo: "cam_bloqueo", customer_id: f.customer_id, ref: `${f.customer_id}:${f.tipo}:${mes}`, que: f.tipo })
    }
    for (const f of filas) if (f.codigo === "cupo") out.push({ tipo: "cam_limite", customer_id: f.customer_id, ref: `${f.customer_id}:${mes}` })
  }
  if (await existe(knex, T_USO)) {
    const llenos = await knex(T_USO).where({ mes }).whereIn("tipo", ["2d", "3d"]).groupBy("customer_id").havingRaw("count(*) >= 5").select("customer_id")
    for (const f of llenos) out.push({ tipo: "cam_limite", customer_id: f.customer_id, ref: `${f.customer_id}:${mes}` })
  }
  if (await existe(knex, T_PROYECTO)) {
    const filas = await knex(T_PROYECTO).groupBy("customer_id").havingRaw("min(created_at) between ? and ?", [hace(7), hace(1)]).select("customer_id")
    for (const f of filas) out.push({ tipo: "cam_proyecto", customer_id: f.customer_id, ref: f.customer_id })
  }
  if (await existe(knex, T_USO)) {
    const filas = await knex(T_USO).groupBy("customer_id").havingRaw("min(created_at) between ? and ?", [hace(5), hace(1)]).select("customer_id")
    for (const f of filas) out.push({ tipo: "cam_primera", customer_id: f.customer_id, ref: f.customer_id })
  }
  // un candidato por tipo y persona
  const llaves = new Set<string>()
  return out.filter((c) => (llaves.has(`${c.tipo}:${c.ref}`) ? false : (llaves.add(`${c.tipo}:${c.ref}`), true)))
}

export type ResumenCam = Record<TipoCorreoCam, number> & { presupuesto: number; omitidos: number; detalle: string[] }

export async function correrCorreosCam(container: MedusaContainer, knex: any, logger: any, o: { simular?: boolean } = {}): Promise<ResumenCam> {
  const r: ResumenCam = { cam_bloqueo: 0, cam_limite: 0, cam_proyecto: 0, cam_primera: 0, presupuesto: 0, omitidos: 0, detalle: [] }
  await asegurarTablaPromo(knex)
  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const [{ n }] = (await knex(T_PROMO).where("created_at", ">=", hoy).count("* as n")) as any
  let presupuesto = maxDia() - Number(n)
  r.presupuesto = presupuesto
  if (presupuesto <= 0) return r

  const cands = await candidatosCam(knex)
  if (!cands.length) return r
  const ids = [...new Set(cands.map((c) => c.customer_id))]
  const clientes: { id: string; email: string | null; first_name: string | null }[] = await knex("customer").whereIn("id", ids).whereNull("deleted_at").select("id", "email", "first_name")
  const porId = new Map(clientes.map((c) => [c.id, c]))
  const planes = new Map<string, string>()
  const tocados = new Set<string>()
  const hayBajas = await existe(knex, T_BAJA)

  for (const c of cands) {
    if (presupuesto <= 0) break
    const cli = porId.get(c.customer_id)
    const correo = (cli?.email || "").trim().toLowerCase()
    if (!correo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) continue
    if (tocados.has(correo)) {
      r.omitidos++
      continue
    }
    // sólo plan Gratis: quien ya paga o está en su prueba no recibe estos correos
    if (!planes.has(c.customer_id)) planes.set(c.customer_id, await planDelCliente(container, c.customer_id).catch(() => "desconocido"))
    if (planes.get(c.customer_id) !== "gratis") continue
    if (await knex(T_PROMO).where({ tipo: c.tipo, ref: c.ref, correo }).first()) continue
    if (hayBajas && (await knex(T_BAJA).where({ correo }).first())) continue
    // a lo más un correo del CAM por persona cada 3 días
    if (await knex(T_PROMO).where({ correo }).whereIn("tipo", TIPOS_CORREO_CAM).where("created_at", ">=", hace(DIAS_ENTRE_CORREOS)).first()) {
      r.omitidos++
      continue
    }

    const { asunto, html } = correoCam(c.tipo, { nombre: cli?.first_name, que: c.que })
    tocados.add(correo)
    if (o.simular) {
      r[c.tipo]++
      r.detalle.push(`${c.tipo}${c.que ? ` (${c.que})` : ""} → ${correo}`)
      presupuesto--
      continue
    }
    const env = await sendEmail({ to: correo, subject: asunto, html, bajaUrl: ligaBaja(correo) })
    if (!env.sent) {
      logger.warn(`[cam-correos] ${c.tipo} a ${correo} no enviado: ${env.reason}`)
      if (env.configuracion) break
      continue
    }
    await knex(T_PROMO).insert({ correo, tipo: c.tipo, ref: c.ref }).onConflict(["tipo", "ref", "correo"]).ignore()
    r[c.tipo]++
    presupuesto--
  }
  return r
}
