// @ts-nocheck
// Licitaciones 2.0 — cobro de la propuesta elegida.
//
// Dos modos, según el taller que gana (se decide al elegir y se guarda en
// hetna_solicitud.cobro):
//
//   "taller"  El taller conectó su Mercado Pago o su PayPal en la app del
//             Cotizador (misma cuenta que su correo de vendedor). El cliente le
//             paga DIRECTO al taller:
//               · Mercado Pago: la preferencia se crea con el token del taller y
//                 `marketplace_fee` = comisión HETNA; MP la descuenta sola.
//               · PayPal: la orden va con payee = cuenta del taller; la comisión
//                 se anota y se cobra el día 1 (lib/cotizador-comisiones.ts).
//             El taller puede pedir anticipo (anticipo_pct de su propuesta) y el
//             resto se paga después desde la misma liga del cliente. Si el
//             taller desconecta su cuenta a medio camino, lo que falte lo cobra
//             HETNA (respaldo) y se le liquida al taller.
//   "hetna"   El taller no tiene cuenta conectada. El cliente paga el 100 % a
//             HETNA (Mercado Pago de HETNA) y HETNA le paga al taller cuando el
//             cliente confirma que recibió, ya sin la comisión.
//   (null)    Solicitudes de antes de Licitaciones 2.0: cobra HETNA, sin comisión.
//
// Comisión HETNA por plan del taller (decisión de Vlado, 3 nov 2026), sin tope:
//   Gratis 5 %, Taller 4 %, Pro 3 %, Industrial 2 %.
//
// Seguridad de los avisos de pago (revisión del 3 nov):
//   · El aviso de Mercado Pago no se cree: el pago se lee con la llave de HETNA
//     o con el token del taller elegido de ESA solicitud (`?sol=` debe coincidir
//     con la referencia del pago).
//   · El monto debe ser exactamente el siguiente cobro esperado (anticipo, resto
//     o total) y, si cobró el taller, la comisión descontada (marketplace_fee)
//     no puede ser menor a la de su plan. Lo que no cuadra se guarda como
//     "revisar" y se avisa a HETNA, sin mover la solicitud.
//   · Cada pago se anota con la fila de la solicitud bloqueada (FOR UPDATE).
//   · Si algo falla, el aviso responde 500 para que Mercado Pago lo reintente.
import { cambiarEtapa } from "./seguimiento"
import { sendEmail } from "./resend"
import { paypal, paypalListo } from "./paypal-api"
import { supa } from "./cotizador-suscripciones"
import { mpCon, mpDelNegocio, paypalDelNegocio, tokenDelTaller } from "./cotizacion-liga"
import { leerPlanApp } from "./licitacion-plan"
import {
  STORE_URL,
  T_PROPUESTA,
  T_SOLICITUD,
  VENDOR_URL,
  boton,
  crearPreferenciaPago,
  consultarPago,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
  mpDisponible,
  nuevoId,
} from "./licitacion"

export const T_PAGO = "hetna_solicitud_pago"
const API = (process.env.COTIZADOR_API_URL || `${STORE_URL}/api`).replace(/\/$/, "")
const r2 = (n: number) => Math.round(Number(n || 0) * 100) / 100
export const pesos = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
const yaExiste = (e: any) => ["42P07", "42701", "23505"].includes(e?.code) || /already exists/i.test(String(e?.message || ""))

let listo = false
export const asegurarCobro = async (knex: any) => {
  if (listo) return
  // Dos procesos pueden llegar a la vez recién desplegado: "ya existe" no es error.
  try {
    if (!(await knex.schema.hasTable(T_PAGO))) {
      await knex.schema.createTable(T_PAGO, (t: any) => {
        t.text("id").primary()
        t.text("solicitud_id").notNullable().index()
        t.text("tipo").notNullable() // anticipo | resto | total
        t.text("proveedor").notNullable() // mercadopago | paypal
        t.text("cobra").notNullable() // taller | hetna
        t.text("negocio_id").nullable() // negocio del taller en la app (modo taller)
        t.text("externo_id").nullable().unique() // id del pago de MP o captura de PayPal
        t.decimal("monto", 12, 2).notNullable()
        t.decimal("comision", 12, 2).notNullable().defaultTo(0)
        t.boolean("comision_cobrada").notNullable().defaultTo(false)
        t.text("comision_cobro_id").nullable()
        // pendiente | approved | revisar (llegó dinero que no cuadra) | refunded...
        t.text("estado").notNullable().defaultTo("pendiente")
        t.text("pagador").nullable()
        t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
        t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      })
    }
  } catch (e) {
    if (!yaExiste(e)) throw e
  }
  const cols: [string, string, string][] = [
    [T_SOLICITUD, "cobro", "text"], // taller | hetna
    [T_SOLICITUD, "comision_pct", "numeric(5,2)"],
    [T_SOLICITUD, "pagado", "numeric(12,2)"],
    [T_SOLICITUD, "liquidado_en", "timestamptz"],
    [T_PROPUESTA, "anticipo_pct", "integer"],
  ]
  for (const [tabla, col, tipo] of cols) {
    await knex.raw(`alter table ?? add column if not exists ?? ${tipo}`, [tabla, col])
  }
  listo = true
}

// ── Comisión por plan ─────────────────────────────────────────────────
// Decisión del dueño (7 nov 2026): las licitaciones NO cobran comisión; HETNA
// cobra sólo planes, verificaciones y certificaciones. Se deja la tabla en 0 por
// plan (y no se borra) por si algún día se decide otra cosa.
export const PCT_POR_PLAN: Record<string, number> = { gratis: 0, taller: 0, pro: 0, industrial: 0 }

/** Plan del taller para la comisión: gratis | taller | pro | industrial. */
export async function planComision(seller: { email?: string | null; metadata?: any }, logger?: any): Promise<string> {
  const m = (seller?.metadata || {}) as Record<string, any>
  const norm = (p: string) => {
    const v = String(p || "").trim().toLowerCase()
    if (v === "industrial" || v === "master") return "industrial"
    if (v === "pro" || v === "premium" || v === "prueba" || v === "trial") return "pro"
    if (v === "taller") return "taller"
    return v === "gratis" ? "gratis" : ""
  }
  const manual = norm(m.plan)
  const vence = m.plan_vence ? Date.parse(String(m.plan_vence)) : NaN
  if (manual && manual !== "gratis" && (Number.isNaN(vence) || vence > Date.now())) return manual
  if (m.fundador === true || m.fundador === "true") {
    const desde = Date.parse(String(m.fundador_desde || ""))
    const hasta = new Date(Number.isNaN(desde) ? 0 : desde)
    hasta.setMonth(hasta.getMonth() + 6)
    if (Number.isNaN(desde) || hasta.getTime() > Date.now()) return "pro"
  }
  if (seller?.email) {
    try {
      const app = await leerPlanApp(seller.email)
      if (app) return norm(app) || "gratis"
    } catch (e) {
      // Supabase no respondió: tarifa intermedia para no cobrar de más ni de menos
      logger?.warn?.(`[licitacion] plan del taller no disponible (${(e as Error).message}); se usa la tarifa Taller`)
      return "taller"
    }
  }
  return "gratis"
}

export const comisionDe = (monto: number, pct: number) => r2((Number(monto) * Number(pct)) / 100)
/** % de comisión de la solicitud. Las de antes de Licitaciones 2.0 no llevan. */
export const pctDe = (s: any) => (s?.comision_pct != null ? Number(s.comision_pct) : 0)

// ── Cuenta de cobro del taller (app del Cotizador) ─────────────────────
export type CuentaTaller = { negocioId: string | null; mp: boolean; paypal: { payer_id: string; email?: string } | null }

/** Correo seguro para un filtro ilike de PostgREST (sin comodines). */
export const correoParaFiltro = (correo: string | null | undefined) => {
  const c = String(correo || "").trim().toLowerCase()
  if (!c || !/^[^\s@,()*%\\]+@[^\s@,()*%\\]+$/.test(c)) return null
  return encodeURIComponent(c.replace(/_/g, "\\_"))
}

/** `estricto`: si Supabase falla, lanza en vez de responder "sin cuenta". */
export async function cuentaTaller(correo: string | null | undefined, estricto = false): Promise<CuentaTaller> {
  const vacia: CuentaTaller = { negocioId: null, mp: false, paypal: null }
  const filtro = correoParaFiltro(correo)
  if (!filtro || !process.env.COTIZADOR_SUPABASE_SERVICE_KEY) return vacia
  try {
    const negocios = await supa<any[]>(`/rest/v1/negocios?select=id&correo=ilike.${filtro}&limit=5`)
    let elegido: CuentaTaller = vacia
    for (const n of negocios || []) {
      const [mp, pp] = await Promise.all([mpDelNegocio(n.id), paypalDelNegocio(n.id)])
      const cuenta = { negocioId: n.id, mp: Boolean(mp?.access_token), paypal: pp?.payer_id ? { payer_id: pp.payer_id, email: pp.email } : null }
      if (cuenta.mp || cuenta.paypal) return cuenta
      if (!elegido.negocioId) elegido = cuenta
    }
    return elegido
  } catch (e) {
    if (estricto) throw e
    return vacia
  }
}

// ── Estado del cobro de una solicitud ─────────────────────────────────
export type Cobro = {
  modo: "taller" | "hetna"
  metodos: ("mercadopago" | "paypal")[]
  // true = el taller ya no tiene cuenta conectada y lo que falta lo cobra HETNA
  respaldo: boolean
  total: number
  pagado: number
  saldo: number
  anticipo_pct: number
  siguiente: { tipo: "anticipo" | "resto" | "total"; monto: number } | null
  comision_pct: number
}

export async function propuestaElegida(knex: any, s: any) {
  if (!s?.propuesta_elegida) return null
  return knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where("p.id", s.propuesta_elegida)
    .first("p.*", "v.name as taller", "v.email as taller_email", "v.metadata as taller_metadata", "v.handle as taller_handle")
}

/** Pagado con pagos aprobados. Las solicitudes pagadas antes de Licitaciones
 *  2.0 no tienen filas de pago: cuentan como pagadas por completo. */
export async function pagadoDe(knex: any, s: any, total?: number) {
  const r = await knex(T_PAGO).where({ solicitud_id: s.id, estado: "approved" }).sum({ n: "monto" }).first()
  const suma = r2(Number(r?.n || 0))
  if (suma <= 0 && s.pago_estado === "pagado") return r2(Number(s.pago_monto || total || 0))
  return suma
}

/** Siguiente cobro esperado, sin contar pagos nuevos. */
export const siguienteCobro = (total: number, pagado: number, modoTaller: boolean, anticipoPct: number) => {
  const saldo = r2(Math.max(0, total - pagado))
  if (saldo <= 0.009) return null
  if (pagado <= 0.009) {
    const pct = modoTaller ? anticipoPct : 100
    return pct >= 100 ? { tipo: "total" as const, monto: total } : { tipo: "anticipo" as const, monto: r2((total * pct) / 100) }
  }
  return { tipo: "resto" as const, monto: saldo }
}

const pctAnticipo = (p: any) => Math.min(100, Math.max(10, Number(p?.anticipo_pct || 100)))

export async function estadoCobro(knex: any, s: any, p?: any, cuenta?: CuentaTaller): Promise<Cobro | null> {
  await asegurarCobro(knex)
  p = p || (await propuestaElegida(knex, s))
  if (!p) return null
  const total = r2(p.precio)
  const pagado = await pagadoDe(knex, s, total)
  const saldo = r2(Math.max(0, total - pagado))
  const modo = s.cobro === "taller" ? "taller" : "hetna"
  let metodos: ("mercadopago" | "paypal")[] = []
  let respaldo = false
  if (modo === "taller") {
    cuenta = cuenta || (await cuentaTaller(p.taller_email))
    if (cuenta.mp) metodos.push("mercadopago")
    if (cuenta.paypal && paypalListo()) metodos.push("paypal")
    if (!metodos.length && mpDisponible()) {
      metodos = ["mercadopago"]
      respaldo = true
    }
  } else if (mpDisponible()) metodos = ["mercadopago"]
  const pct = modo === "taller" ? pctAnticipo(p) : 100
  // Se puede pagar mientras haya saldo, también después de cerrada (el resto
  // de un anticipo), pero no si se canceló.
  const cobrable = ["elegida", "pagada", "cerrada"].includes(s.estado) && s.etapa !== "cancelada"
  const siguiente = cobrable ? siguienteCobro(total, pagado, modo === "taller" && !respaldo, pct) : null
  return { modo, metodos, respaldo, total, pagado, saldo, anticipo_pct: pct, siguiente, comision_pct: pctDe(s) }
}

/** Al elegir: decide el modo de cobro y fija la comisión. Si no se puede leer
 *  la cuenta del taller, deja la comisión fijada y el modo pendiente (null):
 *  se vuelve a intentar al pedir la liga de pago. */
export async function prepararCobro(knex: any, s: any, p: any, logger?: any) {
  await asegurarCobro(knex)
  const plan = await planComision({ email: p.taller_email, metadata: p.taller_metadata }, logger)
  const pct = PCT_POR_PLAN[plan] ?? 0
  await knex(T_SOLICITUD).where({ id: s.id }).update({ comision_pct: pct, updated_at: knex.fn.now() })
  const cuenta = await cuentaTaller(p.taller_email, true)
  const modo = cuenta.mp || (cuenta.paypal && paypalListo()) ? "taller" : "hetna"
  await knex(T_SOLICITUD).where({ id: s.id }).update({ cobro: modo, updated_at: knex.fn.now() })
  return { modo, pct, cuenta }
}

const NOMBRE_TIPO = { anticipo: "Anticipo", resto: "Resto", total: "Pago" }
const err = (m: string, status: number) => Object.assign(new Error(m), { status })

/** Liga de pago del siguiente cobro (anticipo, resto o total). */
export async function ligaDePago(knex: any, s: any, proveedor: "mercadopago" | "paypal", logger?: any) {
  await asegurarCobro(knex)
  const p = await propuestaElegida(knex, s)
  if (!p) throw err("Primero elige una propuesta.", 409)
  // El modo quedó pendiente al elegir (Supabase no respondió): se decide ahora.
  if (!s.cobro && s.comision_pct != null) {
    await prepararCobro(knex, s, p, logger)
    s = await knex(T_SOLICITUD).where({ id: s.id }).first()
  }
  const cuenta = s.cobro === "taller" ? await cuentaTaller(p.taller_email, true) : undefined
  const c = await estadoCobro(knex, s, p, cuenta)
  if (!c?.siguiente) throw err("No hay nada pendiente de pago.", 409)
  if (!c.metodos.includes(proveedor)) throw err("Ese medio de pago no está disponible para este taller.", 409)
  const folio = folioTexto(s.folio)
  const { tipo, monto } = c.siguiente
  const titulo = `${folio} · ${NOMBRE_TIPO[tipo]} · Fabricación con ${p.taller}`
  const retorno = ligaPropuestas(s.token)
  const pct = pctDe(s)
  const ref = `licitacion:${s.id}:${tipo}`

  // Cobra HETNA: taller sin cuenta conectada, solicitud de antes, o respaldo
  if (c.modo === "hetna" || (c.respaldo && proveedor === "mercadopago")) {
    const pref = await crearPreferenciaPago({ solicitudId: `${s.id}-${tipo}-${Math.round(monto * 100)}`, folio, titulo, monto, email: s.contacto?.email, retorno, referencia: ref })
    if (!pref) throw err("El pago en línea no está disponible por ahora. Escríbenos y te mandamos la liga.", 503)
    await knex(T_SOLICITUD)
      .where({ id: s.id })
      .update({ pago_url: pref.url, pago_monto: monto, ...(c.pagado > 0 ? {} : { pago_estado: "pendiente" }), updated_at: knex.fn.now() })
    return { url: pref.url, monto, tipo }
  }

  // Directo al taller: Mercado Pago
  if (proveedor === "mercadopago") {
    const mp = await tokenDelTaller(cuenta.negocioId)
    const comision = comisionDe(monto, pct)
    const pref = await mpCon(mp.token, "/checkout/preferences", {
      method: "POST",
      headers: { "X-Idempotency-Key": `lic-${s.id}-${tipo}-${Math.round(monto * 100)}` },
      body: JSON.stringify({
        items: [{ id: folio, title: titulo.slice(0, 250), quantity: 1, currency_id: "MXN", unit_price: monto }],
        payer: s.contacto?.email ? { email: s.contacto.email } : undefined,
        marketplace_fee: comision,
        external_reference: ref,
        notification_url: `${API}/mp-licitacion?sol=${encodeURIComponent(s.id)}`,
        back_urls: { success: retorno, pending: retorno, failure: retorno },
        auto_return: "approved",
        statement_descriptor: String(p.taller || "HETNA").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 22) || "HETNA",
        metadata: { solicitud_id: s.id, tipo, comision_hetna: comision, comision_pct: pct },
      }),
    })
    const url = pref.init_point || pref.sandbox_init_point
    if (!url) throw new Error("Mercado Pago no devolvió la liga de pago")
    await knex(T_SOLICITUD).where({ id: s.id }).update({ pago_url: url, pago_monto: monto, updated_at: knex.fn.now() })
    return { url, monto, tipo }
  }

  // Directo al taller: PayPal (comisión al corte del mes)
  const orden = await paypal<any>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `lic-${s.id}-${tipo}-${Math.round(monto * 100)}-${Math.floor(Date.now() / 600_000)}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: s.id,
          custom_id: ref,
          description: titulo.slice(0, 127),
          amount: { currency_code: "MXN", value: monto.toFixed(2) },
          payee: { merchant_id: cuenta.paypal.payer_id },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: String(p.taller || "HETNA").slice(0, 127),
            locale: "es-MX",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${API}/licitacion-paypal/${s.token}`,
            cancel_url: `${retorno}?pago=error`,
          },
        },
      },
    }),
  })
  const url = (orden.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href
  if (!url) throw new Error("PayPal no devolvió la liga de pago")
  return { url, monto, tipo }
}

export const leerReferencia = (ref: string | undefined) => {
  const m = String(ref || "").match(/^licitacion:([A-Za-z0-9_]+)(?::(anticipo|resto|total))?$/)
  return m ? { solicitudId: m[1], tipo: (m[2] || "total") as "anticipo" | "resto" | "total" } : null
}

type DatosPago = {
  externoId: string
  tipo: "anticipo" | "resto" | "total"
  proveedor: "mercadopago" | "paypal"
  cobra: "taller" | "hetna"
  negocioId?: string | null
  monto: number
  comision: number
  comisionCobrada: boolean
  // Comisión mínima que debió descontarse (cobro directo con MP)
  comisionMinima?: number
  estado: string
  pagador?: string | null
}

async function avisarHetna(asunto: string, cuerpo: string, logger?: any) {
  const to = process.env.HETNA_LEADS_EMAIL
  if (!to) return
  const r = await sendEmail({ to, subject: asunto, html: marco(asunto, cuerpo) })
  if (!r.sent) logger?.info?.(`[licitacion] aviso a HETNA no enviado: ${r.reason}`)
}

/** Anota un pago y, si se acaba de aprobar y cuadra, avanza la solicitud y avisa.
 *  Todo con la fila de la solicitud bloqueada para que dos avisos a la vez no
 *  cuenten doble. */
export async function registrarPagoLicitacion(knex: any, solicitudId: string, datos: DatosPago, logger?: any) {
  await asegurarCobro(knex)
  const resultado = await knex.transaction(async (trx: any) => {
    const s = await trx(T_SOLICITUD).where({ id: solicitudId }).forUpdate().first()
    if (!s) return null
    const previo = await trx(T_PAGO).where({ externo_id: datos.externoId }).first()
    const p = await propuestaElegida(trx, s)
    const total = r2(p?.precio || 0)
    const pagadoAntes = await pagadoDe(trx, s, total)
    const yaAprobado = previo?.estado === "approved"
    const aprobado = datos.estado === "approved"

    // ¿Cuadra con lo esperado? (sólo la primera vez que se aprueba)
    let estado = datos.estado
    let motivo = ""
    if (aprobado && !yaAprobado) {
      const esperado = siguienteCobro(total, pagadoAntes, s.cobro === "taller" && datos.cobra === "taller", pctAnticipo(p))
      if (!p) motivo = "la solicitud no tiene propuesta elegida"
      else if (s.etapa === "cancelada") motivo = "la solicitud está cancelada"
      else if (!esperado) motivo = "la solicitud ya estaba pagada"
      else if (Math.abs(datos.monto - esperado.monto) > 0.01) motivo = `el monto ${pesos(datos.monto)} no es el esperado (${pesos(esperado.monto)})`
      else if (datos.comisionMinima != null && datos.comision + 0.01 < datos.comisionMinima)
        motivo = `la comisión descontada ${pesos(datos.comision)} es menor a la del plan (${pesos(datos.comisionMinima)})`
      if (motivo) estado = "revisar"
    }

    const registro = {
      solicitud_id: s.id,
      tipo: datos.tipo,
      proveedor: datos.proveedor,
      cobra: datos.cobra,
      negocio_id: datos.negocioId || null,
      externo_id: datos.externoId,
      monto: r2(datos.monto),
      comision: r2(datos.comision),
      comision_cobrada: datos.comisionCobrada,
      // Un pago ya aprobado sólo cambia a reembolso/contracargo, nunca a "revisar"
      estado: yaAprobado && aprobado ? "approved" : estado,
      pagador: datos.pagador || null,
      updated_at: trx.fn.now(),
    }
    if (previo) await trx(T_PAGO).where({ id: previo.id }).update(registro)
    else await trx(T_PAGO).insert({ id: nuevoId("pag"), ...registro })

    // Reembolso o contracargo de un pago que ya contaba
    if (yaAprobado && !aprobado) {
      const pagado = await pagadoDe(trx, { ...s, pago_estado: null }, total)
      await trx(T_SOLICITUD)
        .where({ id: s.id })
        .update({ pagado, pago_estado: pagado <= 0 ? "reembolsado" : pagado + 0.009 >= total ? "pagado" : "anticipo", updated_at: trx.fn.now() })
      return { tipo: "reverso", s, p, total, pagado }
    }
    if (motivo) return { tipo: "revisar", s, p, motivo }
    if (!aprobado || yaAprobado) {
      if (!aprobado && pagadoAntes <= 0)
        await trx(T_SOLICITUD).where({ id: s.id }).update({ pago_estado: datos.estado, pago_id: datos.externoId, updated_at: trx.fn.now() })
      return { tipo: "nada" }
    }

    const pagado = r2(pagadoAntes + datos.monto)
    const completo = pagado + 0.009 >= total
    const primero = s.estado === "elegida"
    await trx(T_SOLICITUD)
      .where({ id: s.id })
      .update({
        pagado,
        pago_id: datos.externoId,
        pago_estado: completo ? "pagado" : "anticipo",
        ...(primero ? { estado: "pagada" } : {}),
        updated_at: trx.fn.now(),
      })
    return { tipo: "aprobado", s, p, total, pagado, completo, primero }
  })

  if (!resultado || resultado.tipo === "nada") return { recien: false }
  const { s, p } = resultado
  const folio = folioTexto(s.folio)

  if (resultado.tipo === "revisar") {
    logger?.error?.(`[licitacion] ${folio} pago ${datos.externoId} a revisar: ${resultado.motivo}`)
    await avisarHetna(
      `[${folio}] Pago a revisar (${datos.proveedor})`,
      `<table style="border-collapse:collapse;font-size:14px">` +
        fila("Folio", folio) + fila("Pago", datos.externoId) + fila("Monto", pesos(datos.monto)) +
        fila("Cobró", datos.cobra === "taller" ? "Cuenta del taller" : "HETNA") + fila("Motivo", resultado.motivo) +
        `</table><p style="color:#40403A">No se movió la solicitud. Si el dinero sí llegó, decide si se reembolsa o se aplica a mano.</p>`,
      logger
    )
    return { recien: false, revisar: true }
  }
  if (resultado.tipo === "reverso") {
    logger?.warn?.(`[licitacion] ${folio} pago ${datos.externoId} pasó a ${datos.estado}`)
    await avisarHetna(
      `[${folio}] Reembolso o contracargo (${datos.estado})`,
      `<p style="color:#40403A">El pago ${esc(datos.externoId)} de ${esc(pesos(datos.monto))} pasó a <strong>${esc(datos.estado)}</strong>. Ahora lleva pagado ${esc(pesos(resultado.pagado))} de ${esc(pesos(resultado.total))}. Revisa con el taller antes de seguir.</p>`,
      logger
    )
    return { recien: false }
  }

  const { total, pagado, completo, primero } = resultado
  if (primero) {
    await cambiarEtapa(knex, s, "en_produccion", {
      actor: "sistema",
      nota: `${completo ? "Pago" : "Anticipo"} confirmado (${pesos(datos.monto)}). ${p?.taller || "El taller"} empieza a fabricar; entrega comprometida en ${p?.dias ?? "—"} días.`,
      correo: false,
    }).catch((e: Error) => logger?.error?.(`[seguimiento] ${folio} no se pudo marcar en producción: ${e.message}`))
  }

  const dondeLlega =
    datos.cobra === "taller"
      ? datos.proveedor === "mercadopago"
        ? `El dinero entra a tu Mercado Pago, completo: HETNA no cobra comisión.`
        : `El dinero entra a tu PayPal, completo: HETNA no cobra comisión.`
      : `HETNA guarda el pago y te lo transfiere completo cuando el cliente confirme que recibió.`
  const resumen =
    `<table style="border-collapse:collapse;font-size:14px">` +
    fila("Folio", folio) +
    fila("Taller", p?.taller || "") +
    fila(NOMBRE_TIPO[datos.tipo], pesos(datos.monto)) +
    fila("Pagado en total", `${pesos(pagado)} de ${pesos(total)}`) +
    `</table>`
  const avisos = [
    process.env.HETNA_LEADS_EMAIL && {
      to: process.env.HETNA_LEADS_EMAIL,
      subject: `[${folio}] ${primero ? "PAGADO · arrancar producción" : "Pago del resto"} (${datos.cobra === "taller" ? "directo al taller" : "cobra HETNA"})`,
      html: marco("Pago confirmado", resumen + `<p style="color:#40403A">${esc(dondeLlega)}</p>`),
    },
    p?.taller_email && {
      to: p.taller_email,
      subject: primero ? `[${folio}] Pago confirmado: ya puedes fabricar` : `[${folio}] El cliente pagó el resto`,
      html: marco(
        primero ? "¡El cliente pagó! Ya puedes fabricar" : "El cliente liquidó el pedido",
        resumen +
          `<p style="color:#40403A">${esc(dondeLlega)}</p>` +
          (primero ? `<p style="color:#40403A">Entrega comprometida: ${esc(p.dias)} días. Cuando termines, márcalo en tu panel.</p>` : "") +
          boton("Ver en mi panel", `${VENDOR_URL}/solicitudes`)
      ),
    },
    s.contacto?.email && {
      to: s.contacto.email,
      subject: `[${folio}] Recibimos tu pago`,
      html: marco(
        "¡Gracias! Recibimos tu pago",
        resumen +
          `<p style="color:#40403A">${
            completo ? "Tu pedido está pagado por completo." : `Falta ${esc(pesos(total - pagado))}; lo pagas desde tu misma liga cuando el taller te lo pida.`
          } Te avisaremos cuando salga el envío.</p>` +
          boton("Ver mi pedido", ligaPropuestas(s.token))
      ),
    },
  ].filter(Boolean) as { to: string; subject: string; html: string }[]
  for (const a of avisos) {
    const r = await sendEmail(a)
    if (!r.sent) logger?.info?.(`[licitacion] aviso de pago no enviado: ${r.reason}`)
    await new Promise((r) => setTimeout(r, 600))
  }
  logger?.info?.(`[licitacion] ${folio} ${datos.tipo} ${datos.proveedor}/${datos.cobra} ${pesos(datos.monto)} (comisión ${pesos(datos.comision)})`)
  return { recien: true, completo }
}

/** Aviso de Mercado Pago. `sol` viene en la URL cuando el cobro fue a la
 *  cuenta del taller: el pago se lee con el token del taller elegido de esa
 *  solicitud y su referencia tiene que ser de esa misma solicitud.
 *  Lanza si algo falla, para que Mercado Pago reintente. */
export async function avisoMercadoPago(knex: any, pagoId: string, sol: string | null, logger?: any) {
  await asegurarCobro(knex)
  let pago: any
  let cobra: "taller" | "hetna" = "hetna"
  let negocioId: string | null = null
  let s: any = null

  if (sol) {
    s = await knex(T_SOLICITUD).where({ id: sol }).first()
    if (!s) return
    const p = await propuestaElegida(knex, s)
    const cuenta = await cuentaTaller(p?.taller_email, true)
    if (!cuenta.mp || !cuenta.negocioId) {
      // El taller ya no tiene Mercado Pago conectado: no hay con qué leer el
      // pago. HETNA lo revisa a mano en el panel de Mercado Pago del taller.
      await avisarHetna(
        `[${folioTexto(s.folio)}] Aviso de pago sin cuenta del taller`,
        `<p>Llegó el aviso del pago ${esc(pagoId)} pero el taller ya no tiene Mercado Pago conectado. Pídele el comprobante.</p>`,
        logger
      )
      return
    }
    const mp = await tokenDelTaller(cuenta.negocioId)
    pago = await mpCon(mp.token, `/v1/payments/${encodeURIComponent(pagoId)}`)
    if (String(pago.collector_id || "") !== String(mp.mpUserId)) {
      logger?.warn?.(`[licitacion] pago ${pagoId}: el cobro no es de la cuenta del taller`)
      return
    }
    const ref = leerReferencia(pago.external_reference)
    // La referencia tiene que ser de ESTA solicitud: si no, alguien quiere
    // acreditar un pago suyo a otra solicitud.
    if (!ref || ref.solicitudId !== s.id) {
      logger?.warn?.(`[licitacion] pago ${pagoId}: referencia ${pago.external_reference} no es de ${folioTexto(s.folio)}`)
      return
    }
    cobra = "taller"
    negocioId = cuenta.negocioId
  } else {
    pago = await consultarPago(pagoId) // llave de HETNA: el dinero llegó a HETNA
  }

  const ref = leerReferencia(pago.external_reference)
  if (!ref) return
  s = s || (await knex(T_SOLICITUD).where({ id: ref.solicitudId }).first())
  if (!s) return
  // Pago de antes de Licitaciones 2.0 que Mercado Pago vuelve a avisar
  if (!(await knex(T_PAGO).where({ externo_id: `mp:${pago.id}` }).first()) && s.pago_estado === "pagado" && String(s.pago_id || "") === String(pago.id)) return
  if (pago.currency_id !== "MXN") {
    logger?.error?.(`[licitacion] ${folioTexto(s.folio)} pago ${pago.id} en ${pago.currency_id}`)
    return
  }

  const monto = r2(pago.transaction_amount)
  const pct = pctDe(s)
  const descontada = Number(pago.marketplace_fee ?? pago.fee_details?.find?.((f) => f.type === "application_fee")?.amount ?? 0)
  await registrarPagoLicitacion(
    knex,
    s.id,
    {
      externoId: `mp:${pago.id}`,
      tipo: ref.tipo,
      proveedor: "mercadopago",
      cobra,
      negocioId,
      monto,
      // Directo al taller: lo que MP ya descontó. Cobro HETNA: se descuenta al liquidar.
      comision: cobra === "taller" ? r2(descontada) : comisionDe(monto, pct),
      comisionMinima: cobra === "taller" ? comisionDe(monto, pct) : undefined,
      comisionCobrada: cobra === "taller",
      estado: String(pago.status || ""),
      pagador: pago.payer?.email || null,
    },
    logger
  )
}

/** Regreso de PayPal: revisa la orden ANTES de cobrarla, la cobra y la anota.
 *  Devuelve a dónde mandar al cliente. */
export async function capturarPaypalLicitacion(knex: any, token: string, ordenId: string, logger?: any): Promise<string> {
  await asegurarCobro(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return `${STORE_URL}/mx/cotizar`
  const liga = ligaPropuestas(token)
  if (!/^[A-Z0-9]{10,30}$/i.test(ordenId || "")) return `${liga}?pago=error`
  const p = await propuestaElegida(knex, s)
  const cuenta = await cuentaTaller(p?.taller_email, true)
  if (!cuenta.paypal) return `${liga}?pago=error`

  let orden = await paypal<any>(`/v2/checkout/orders/${ordenId}`)
  const unidad = orden.purchase_units?.[0]
  const ref = leerReferencia(unidad?.custom_id)
  if (!ref || ref.solicitudId !== s.id) {
    logger?.warn?.(`[licitacion] PayPal ${ordenId}: no es de ${folioTexto(s.folio)}`)
    return `${liga}?pago=error`
  }
  if (unidad?.payee?.merchant_id !== cuenta.paypal.payer_id) {
    logger?.warn?.(`[licitacion] PayPal ${ordenId}: la orden no paga a la cuenta del taller`)
    return `${liga}?pago=error`
  }
  if (String(unidad?.amount?.currency_code || "") !== "MXN") return `${liga}?pago=error`

  if (orden.status === "APPROVED") {
    // Antes de cobrar: ¿sigue siendo lo que falta? (dos pestañas, o ya pagó con MP)
    const c = await estadoCobro(knex, s, p, cuenta)
    const valor = r2(unidad?.amount?.value)
    if (!c?.siguiente || Math.abs(valor - c.siguiente.monto) > 0.01) {
      logger?.warn?.(`[licitacion] PayPal ${ordenId}: ${pesos(valor)} ya no es lo que falta en ${folioTexto(s.folio)}; no se cobra`)
      return `${liga}?pago=error`
    }
    orden = await paypal<any>(`/v2/checkout/orders/${ordenId}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `cap-${ordenId}` },
      body: "{}",
    })
  }
  const captura = orden.purchase_units?.[0]?.payments?.captures?.[0]
  if (!captura) return `${liga}?pago=${orden.status === "PAYER_ACTION_REQUIRED" ? "error" : "pendiente"}`
  const estado = captura.status === "COMPLETED" ? "approved" : captura.status === "PENDING" ? "pending" : String(captura.status || "").toLowerCase()
  const monto = r2(captura.amount?.value)
  const r = await registrarPagoLicitacion(
    knex,
    s.id,
    {
      externoId: `pp:${captura.id}`,
      tipo: ref.tipo,
      proveedor: "paypal",
      cobra: "taller",
      negocioId: cuenta.negocioId,
      monto,
      comision: comisionDe(monto, pctDe(s)),
      comisionCobrada: false, // se cobra en el corte del día 1
      estado,
      pagador: orden.payer?.email_address || null,
    },
    logger
  )
  return `${liga}?pago=${r?.revisar ? "error" : estado === "approved" ? "ok" : "pendiente"}`
}

/** Para el corte del día 1: comisiones de licitaciones cobradas con PayPal. */
export async function comisionesPaypalPendientes(knex: any, hasta: string) {
  await asegurarCobro(knex)
  return knex(T_PAGO)
    .where({ proveedor: "paypal", cobra: "taller", estado: "approved", comision_cobrada: false })
    .whereNull("comision_cobro_id")
    .whereNotNull("negocio_id")
    .where("created_at", "<", hasta)
    .select("id", "negocio_id", "comision")
}

/** Lo que HETNA cobró de una solicitud y le debe al taller (menos comisión).
 *  Las de antes de Licitaciones 2.0 (sin filas de pago) no llevan comisión. */
export async function liquidacionTaller(knex: any, s: any) {
  await asegurarCobro(knex)
  const pagos = await knex(T_PAGO).where({ solicitud_id: s.id, estado: "approved", cobra: "hetna" }).select("monto", "comision")
  if (!pagos.length && !s.cobro && s.pago_estado === "pagado") {
    const cobrado = r2(Number(s.pago_monto || 0))
    return { cobrado, comision: 0, aPagar: cobrado }
  }
  const cobrado = r2(pagos.reduce((a, x) => a + Number(x.monto), 0))
  const comision = r2(pagos.reduce((a, x) => a + Number(x.comision), 0))
  return { cobrado, comision, aPagar: r2(cobrado - comision) }
}
