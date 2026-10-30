// Ventas del Cotizador HETNA (app Flutter + Supabase): los talleres
// registrados, en qué plan está cada uno, y los correos automáticos que los
// llevan de la prueba gratis a un plan de pago.
//
// Lee la base de Supabase del Cotizador con la llave de servicio (la misma de
// lib/cotizador-suscripciones.ts). No escribe nada en esa base.
//
// Correos (job cotizador-correos, una vez al día):
//   cot_bienvenida   taller registrado en los últimos 3 días: cómo sacarle
//                    provecho a la prueba de 14 días.
//   cot_prueba_4     a su prueba le quedan entre 3 y 5 días: lo que pierde al
//                    pasar a Gratis y cuánto cuesta el plan Taller.
//   cot_prueba_fin   su prueba terminó hace 0 a 3 días y no contrató.
//   cot_limite       plan Gratis y ya usó sus 5 cotizaciones del mes.
//
// Cada correo se manda una sola vez por su referencia (el taller, la fecha de
// fin de su prueba o el mes) y queda en hetna_correo_promo, la misma tabla
// del marketing de la tienda: así comparten el tope diario de Resend
// (MARKETING_MAX_DIA) y la lista de bajas. COTIZADOR_CORREOS=off los apaga.
import { ligaBaja, T_BAJA } from "./baja"
import { PLANES_COTIZADOR, supabaseListo } from "./cotizador-suscripciones"
import { STORE_URL, boton, esc, marco } from "./licitacion"
import { asegurarTablaPromo, T_PROMO } from "./marketing-correos"
import { sendEmail } from "./resend"

// Mismo tope diario que el marketing de la tienda (lib/marketing-correos.ts)
const maxDia = () => Math.max(0, Number(process.env.MARKETING_MAX_DIA) || 80)

// Supabase del Cotizador con la llave de servicio (igual que en
// lib/cotizador-suscripciones.ts, que no la exporta)
const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""
export async function supa<T = any>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${supaUrl()}${ruta}`, {
    ...init,
    headers: {
      apikey: supaKey(),
      Authorization: `Bearer ${supaKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  })
  const texto = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${texto.slice(0, 300)}`)
  return (texto ? JSON.parse(texto) : null) as T
}

export const correosCotizadorApagados = () => (process.env.COTIZADOR_CORREOS || "").toLowerCase() === "off"

// Igual que lib/services/planes.dart de la app
export const LIMITE_GRATIS = 5
const APP = `${STORE_URL}/cotizador/`

export type Taller = {
  id: string
  nombre: string | null
  correo: string | null
  telefono: string | null
  plan: string | null
  plan_estado: string | null
  plan_renueva: string | null
  plan_vence: string | null
  pago_proveedor: string | null
  trial_hasta: string | null
  created_at: string | null
}

// "Plan que manda" -- la misma regla que Planes.efectivo en la app
export type PlanEfectivo = "gratis" | "prueba" | "taller" | "pro" | "industrial" | "master"
export function planEfectivo(t: Taller, ahora = Date.now()): PlanEfectivo {
  switch (t.plan) {
    case "master":
      return "master"
    case "industrial":
      return "industrial"
    case "pro":
    case "premium":
      return "pro"
    case "taller":
      return "taller"
    case "trial":
    case "prueba":
      return t.trial_hasta && new Date(t.trial_hasta).getTime() > ahora ? "prueba" : "gratis"
    default:
      return "gratis"
  }
}

/** Paga de verdad: suscripción activa con Mercado Pago o PayPal (no fundadores ni cortesías). */
export const pagaSuscripcion = (t: Taller) =>
  ["taller", "pro", "industrial"].includes(String(t.plan)) &&
  t.plan_estado === "activa" &&
  ["mercadopago", "paypal"].includes(String(t.pago_proveedor))

const BASE = "id,nombre,correo,telefono,plan,plan_estado,plan_renueva,plan_vence,pago_proveedor,trial_hasta"

/** Todos los talleres. Si la tabla no tiene created_at, se sigue sin esa fecha. */
export async function leerTalleres(): Promise<Taller[]> {
  try {
    return await supa<Taller[]>(`/rest/v1/negocios?select=${BASE},created_at&order=created_at.desc&limit=5000`)
  } catch (e) {
    if (!/created_at/.test((e as Error).message)) throw e
    const filas = await supa<Taller[]>(`/rest/v1/negocios?select=${BASE}&limit=5000`)
    return filas.map((f) => ({ ...f, created_at: null }))
  }
}

export const inicioDeMes = (f = new Date()) => new Date(f.getFullYear(), f.getMonth(), 1)

/** Cotizaciones creadas este mes, por taller. */
export async function cotizacionesDelMes(): Promise<Map<string, number>> {
  const desde = encodeURIComponent(inicioDeMes().toISOString())
  const filas = await supa<{ negocio_id: string | null }[]>(
    `/rest/v1/cotizaciones?select=negocio_id&created_at=gte.${desde}&limit=50000`
  )
  const m = new Map<string, number>()
  for (const f of filas) if (f.negocio_id) m.set(f.negocio_id, (m.get(f.negocio_id) || 0) + 1)
  return m
}

const DIA = 86_400_000
const diasHasta = (iso: string | null, ahora = Date.now()) => (iso ? (new Date(iso).getTime() - ahora) / DIA : null)

/** Fecha aproximada de registro: created_at, o la fecha de fin de prueba menos 14 días. */
export function registrado(t: Taller): Date | null {
  if (t.created_at) return new Date(t.created_at)
  if (t.trial_hasta && ["trial", "prueba"].includes(String(t.plan))) return new Date(new Date(t.trial_hasta).getTime() - 14 * DIA)
  return null
}

// ── Panel de ventas ───────────────────────────────────────────────────────
export type FilaPanel = {
  id: string
  nombre: string
  correo: string
  telefono: string
  plan: PlanEfectivo
  paga: boolean
  proveedor: string | null
  registrado: string | null
  prueba_dias: number | null
  renueva: string | null
  vence: string | null
  cotizaciones_mes: number
}

export async function panelVentas() {
  const ahora = Date.now()
  const [talleres, cots] = await Promise.all([leerTalleres(), cotizacionesDelMes()])
  const filas: FilaPanel[] = talleres
    .filter((t) => t.plan !== "master")
    .map((t) => {
      const plan = planEfectivo(t, ahora)
      const reg = registrado(t)
      const d = plan === "prueba" ? diasHasta(t.trial_hasta, ahora) : null
      return {
        id: t.id,
        nombre: t.nombre || "(sin nombre)",
        correo: t.correo || "",
        telefono: t.telefono || "",
        plan,
        paga: pagaSuscripcion(t),
        proveedor: t.pago_proveedor,
        registrado: reg ? reg.toISOString() : null,
        prueba_dias: d === null ? null : Math.max(0, Math.ceil(d)),
        renueva: t.plan_renueva,
        vence: t.plan_vence,
        cotizaciones_mes: cots.get(t.id) || 0,
      }
    })

  const cuenta = (f: (x: FilaPanel) => boolean) => filas.filter(f).length
  const haceDias = (n: number) => (x: FilaPanel) => !!x.registrado && new Date(x.registrado).getTime() >= ahora - n * DIA
  const pagan = filas.filter((x) => x.paga)
  let mxn = 0
  let usd = 0
  for (const x of pagan) {
    const p = PLANES_COTIZADOR[x.plan as keyof typeof PLANES_COTIZADOR]
    if (!p) continue
    if (x.proveedor === "paypal") usd += p.precioUsd
    else mxn += p.precio
  }

  return {
    resumen: {
      talleres: filas.length,
      nuevos_7: cuenta(haceDias(7)),
      nuevos_30: cuenta(haceDias(30)),
      en_prueba: cuenta((x) => x.plan === "prueba"),
      gratis: cuenta((x) => x.plan === "gratis"),
      pagan: pagan.length,
      pagan_por_plan: {
        taller: pagan.filter((x) => x.plan === "taller").length,
        pro: pagan.filter((x) => x.plan === "pro").length,
        industrial: pagan.filter((x) => x.plan === "industrial").length,
      },
      // Planes de pago sin suscripción (fundadores, cortesías, pago a mano)
      cortesia: cuenta((x) => ["taller", "pro", "industrial"].includes(x.plan) && !x.paga),
      ingreso_mensual_mxn: mxn,
      ingreso_mensual_usd: usd,
      gratis_en_limite: cuenta((x) => x.plan === "gratis" && x.cotizaciones_mes >= LIMITE_GRATIS),
    },
    // A quién hablarle esta semana: pruebas que se acaban, suscripciones
    // canceladas que se terminan, y Gratis que ya topó su límite.
    por_vencer: filas
      .filter(
        (x) =>
          (x.plan === "prueba" && (x.prueba_dias ?? 99) <= 7) ||
          (!!x.vence && (diasHasta(x.vence, ahora) ?? 99) <= 7 && (diasHasta(x.vence, ahora) ?? -1) >= 0) ||
          (x.plan === "gratis" && x.cotizaciones_mes >= LIMITE_GRATIS)
      )
      .sort((a, b) => (a.prueba_dias ?? 99) - (b.prueba_dias ?? 99)),
    talleres: filas,
  }
}

// ── Correos ───────────────────────────────────────────────────────────────────────────
export type TipoCorreoCot = "cot_bienvenida" | "cot_prueba_4" | "cot_prueba_fin" | "cot_limite"
export const TIPOS_CORREO_COT: TipoCorreoCot[] = ["cot_bienvenida", "cot_prueba_4", "cot_prueba_fin", "cot_limite"]

const utm = (tipo: TipoCorreoCot, extra = "") =>
  `${APP}?${extra ? `${extra}&` : ""}utm_source=email&utm_medium=automatico&utm_campaign=${tipo}`
const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${t}</p>`
const lista = (items: string[]) =>
  `<ul style="margin:0 0 12px;padding-left:20px;color:#40403A;line-height:1.6">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`
const hola = (nombre?: string | null) => (nombre ? `Hola, equipo de ${esc(nombre)}:` : "Hola:")

const TALLER = () => PLANES_COTIZADOR.taller.precio
const LO_DEL_TALLER = () => [
  "<b>Cotizaciones ilimitadas</b> (en Gratis son 5 al mes)",
  "<b>PDF con tu logo, sin marca de agua</b>",
  "<b>Sube DXF, SVG, STL u OBJ</b> y la cotización lleva el plano con medidas",
  "<b>Simulador de costos</b> con 3 precios y el anticipo a tu medida",
  "Costos de tu taller, gastos y 2 usuarios",
]

export function correoCotizador(
  tipo: TipoCorreoCot,
  d: { nombre?: string | null; dias?: number; usadas?: number }
): { asunto: string; html: string } {
  const precio = `$${TALLER()}`
  switch (tipo) {
    case "cot_bienvenida":
      return {
        asunto: "Tu taller ya está en HETNA: 14 días con todo abierto",
        html: marco(
          "Bienvenido al Cotizador HETNA",
          p(`${hola(d.nombre)} tu taller ya tiene <b>14 días de prueba con todo abierto</b>. Para que en la primera semana ya estés cobrando mejor:`) +
            `<ol style="margin:0 0 12px;padding-left:20px;color:#40403A;line-height:1.6">` +
            `<li><b>Captura tus costos</b> (Más → Costos del taller): renta, luz, sueldos y tus máquinas. Con eso el simulador te dice el precio mínimo y el recomendado.</li>` +
            `<li><b>Haz una cotización profesional</b> subiendo el DXF, STL u OBJ de la pieza: sale el plano con medidas y los datos técnicos.</li>` +
            `<li><b>Mándala por WhatsApp</b> con un toque y da seguimiento al anticipo y a los avances.</li>` +
            `</ol>` +
            p("¿Dudas? Responde este correo o escríbenos por WhatsApp; te ayudamos a dejarlo listo.") +
            boton("Abrir el Cotizador", utm(tipo))
        ),
      }
    case "cot_prueba_4": {
      const n = Math.max(1, Math.round(d.dias ?? 4))
      return {
        asunto: `Te ${n === 1 ? "queda 1 día" : `quedan ${n} días`} de prueba del Cotizador`,
        html: marco(
          `Te ${n === 1 ? "queda 1 día" : `quedan ${n} días`} con todo abierto`,
          p(`${hola(d.nombre)} tu prueba del Cotizador termina pronto. Después tu taller pasa al plan Gratis y deja de tener:`) +
            lista(LO_DEL_TALLER()) +
            p(`El plan <b>Taller</b> cuesta <b>${precio} al mes</b>: menos de lo que ganas en una sola pieza bien cotizada. Lo contratas en la app con tarjeta, OXXO o PayPal y lo cancelas cuando quieras.`) +
            boton("Elegir mi plan", utm(tipo, "planes=1"))
        ),
      }
    }
    case "cot_prueba_fin":
      return {
        asunto: "Terminó tu prueba: tu taller pasó al plan Gratis",
        html: marco(
          "Tu prueba terminó",
          p(`${hola(d.nombre)} tus 14 días con todo abierto terminaron y tu taller ya está en el plan <b>Gratis</b>. Tus clientes, productos y cotizaciones siguen ahí.`) +
            p("Lo que cambia desde hoy:") +
            lista([
              `Solo ${LIMITE_GRATIS} cotizaciones al mes`,
              "Tus PDF salen con la marca de agua de HETNA",
              "Ya no puedes subir DXF/STL ni usar el simulador de costos",
            ]) +
            p(`Con el plan <b>Taller</b> (${precio} al mes) recuperas todo de inmediato, sin perder nada de lo que ya capturaste.`) +
            boton("Recuperar mi plan", utm(tipo, "planes=1"))
        ),
      }
    case "cot_limite":
      return {
        asunto: `Ya usaste tus ${LIMITE_GRATIS} cotizaciones gratis de este mes`,
        html: marco(
          "Tu taller está cotizando bien",
          p(`${hola(d.nombre)} este mes ya hiciste <b>${d.usadas ?? LIMITE_GRATIS} cotizaciones</b>, el máximo del plan Gratis. Para no dejar a ningún cliente esperando hasta el próximo mes:`) +
            lista(LO_DEL_TALLER()) +
            p(`Todo eso por <b>${precio} al mes</b>, unos ${Math.round(TALLER() / 30)} pesos al día.`) +
            boton("Pasarme al plan Taller", utm(tipo, "planes=1"))
        ),
      }
  }
}

export type CandidatoCot = { tipo: TipoCorreoCot; ref: string; correo: string; nombre: string | null; dias?: number; usadas?: number }

/** A quién le toca qué correo hoy (sin revisar bajas ni lo ya enviado). */
export function candidatosCotizador(talleres: Taller[], cots: Map<string, number>, ahora = Date.now()): CandidatoCot[] {
  const mes = inicioDeMes(new Date(ahora)).toISOString().slice(0, 7)
  const out: CandidatoCot[] = []
  for (const t of talleres) {
    const correo = String(t.correo || "").trim().toLowerCase()
    if (!correo || t.plan === "master") continue
    const plan = planEfectivo(t, ahora)
    const base = { correo, nombre: t.nombre }
    const enPruebaOFin = ["trial", "prueba"].includes(String(t.plan))
    const d = diasHasta(t.trial_hasta, ahora)

    const reg = registrado(t)
    if (reg && ahora - reg.getTime() <= 3 * DIA && ahora >= reg.getTime())
      out.push({ ...base, tipo: "cot_bienvenida", ref: t.id })
    if (enPruebaOFin && d !== null && d > 2.5 && d <= 5)
      out.push({ ...base, tipo: "cot_prueba_4", ref: `${t.id}:${t.trial_hasta?.slice(0, 10)}`, dias: Math.ceil(d) })
    if (enPruebaOFin && d !== null && d <= 0 && d > -3)
      out.push({ ...base, tipo: "cot_prueba_fin", ref: `${t.id}:${t.trial_hasta?.slice(0, 10)}` })
    const usadas = cots.get(t.id) || 0
    if (plan === "gratis" && usadas >= LIMITE_GRATIS)
      out.push({ ...base, tipo: "cot_limite", ref: `${t.id}:${mes}`, usadas })
  }
  // Lo más cerca de pagar va primero (por si se acaba el tope del día)
  const orden: TipoCorreoCot[] = ["cot_limite", "cot_prueba_fin", "cot_prueba_4", "cot_bienvenida"]
  return out.sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo))
}

export type ResumenCot = Record<TipoCorreoCot, number> & { presupuesto: number; omitidos: number }

export async function correrCorreosCotizador(knex: any, logger: any, o: { simular?: boolean } = {}): Promise<ResumenCot> {
  const r: ResumenCot = { cot_bienvenida: 0, cot_prueba_4: 0, cot_prueba_fin: 0, cot_limite: 0, presupuesto: 0, omitidos: 0 }
  if (!supabaseListo()) return r
  await asegurarTablaPromo(knex)

  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const [{ n }] = (await knex(T_PROMO).where("created_at", ">=", hoy).count("* as n")) as any
  let presupuesto = maxDia() - Number(n)
  r.presupuesto = presupuesto
  if (presupuesto <= 0) return r

  const [talleres, cots] = await Promise.all([leerTalleres(), cotizacionesDelMes()])
  const tocados = new Set<string>()
  for (const c of candidatosCotizador(talleres, cots)) {
    if (presupuesto <= 0) break
    // Un solo correo del Cotizador por persona al día
    if (tocados.has(c.correo)) {
      r.omitidos++
      continue
    }
    if (await knex(T_PROMO).where({ tipo: c.tipo, ref: c.ref, correo: c.correo }).first()) continue
    if (await knex(T_BAJA).where({ correo: c.correo }).first()) continue

    const { asunto, html } = correoCotizador(c.tipo, c)
    tocados.add(c.correo)
    if (o.simular) {
      r[c.tipo]++
      presupuesto--
      continue
    }
    const env = await sendEmail({ to: c.correo, subject: asunto, html, bajaUrl: ligaBaja(c.correo) })
    if (!env.sent) {
      logger.warn(`[cotizador-correos] ${c.tipo} a ${c.correo} no enviado: ${env.reason}`)
      if (env.configuracion) break
      continue
    }
    await knex(T_PROMO).insert({ correo: c.correo, tipo: c.tipo, ref: c.ref }).onConflict(["tipo", "ref", "correo"]).ignore()
    r[c.tipo]++
    presupuesto--
  }
  return r
}

/** Cuántos correos del Cotizador se han mandado (para el panel). */
export async function correosEnviados(knex: any): Promise<Record<string, number>> {
  await asegurarTablaPromo(knex)
  const filas = await knex(T_PROMO).whereIn("tipo", TIPOS_CORREO_COT).select("tipo").count("* as n").groupBy("tipo")
  return Object.fromEntries(filas.map((f: any) => [f.tipo, Number(f.n)]))
}
