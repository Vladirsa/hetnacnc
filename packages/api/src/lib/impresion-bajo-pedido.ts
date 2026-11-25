// Impresión 3D bajo pedido: diseños de HETNA (hechos con las herramientas de
// Diseñar) que cualquier taller con impresora puede vender impresos.
//
// Cómo está armado (modelo de ofertas de Mercur):
//   - Cada diseño es un PRODUCTO MAESTRO en la colección "Impresión 3D bajo
//     pedido", con una variante por material (PLA, PETG, ABS, PLA-CF, TPU,
//     resina). El producto guarda el volumen y las medidas de la pieza, y la
//     liga a la herramienta para bajarlo gratis o cambiarle las medidas.
//   - Cada taller que lo imprime pone su OFERTA en las variantes (materiales)
//     que maneja: su precio, en cuántos días hábiles lo deja listo
//     (leadtime_to_ship) y qué colores tiene (metadata.colores). HETNA es un
//     taller más. El cliente compara y compra la oferta que quiera.
//   - Precio recomendado: el mismo motor de /store/precio-instantaneo con el
//     volumen real de la pieza, ya con IVA (en la tienda se cobra el precio
//     final). Es una referencia; cada taller pone el suyo.
//   - "Destacado": el taller paga $150 por 30 días (Mercado Pago, mismo flujo
//     que la verificación) y sale primero, con insignia, en todas las fichas
//     de impresión bajo pedido donde tenga oferta.
import { randomBytes } from "crypto"

import { STORE_URL, VENDOR_URL } from "./licitacion"
import { precioInstantaneo } from "./precio-instantaneo"

export const COLECCION_IMPRESION = "impresion-3d-bajo-pedido"
export const TITULO_COLECCION_IMPRESION = "Impresión 3D bajo pedido"

/** Materiales (valores de la opción "Material" de cada producto) y su nombre en el precio en vivo. */
export const MATERIALES_IMPRESION: { valor: string; precio: string; nota: string }[] = [
  { valor: "PLA", precio: "PLA", nota: "El más común: buen detalle, muchos colores." },
  { valor: "PETG", precio: "PETG", nota: "Más resistente a golpes, agua y sol." },
  { valor: "ABS", precio: "ABS", nota: "Aguanta más calor; buen acabado lijado." },
  { valor: "PLA-CF", precio: "PLA-CF", nota: "PLA con fibra de carbono: rígido y mate." },
  { valor: "TPU", precio: "TPU (flexible)", nota: "Flexible, como hule." },
  { valor: "Resina", precio: "Resina", nota: "Detalle muy fino (impresora de resina)." },
]
export const OPCION_MATERIAL = "Material"

export const MAX_DIAS = 30
export const MAX_COLORES = 12

// ── Destacado ────────────────────────────────────────────────────────────
export const PRECIO_DESTACADO = Number(process.env.PRECIO_DESTACADO_IMPRESION) || 150
export const DIAS_DESTACADO = 30
export const CLAVE_DESTACADO = "destacado_impresion" // en seller.metadata (protegida: sólo la escribe el pago)

type Meta = Record<string, any>
const meta = (s: any): Meta => (s?.metadata && typeof s.metadata === "object" ? s.metadata : {})

/** Hasta cuándo está destacado el taller (null si nunca o ya venció). */
export function destacadoHasta(seller: any, ahora = Date.now()): string | null {
  const hasta = meta(seller)[CLAVE_DESTACADO]?.hasta
  const t = hasta ? Date.parse(String(hasta)) : NaN
  return Number.isFinite(t) && t > ahora ? new Date(t).toISOString() : null
}

/** Nuevo vencimiento al pagar: 30 días desde hoy o desde que vence el actual (se suman). */
export function extenderDestacado(hastaActual: string | null, ahora = Date.now()): string {
  const base = hastaActual ? Math.max(ahora, Date.parse(hastaActual) || 0) : ahora
  return new Date(base + DIAS_DESTACADO * 86_400_000).toISOString()
}

// ── Datos de la pieza y precio recomendado ───────────────────────────────
export type DatosPieza = { volumen_cm3: number; medidas_mm: [number, number, number] }

/** Lo que el producto guarda de la pieza (metadata.impresion), validado. */
export function datosPieza(producto: any): DatosPieza | null {
  const d = meta(producto).impresion
  const v = Number(d?.volumen_cm3)
  const m = Array.isArray(d?.medidas_mm) ? d.medidas_mm.map(Number) : []
  if (!(v > 0) || m.length !== 3 || !m.every((x: number) => x > 0)) return null
  return { volumen_cm3: v, medidas_mm: [m[0], m[1], m[2]] }
}

/** Gramos de filamento de la pieza (sin soportes), con la densidad del material. */
export function gramosPieza(volumenCm3: number, material: string, relleno = 20): number {
  const densidad: Record<string, number> = { PLA: 1.24, PETG: 1.27, ABS: 1.04, "PLA-CF": 1.3, TPU: 1.21, Resina: 1.1 }
  // mismo criterio que el estimador: paredes + relleno ≈ volumen × (relleno + 25 %)
  const fraccion = Math.min(1, relleno / 100 + 0.25)
  return Math.round(volumenCm3 * fraccion * (densidad[material] ?? 1.24))
}

/** Precio recomendado al cliente para una pieza en un material: precio FINAL (con IVA,
 *  como se cobra en la tienda), redondeado a $10. */
export function precioRecomendado(p: DatosPieza, material: string): number | null {
  const m = MATERIALES_IMPRESION.find((x) => x.valor === material)
  if (!m) return null
  const [x, y, z] = p.medidas_mm
  const r = precioInstantaneo({
    servicio: "impresion_3d",
    material: m.precio,
    ancho: x / 10,
    largo: y / 10,
    alto: z / 10,
    cantidad: 1,
    calidad: "Pieza funcional",
    volumen_cm3: p.volumen_cm3,
  })
  if (!r.ok) return null
  return Math.max(10, Math.ceil(r.resultado.total / 10) * 10)
}

// ── Lo que el taller manda para su oferta ────────────────────────────────
export type OfertaTaller = { variant_id: string; activa: boolean; precio: number; dias: number; colores: string[] }

export class ErrorImpresion extends Error {}

/** Limpia y revisa una oferta del taller. Lanza ErrorImpresion con el motivo. */
export function validarOferta(o: any): OfertaTaller {
  const variant_id = String(o?.variant_id || "").trim()
  if (!/^variant_[A-Za-z0-9]+$/.test(variant_id)) throw new ErrorImpresion("Falta el material.")
  const activa = o?.activa !== false
  const precio = Math.round(Number(String(o?.precio ?? "").replace(",", ".")) * 100) / 100
  const dias = Math.round(Number(o?.dias))
  const colores = (Array.isArray(o?.colores) ? o.colores : String(o?.colores || "").split(","))
    .map((c: unknown) => String(c || "").replace(/\s+/g, " ").trim().slice(0, 24))
    .filter(Boolean)
    .filter((c: string, i: number, a: string[]) => a.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i)
    .slice(0, MAX_COLORES)
  if (activa) {
    if (!(precio >= 10) || precio > 200_000) throw new ErrorImpresion("Escribe el precio en pesos (mínimo $10).")
    if (!(dias >= 1) || dias > MAX_DIAS) throw new ErrorImpresion(`Los días para dejarlo listo van de 1 a ${MAX_DIAS}.`)
    if (!colores.length) throw new ErrorImpresion("Escribe al menos un color (por ejemplo: Negro).")
  }
  return { variant_id, activa, precio, dias: dias >= 1 ? dias : 1, colores }
}

/** Lo que la ficha enseña de una oferta: colores y días, leídos de la oferta. */
export function datosDeOferta(oferta: any): { colores: string[]; dias: number | null } {
  const m = meta(oferta)
  const colores = Array.isArray(m.colores) ? m.colores.map((c: unknown) => String(c)).filter(Boolean).slice(0, MAX_COLORES) : []
  const dias = Number(oferta?.leadtime_to_ship)
  return { colores, dias: dias >= 1 ? dias : null }
}

/** Orden de la lista de talleres: destacados primero, luego el precio más bajo, luego menos días. */
export function ordenarOfertas<T extends { destacado: boolean; precio: number | null; dias: number | null }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.destacado !== b.destacado) return a.destacado ? -1 : 1
    const pa = a.precio ?? Infinity, pb = b.precio ?? Infinity
    if (pa !== pb) return pa - pb
    return (a.dias ?? 99) - (b.dias ?? 99)
  })
}

// ── Pago del destacado (Mercado Pago) ────────────────────────────────────
const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""
const API = (process.env.COTIZADOR_API_URL || `${STORE_URL}/api`).replace(/\/$/, "")

async function mp(ruta: string, init: RequestInit = {}) {
  const res = await fetch(`${MP_API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${cuerpo?.message || cuerpo?.error || ""}`)
  return cuerpo
}

const refDestacado = (sellerId: string) => `destpago:${sellerId}:${randomBytes(4).toString("hex")}`
export const leerRefDestacado = (r: unknown): string | null => {
  const m = /^destpago:([A-Za-z0-9_]{4,80}):[a-f0-9]{8}$/.exec(String(r || ""))
  return m ? m[1] : null
}

export async function ligaPagoDestacado(seller: any): Promise<string> {
  if (!mpToken()) throw Object.assign(new Error("El pago con Mercado Pago no está disponible ahora. Intenta más tarde."), { status: 503 })
  const pagina = `${VENDOR_URL}/imprimir`
  const pref = await mp("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: "destacado-impresion",
          title: `Taller destacado en Impresión 3D bajo pedido (${DIAS_DESTACADO} días)`,
          quantity: 1,
          currency_id: "MXN",
          unit_price: PRECIO_DESTACADO,
        },
      ],
      payer: seller.email ? { email: seller.email } : undefined,
      external_reference: refDestacado(seller.id),
      notification_url: `${API}/mp-destacado`,
      back_urls: { success: `${pagina}?pago=ok`, pending: `${pagina}?pago=ok`, failure: `${pagina}?pago=error` },
      auto_return: "approved",
      statement_descriptor: "HETNA DESTACADO",
      metadata: { tipo: "destacado_impresion", seller_id: seller.id },
    }),
  })
  const url = pref.init_point || pref.sandbox_init_point
  if (!url) throw new Error("Mercado Pago no devolvió la liga")
  return url
}

/** Revisa el pago con Mercado Pago (nunca confía en el navegador). Idempotente: un pago suma 30 días una sola vez. */
export async function confirmarPagoDestacado(knex: any, pagoId: string, logger?: any): Promise<{ ok: boolean; sellerId: string | null; hasta?: string; motivo?: string }> {
  if (!/^\d{5,24}$/.test(String(pagoId)) || !mpToken()) return { ok: false, sellerId: null, motivo: "pago inválido" }
  const p = await mp(`/v1/payments/${pagoId}`)
  const sellerId = leerRefDestacado(p.external_reference)
  if (!sellerId) return { ok: false, sellerId: null, motivo: "no es un pago de destacado" }
  if (p.status !== "approved") return { ok: false, sellerId, motivo: "El pago todavía no se aprueba." }
  if (Number(p.transaction_amount) < PRECIO_DESTACADO || p.currency_id !== "MXN") return { ok: false, sellerId, motivo: "monto distinto" }
  const s = await knex("seller").where({ id: sellerId }).first("id", "metadata")
  if (!s) return { ok: false, sellerId: null, motivo: "taller no encontrado" }
  const actual = meta(s)[CLAVE_DESTACADO] || {}
  const pagos: string[] = Array.isArray(actual.pagos) ? actual.pagos : []
  if (pagos.includes(`mp:${pagoId}`)) return { ok: true, sellerId, hasta: actual.hasta }
  const hasta = extenderDestacado(destacadoHasta(s))
  const nuevo = { hasta, desde: actual.desde && destacadoHasta(s) ? actual.desde : new Date().toISOString(), pagos: [...pagos, `mp:${pagoId}`].slice(-24) }
  await knex.raw(`update seller set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb, updated_at = now() where id = ?`, [
    JSON.stringify({ [CLAVE_DESTACADO]: nuevo }),
    sellerId,
  ])
  logger?.info?.(`[destacado] ${sellerId} destacado hasta ${hasta} (mp:${pagoId})`)
  return { ok: true, sellerId, hasta }
}
