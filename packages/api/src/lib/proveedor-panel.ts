// Panel de proveedores en hetnacnc.com (Fase 1.4 de docs/analisis-sap-fase0.md).
//
// Un taller da de alta a sus proveedores en la app del Cotizador (Supabase,
// tabla proveedores) y les manda órdenes de compra. El proveedor entra a la
// tienda con una cuenta cuyo correo coincide con el que el taller le puso y
// cuyo correo ya está confirmado (lib/verificar-correo.ts). Ahí ve sólo las
// órdenes que le mandaron (nunca borradores) y puede confirmarlas, dar una
// fecha de entrega y avisar que ya las envió.
//
// Lo que NUNCA sale: inventario, costos internos, clientes ni pedidos del
// taller. De la orden sólo va lo que ya trae el mensaje que el taller le manda
// por WhatsApp (folio, renglones, precios pactados, entrega, notas).
//
// Las columnas proveedor_* las crea supabase/compras_proveedor.sql en el
// repositorio del Cotizador. Si todavía no se corre, el panel muestra las
// órdenes pero sin botones (acciones_activas = false).
import { supa } from "./cotizador-crm"
import { requiereVerificacion } from "./verificar-correo"

export const ESTADOS_VISIBLES = ["enviada", "parcial", "recibida", "cancelada"] as const
const ESTADOS_ACTIVOS = ["enviada", "parcial"]

export const NOMBRE_ESTADO: Record<string, string> = {
  enviada: "Por surtir",
  parcial: "Recibida en parte",
  recibida: "Recibida",
  cancelada: "Cancelada",
}

const CAMPOS_BASE = "id,folio,estado,fecha_entrega,notas,total,enviada_en,recibida_en,created_at,negocios(nombre),orden_compra_items(descripcion,unidad,cantidad,cantidad_recibida,costo_unitario)"
const CAMPOS_PROVEEDOR = "proveedor_confirmada_en,proveedor_fecha_compromiso,proveedor_enviada_en,proveedor_nota"

/** Para PostgREST ilike: escapa los comodines de LIKE y los separadores de filtro. */
export function escaparIlike(correo: string): string {
  return correo.replace(/[\\%_*]/g, (c) => (c === "*" ? "" : `\\${c}`))
}

export const correoValido = (c: string) => /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(c)

/** ¿La cuenta de la tienda puede usarse como proveedor? (correo confirmado) */
export function correoDeProveedor(c: { email?: string | null; has_account?: boolean | null; created_at?: any; metadata?: any; id: string } | null): string | null {
  if (!c?.email) return null
  if (requiereVerificacion({ id: c.id, email: c.email, has_account: c.has_account, created_at: c.created_at, metadata: c.metadata })) return null
  const correo = c.email.trim().toLowerCase()
  return correoValido(correo) ? correo : null
}

export type OrdenProveedor = {
  id: string
  folio: string
  taller: string
  estado: string
  nombre_estado: string
  fecha_entrega: string | null
  notas: string | null
  total: number
  enviada_en: string | null
  recibida_en: string | null
  renglones: { descripcion: string; unidad: string | null; cantidad: number; recibido: number; costo_unitario: number }[]
  confirmada_en: string | null
  fecha_compromiso: string | null
  marcada_enviada_en: string | null
  nota_proveedor: string | null
  puede_confirmar: boolean
  puede_marcar_enviada: boolean
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0)

export function vistaOrden(o: any, accionesActivas: boolean): OrdenProveedor {
  const activa = ESTADOS_ACTIVOS.includes(o.estado)
  return {
    id: String(o.id),
    folio: `OC-${o.folio ?? "?"}`,
    taller: o.negocios?.nombre || "Taller",
    estado: o.estado,
    nombre_estado: NOMBRE_ESTADO[o.estado] || o.estado,
    fecha_entrega: o.fecha_entrega || null,
    notas: o.notas || null,
    total: num(o.total),
    enviada_en: o.enviada_en || null,
    recibida_en: o.recibida_en || null,
    renglones: (o.orden_compra_items || []).map((i: any) => ({
      descripcion: String(i.descripcion || ""),
      unidad: i.unidad || null,
      cantidad: num(i.cantidad),
      recibido: num(i.cantidad_recibida),
      costo_unitario: num(i.costo_unitario),
    })),
    confirmada_en: o.proveedor_confirmada_en || null,
    fecha_compromiso: o.proveedor_fecha_compromiso || null,
    marcada_enviada_en: o.proveedor_enviada_en || null,
    nota_proveedor: o.proveedor_nota || null,
    puede_confirmar: accionesActivas && activa,
    puede_marcar_enviada: accionesActivas && activa && !o.proveedor_enviada_en,
  }
}

/** Ids de proveedores (de cualquier taller) dados de alta con ese correo. */
export async function proveedoresDeCorreo(correo: string): Promise<string[]> {
  const filas = await supa<any[]>(`/rest/v1/proveedores?email=ilike.${encodeURIComponent(escaparIlike(correo))}&activo=eq.true&select=id,email&limit=200`)
  return (filas || []).filter((f) => String(f.email || "").trim().toLowerCase() === correo).map((f) => String(f.id))
}

const faltaColumna = (e: unknown) => /42703|PGRST204|column .* does not exist|Could not find/i.test(String((e as Error)?.message || e))

async function leerOrdenes(filtro: string): Promise<{ filas: any[]; accionesActivas: boolean }> {
  const base = `/rest/v1/ordenes_compra?${filtro}&estado=in.(${ESTADOS_VISIBLES.join(",")})&order=created_at.desc&limit=200`
  try {
    return { filas: await supa<any[]>(`${base}&select=${CAMPOS_BASE},${CAMPOS_PROVEEDOR}`), accionesActivas: true }
  } catch (e) {
    if (!faltaColumna(e)) throw e
    return { filas: await supa<any[]>(`${base}&select=${CAMPOS_BASE}`), accionesActivas: false }
  }
}

export async function ordenesDeProveedor(correo: string) {
  const ids = await proveedoresDeCorreo(correo)
  if (!ids.length) return { es_proveedor: false, acciones_activas: false, ordenes: [] as OrdenProveedor[] }
  const { filas, accionesActivas } = await leerOrdenes(`proveedor_id=in.(${ids.join(",")})`)
  return { es_proveedor: true, acciones_activas: accionesActivas, ordenes: (filas || []).map((o) => vistaOrden(o, accionesActivas)) }
}

export class ErrorProveedor extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export type AccionProveedor = { accion: "confirmar"; fecha_compromiso: string; nota?: string } | { accion: "enviada"; nota?: string }

/** Hoy en México (YYYY-MM-DD) para no aceptar compromisos en el pasado. */
export const hoyMx = (ahora = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(ahora)

export function cambiosDeAccion(a: AccionProveedor, orden: OrdenProveedor, ahora = new Date()): Record<string, unknown> {
  if (a.accion === "confirmar") {
    if (!orden.puede_confirmar) throw new ErrorProveedor("Esta orden ya no se puede confirmar.", 409)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.fecha_compromiso) || Number.isNaN(Date.parse(a.fecha_compromiso))) throw new ErrorProveedor("Pon la fecha en que vas a entregar.")
    if (a.fecha_compromiso < hoyMx(ahora)) throw new ErrorProveedor("La fecha de entrega no puede ser en el pasado.")
    return {
      proveedor_confirmada_en: ahora.toISOString(),
      proveedor_fecha_compromiso: a.fecha_compromiso,
      ...(a.nota !== undefined ? { proveedor_nota: a.nota || null } : {}),
    }
  }
  if (!orden.puede_marcar_enviada) throw new ErrorProveedor(orden.marcada_enviada_en ? "Ya marcaste esta orden como enviada." : "Esta orden ya no se puede marcar como enviada.", 409)
  return {
    proveedor_enviada_en: ahora.toISOString(),
    ...(orden.confirmada_en ? {} : { proveedor_confirmada_en: ahora.toISOString() }),
    ...(a.nota !== undefined ? { proveedor_nota: a.nota || null } : {}),
  }
}

/** Aplica la acción sólo si la orden es de un proveedor con ese correo. */
export async function actuarSobreOrden(correo: string, ordenId: string, a: AccionProveedor) {
  if (!/^[0-9a-f-]{36}$/i.test(ordenId)) throw new ErrorProveedor("Orden inválida.", 404)
  const ids = await proveedoresDeCorreo(correo)
  if (!ids.length) throw new ErrorProveedor("Orden no encontrada.", 404)
  const { filas, accionesActivas } = await leerOrdenes(`id=eq.${ordenId}&proveedor_id=in.(${ids.join(",")})`)
  if (!filas?.length) throw new ErrorProveedor("Orden no encontrada.", 404)
  if (!accionesActivas) throw new ErrorProveedor("El taller todavía no activa las confirmaciones en línea.", 409)
  const orden = vistaOrden(filas[0], true)
  const cambios = cambiosDeAccion(a, orden)
  // El filtro repite proveedor y estado para que nada cambie si la orden se
  // reasignó o se canceló entre la lectura y la escritura.
  const r = await supa<any[]>(`/rest/v1/ordenes_compra?id=eq.${ordenId}&proveedor_id=in.(${ids.join(",")})&estado=in.(${ESTADOS_ACTIVOS.join(",")})`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...cambios, updated_at: new Date().toISOString() }),
  })
  if (!r?.length) throw new ErrorProveedor("La orden cambió mientras tanto. Recarga la página.", 409)
  return vistaOrden({ ...filas[0], ...r[0] }, true)
}
