// Cupones de HETNA: "BIENVENIDA" (primera compra) y "Recomienda y gana".
//
// Reglas (decididas por Vlado el 1 nov 2026):
//   - BIENVENIDA: $100 de descuento en la PRIMERA compra de cada cuenta, en
//     compras de $800 o más (sin contar envío). Un solo código para todos, para
//     poder anunciarlo en redes.
//   - Recomienda y gana: cada cliente tiene su liga (?ref=CODIGO). Su amigo se
//     registra con ella y usa BIENVENIDA. Cuando el amigo ya tiene una compra
//     pagada de $800 o más y pasaron DIAS_ESPERA días sin cancelarla, quien lo
//     recomendó recibe un cupón personal de $100 (GRACIAS-XXXXXX), de un solo
//     uso, para compras de $800 o más y con vigencia de DIAS_VIGENCIA días.
//   - El descuento lo paga HETNA, no el taller: al colocarse el pedido se agrega
//     una línea de comisión negativa por el mismo monto
//     (subscribers/cupon-lo-paga-hetna.ts). Así el pago al taller (total del
//     pedido menos comisión) queda igual que sin cupón.
//
// Las promociones son de Medusa (módulo de promociones). Lo que Medusa no sabe
// hacer solo (primera compra, mínimo de compra, cupón de una sola cuenta,
// vencimiento) se revisa en api/store/hetna-cupones/middlewares.ts al aplicar el
// código y otra vez al pagar.
import { randomBytes } from "crypto"

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { STORE_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"

export const CUPON_BIENVENIDA = () => (process.env.CUPON_BIENVENIDA || "BIENVENIDA").trim().toUpperCase()
export const MONTO = () => Number(process.env.CUPON_MONTO || 100)
export const MINIMO = () => Number(process.env.CUPON_MINIMO || 800)
export const PREFIJO_RECOMPENSA = "GRACIAS-"
export const DIAS_ESPERA = () => Number(process.env.RECOMIENDA_DIAS_ESPERA || 7)
export const DIAS_VIGENCIA = () => Number(process.env.RECOMIENDA_DIAS_VIGENCIA || 90)
export const MAX_RECOMPENSAS_ANIO = () => Number(process.env.RECOMIENDA_MAX_ANIO || 20)
const MONEDA = "mxn"
const DIA = 86_400_000

type Scope = { resolve: (k: string) => any }

export const esBienvenida = (code?: string | null) => (code || "").trim().toUpperCase() === CUPON_BIENVENIDA()
export const esRecompensa = (code?: string | null) => (code || "").trim().toUpperCase().startsWith(PREFIJO_RECOMPENSA)
export const esCuponHetna = (code?: string | null) => esBienvenida(code) || esRecompensa(code)

export const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString("es-MX")}`

// Sin letras que se confunden (0/O, 1/I/L)
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const azar = (n: number) => {
  const b = randomBytes(n)
  return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("")
}

// ── Promociones ───────────────────────────────────────────────────────────────────────────────

type Promo = {
  id: string
  code: string
  status?: string
  limit?: number | null
  used?: number | null
  metadata?: Record<string, unknown> | null
}

const promociones = (scope: Scope) => scope.resolve(Modules.PROMOTION)

export async function buscarPromo(scope: Scope, code: string): Promise<Promo | null> {
  const [p] = await promociones(scope).listPromotions({ code: code.trim().toUpperCase() }, { take: 1 })
  return (p as Promo) || null
}

async function crearPromo(
  scope: Scope,
  datos: { code: string; limit?: number | null; metadata: Record<string, unknown> }
): Promise<Promo> {
  const [p] = await promociones(scope).createPromotions([
    {
      code: datos.code,
      type: "standard",
      status: "active",
      is_automatic: false,
      // $100 sobre el precio final (los precios de la tienda ya traen IVA)
      is_tax_inclusive: true,
      ...(datos.limit ? { limit: datos.limit } : {}),
      application_method: {
        type: "fixed",
        target_type: "order",
        allocation: "across",
        value: MONTO(),
        currency_code: MONEDA,
      },
      metadata: datos.metadata,
    },
  ])
  // Para el registro de Mercur: el costo de esta promoción es del marketplace.
  // (El ajuste real al pago del taller lo hace subscribers/cupon-lo-paga-hetna.ts.)
  try {
    const { upsertPromotionCostsWorkflow } = await import("@mercurjs/core/workflows" as string)
    await upsertPromotionCostsWorkflow(scope).run({
      input: { promotion_id: p.id, cost_bearer: "marketplace", shared_marketplace_percentage: null },
    })
  } catch {
    // si esta versión de Mercur no lo tiene, no pasa nada
  }
  return p as Promo
}

let bienvenidaLista = false
/** Crea la promoción BIENVENIDA si todavía no existe. */
export async function asegurarBienvenida(scope: Scope): Promise<void> {
  if (bienvenidaLista) return
  const ya = await buscarPromo(scope, CUPON_BIENVENIDA())
  if (!ya) {
    await crearPromo(scope, { code: CUPON_BIENVENIDA(), metadata: { tipo: "bienvenida", lo_paga: "hetna" } })
    scope.resolve("logger").info(`[cupones] promoción ${CUPON_BIENVENIDA()} creada`)
  }
  bienvenidaLista = true
}

// ── Reglas al aplicar y al pagar ──────────────────────────────────────────────

export type CarritoCupon = {
  id: string
  customer_id?: string | null
  email?: string | null
  items?: { unit_price?: number | null; quantity?: number | null }[] | null
}

export const subtotalProductos = (c: CarritoCupon) =>
  (c.items || []).reduce((s, i) => s + (Number(i?.unit_price) || 0) * (Number(i?.quantity) || 0), 0)

/** ¿El cliente ya tiene alguna compra (no cancelada)? Por cuenta y por correo. */
export async function yaCompro(scope: Scope, clienteId: string, email?: string | null): Promise<boolean> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filtros: Record<string, unknown>[] = [{ customer_id: clienteId }]
  if (email) filtros.push({ email: email.toLowerCase() })
  for (const filters of filtros) {
    const { data } = await query.graph({ entity: "order", fields: ["id", "status"], filters })
    if ((data || []).some((o: { status?: string }) => o.status !== "canceled")) return true
  }
  return false
}

/** Mensaje de por qué no aplica el cupón, o null si sí aplica. */
export async function motivoCupon(scope: Scope, carrito: CarritoCupon, code: string): Promise<string | null> {
  const codigo = code.trim().toUpperCase()
  if (!carrito.customer_id) return `Inicia sesión para usar el cupón ${codigo}.`

  const clientes = scope.resolve(Modules.CUSTOMER)
  const cliente = await clientes.retrieveCustomer(carrito.customer_id).catch(() => null)
  if (!cliente?.has_account) return `Inicia sesión con tu cuenta para usar el cupón ${codigo}.`

  if (esBienvenida(codigo)) {
    if (await yaCompro(scope, cliente.id, cliente.email)) {
      return `El cupón ${codigo} es solo para tu primera compra en HETNA CNC.`
    }
  } else if (esRecompensa(codigo)) {
    const promo = await buscarPromo(scope, codigo)
    if (!promo) return `El cupón ${codigo} no existe.`
    const m = promo.metadata || {}
    if (m.cliente_id !== cliente.id) return `El cupón ${codigo} es de otra cuenta.`
    if (typeof promo.limit === "number" && Number(promo.used || 0) >= promo.limit) return `El cupón ${codigo} ya se usó.`
    if (m.vence && new Date(String(m.vence)).getTime() < Date.now()) return `El cupón ${codigo} ya venció.`
  } else {
    return null
  }

  const llevas = subtotalProductos(carrito)
  if (llevas < MINIMO()) {
    return `El cupón ${codigo} aplica en compras de ${pesos(MINIMO())} o más en productos (llevas ${pesos(llevas)}).`
  }
  return null
}

// ── Recomienda y gana ───────────────────────────────────────────────────────────

const slug = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8)

/** Código de recomendación del cliente (lo crea la primera vez). */
export async function codigoDe(scope: Scope, clienteId: string): Promise<string> {
  const clientes = scope.resolve(Modules.CUSTOMER)
  const c = await clientes.retrieveCustomer(clienteId)
  const ya = c?.metadata?.codigo_recomienda
  if (typeof ya === "string" && ya) return ya
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const base = slug(c.first_name || (c.email || "").split("@")[0]) || "HETNA"
  let codigo = ""
  for (let i = 0; i < 6; i++) {
    const intento = `${base}-${azar(4)}`
    const ocupado = await knex("customer").whereRaw("metadata->>'codigo_recomienda' = ?", [intento]).first("id")
    if (!ocupado) {
      codigo = intento
      break
    }
  }
  if (!codigo) codigo = `HETNA-${azar(8)}`
  await clientes.updateCustomers(clienteId, { metadata: { ...(c.metadata || {}), codigo_recomienda: codigo } })
  return codigo
}

export const ligaRecomienda = (codigo: string) => `${STORE_URL}/mx?ref=${encodeURIComponent(codigo)}`

/**
 * Liga una cuenta recién creada con quien la recomendó. Solo cuentas de menos
 * de 3 días, una sola vez, y nunca consigo mismo.
 */
export async function vincularReferido(scope: Scope, clienteId: string, codigo: string): Promise<boolean> {
  const limpio = String(codigo || "").trim().toUpperCase()
  if (!/^[A-Z0-9-]{4,20}$/.test(limpio)) return false
  const clientes = scope.resolve(Modules.CUSTOMER)
  const c = await clientes.retrieveCustomer(clienteId).catch(() => null)
  if (!c || c.metadata?.referido_por) return false
  if (!c.created_at || Date.now() - new Date(c.created_at).getTime() > 3 * DIA) return false
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const quien = await knex("customer")
    .whereRaw("metadata->>'codigo_recomienda' = ?", [limpio])
    .whereNull("deleted_at")
    .first("id", "email")
  if (!quien || quien.id === c.id) return false
  if (quien.email && c.email && quien.email.toLowerCase() === c.email.toLowerCase()) return false
  await clientes.updateCustomers(clienteId, {
    metadata: { ...(c.metadata || {}), referido_por: quien.id, referido_en: new Date().toISOString() },
  })
  return true
}

export type ResumenRecomienda = {
  codigo: string
  liga: string
  monto: number
  minimo: number
  dias_espera: number
  amigos_registrados: number
  amigos_con_recompensa: number
  cupones: { codigo: string; vence: string | null; usado: boolean; vencido: boolean }[]
  bienvenida: { codigo: string; disponible: boolean }
}

export async function resumenRecomienda(scope: Scope, clienteId: string): Promise<ResumenRecomienda> {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const codigo = await codigoDe(scope, clienteId)
  const [{ n: registrados }] = await knex("customer")
    .whereRaw("metadata->>'referido_por' = ?", [clienteId])
    .whereNull("deleted_at")
    .count("* as n")
  const [{ n: conRecompensa }] = await knex("customer")
    .whereRaw("metadata->>'referido_por' = ?", [clienteId])
    .whereRaw("metadata ? 'recompensa_referido_en'")
    .whereNull("deleted_at")
    .count("* as n")
  const filas = await knex("promotion")
    .whereRaw("metadata->>'cliente_id' = ?", [clienteId])
    .where("code", "like", `${PREFIJO_RECOMPENSA}%`)
    .whereNull("deleted_at")
    .orderBy("created_at", "desc")
    .select("code", "limit", "used", "metadata")
  const clientes = scope.resolve(Modules.CUSTOMER)
  const c = await clientes.retrieveCustomer(clienteId)
  return {
    codigo,
    liga: ligaRecomienda(codigo),
    monto: MONTO(),
    minimo: MINIMO(),
    dias_espera: DIAS_ESPERA(),
    amigos_registrados: Number(registrados) || 0,
    amigos_con_recompensa: Number(conRecompensa) || 0,
    cupones: filas.map((f: any) => {
      const vence = f.metadata?.vence ? String(f.metadata.vence) : null
      return {
        codigo: f.code,
        vence,
        usado: typeof f.limit === "number" && Number(f.used || 0) >= f.limit,
        vencido: !!vence && new Date(vence).getTime() < Date.now(),
      }
    }),
    bienvenida: { codigo: CUPON_BIENVENIDA(), disponible: !(await yaCompro(scope, clienteId, c.email)) },
  }
}

/**
 * Revisa a los amigos recomendados y da la recompensa a quien ya se la ganó.
 * Lo corre jobs/recomienda-recompensas.ts una vez al día.
 */
export async function darRecompensas(scope: Scope): Promise<{ dadas: number; revisados: number }> {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const clientes = scope.resolve(Modules.CUSTOMER)
  const logger = scope.resolve("logger")
  const limite = new Date(Date.now() - DIAS_ESPERA() * DIA)

  const amigos = await knex("customer")
    .whereRaw("metadata ? 'referido_por'")
    .whereRaw("not (metadata ? 'recompensa_referido_en')")
    .whereNull("deleted_at")
    .select("id", "email", "first_name", "metadata")
    .limit(200)

  let dadas = 0
  for (const amigo of amigos) {
    try {
      const { data: ordenes } = await query.graph({
        entity: "order",
        fields: ["id", "status", "created_at", "items.unit_price", "items.quantity", "payment_collections.status"],
        filters: { customer_id: amigo.id },
      })
      const valen = (ordenes || []).filter(
        (o: any) =>
          o.status !== "canceled" &&
          new Date(o.created_at).getTime() <= limite.getTime() &&
          (o.payment_collections || []).some((pc: any) => ["completed", "partially_captured", "authorized"].includes(pc?.status))
      )
      // Pedidos con devolución no cuentan
      if (valen.length) {
        const { data: devoluciones } = await query
          .graph({ entity: "return", fields: ["order_id", "status"], filters: { order_id: valen.map((o: any) => o.id) } })
          .catch(() => ({ data: [] as any[] }))
        const conDevolucion = new Set((devoluciones || []).filter((r: any) => r.status !== "canceled").map((r: any) => r.order_id))
        for (let i = valen.length - 1; i >= 0; i--) if (conDevolucion.has(valen[i].id)) valen.splice(i, 1)
      }
      const comprado = valen.reduce(
        (s: number, o: any) => s + (o.items || []).reduce((t: number, i: any) => t + (Number(i.unit_price) || 0) * (Number(i.quantity) || 0), 0),
        0
      )
      if (comprado < MINIMO()) continue

      const referenteId = String(amigo.metadata.referido_por)
      const referente = await clientes.retrieveCustomer(referenteId).catch(() => null)
      if (!referente?.email) {
        await clientes.updateCustomers(amigo.id, {
          metadata: { ...amigo.metadata, recompensa_referido_en: new Date().toISOString(), recompensa_referido_cupon: null },
        })
        continue
      }

      const inicioAnio = new Date(new Date().getFullYear(), 0, 1)
      const [{ n: esteAnio }] = await knex("promotion")
        .whereRaw("metadata->>'cliente_id' = ?", [referenteId])
        .where("code", "like", `${PREFIJO_RECOMPENSA}%`)
        .where("created_at", ">=", inicioAnio)
        .count("* as n")
      if (Number(esteAnio) >= MAX_RECOMPENSAS_ANIO()) {
        logger.warn(`[recomienda] ${referente.email} llegó al tope de ${MAX_RECOMPENSAS_ANIO()} recompensas del año`)
        continue
      }

      const vence = new Date(Date.now() + DIAS_VIGENCIA() * DIA).toISOString()
      let promo: Promo | null = null
      for (let i = 0; i < 5 && !promo; i++) {
        const code = `${PREFIJO_RECOMPENSA}${azar(6)}`
        if (await buscarPromo(scope, code)) continue
        promo = await crearPromo(scope, {
          code,
          limit: 1,
          metadata: { tipo: "recomienda", lo_paga: "hetna", cliente_id: referenteId, amigo_id: amigo.id, vence },
        })
      }
      if (!promo) continue

      await clientes.updateCustomers(amigo.id, {
        metadata: { ...amigo.metadata, recompensa_referido_en: new Date().toISOString(), recompensa_referido_cupon: promo.code },
      })
      dadas++
      logger.info(`[recomienda] cupón ${promo.code} para ${referente.email} (recomendó a ${amigo.email})`)
      await avisarRecompensa(referente, amigo.first_name, promo.code, vence).catch(() => undefined)
    } catch (e) {
      logger.warn(`[recomienda] amigo ${amigo.id}: ${(e as Error).message}`)
    }
  }
  return { dadas, revisados: amigos.length }
}

async function avisarRecompensa(
  referente: { email: string; first_name?: string | null },
  amigo: string | null | undefined,
  codigo: string,
  vence: string
) {
  const fecha = new Date(vence).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" })
  await sendEmail({
    to: referente.email,
    subject: `¡Ganaste ${pesos(MONTO())} en HETNA CNC por recomendarnos!`,
    html: marco(
      "Gracias por recomendarnos",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${referente.first_name ? `Hola ${esc(referente.first_name)}:` : "Hola:"} ${amigo ? esc(amigo) : "Tu amigo"} ya hizo su primera compra en HETNA CNC con tu liga. Aquí está tu recompensa:</p>` +
        `<p style="margin:16px 0;text-align:center"><span style="display:inline-block;border:2px dashed #C2560A;border-radius:12px;padding:12px 20px;font-size:22px;font-weight:bold;letter-spacing:2px;color:#142033">${esc(codigo)}</span></p>` +
        `<p style="margin:0 0 4px;color:#40403A;line-height:1.5"><strong>${pesos(MONTO())} de descuento</strong> en compras de ${pesos(MINIMO())} o más en productos. Es de un solo uso, solo para tu cuenta, y vence el ${esc(fecha)}.</p>` +
        boton("Usar mi cupón", `${STORE_URL}/mx`) +
        `<p style="margin:16px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">Sigue compartiendo tu liga desde Mi cuenta → Recomienda y gana: ganas un cupón por cada amigo que compre.</p>`
    ),
  })
}
