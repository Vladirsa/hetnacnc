"use server"

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export type InfoCP = { cp: string; estado: string; municipio: string; ciudad: string; colonias: { nombre: string; tipo: string }[] }
export type OpcionEnvio = {
  tarifa_id: string
  paqueteria: string
  servicio: string
  dias: number | null
  precio: number
  recoleccion: boolean
  llevar_sucursal: boolean
  entrega_domicilio: boolean
  entrega_sucursal: boolean
}
export type ResultadoEnvio =
  | { ok: true; cotizacion_id?: string; opciones: OpcionEnvio[]; volumetrico: number; peso_cobrado?: number; aviso?: string }
  | { ok: false; mensaje: string }

export type DatosCotizacion = {
  cp_origen: string
  colonia_origen: string
  cp_destino: string
  colonia_destino: string
  tipo: string
  peso: string
  largo: string
  ancho: string
  alto: string
}

const llamar = async (ruta: string, init: RequestInit = {}) => {
  const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-publishable-api-key": PK, ...(init.headers || {}) },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

export async function buscarCP(cp: string): Promise<{ ok: true; info: InfoCP } | { ok: false; mensaje: string }> {
  if (!/^\d{5}$/.test(cp)) return { ok: false, mensaje: "El código postal debe tener 5 dígitos." }
  try {
    const { res, body } = await llamar(`/store/envios/cp/${cp}`)
    if (!res.ok) return { ok: false, mensaje: body.message || "No encontramos ese código postal." }
    return { ok: true, info: body }
  } catch {
    return { ok: false, mensaje: "No pudimos consultar el código postal." }
  }
}

export async function cotizarEnvio(d: DatosCotizacion): Promise<ResultadoEnvio> {
  try {
    const { res, body } = await llamar("/store/envios/cotizar", { method: "POST", body: JSON.stringify(d) })
    if (!res.ok) return { ok: false, mensaje: body.message || "No pudimos cotizar. Intenta de nuevo." }
    return { ok: true, cotizacion_id: body.cotizacion_id, opciones: body.opciones || [], volumetrico: body.volumetrico, peso_cobrado: body.peso_cobrado, aviso: body.message }
  } catch {
    return { ok: false, mensaje: "No pudimos cotizar. Intenta de nuevo." }
  }
}

export type Lugar = { cp: string; estado: string; municipio: string; colonia: string }
export type CotizacionGuardada = {
  cotizacion_id: string
  origen: Lugar
  destino: Lugar
  paquete: { tipo: string; peso: number; largo: number; ancho: number; alto: number; peso_cobrado: number }
  opcion: OpcionEnvio
  vencida: boolean
}

export async function verCotizacion(id: string, tarifa: string): Promise<CotizacionGuardada | { error: string }> {
  try {
    const { res, body } = await llamar(`/store/envios/cotizacion/${encodeURIComponent(id)}?t=${encodeURIComponent(tarifa)}`)
    if (!res.ok) return { error: body.message || "Cotización no encontrada." }
    return body
  } catch {
    return { error: "No pudimos cargar la cotización." }
  }
}

export type ContactoEnvio = { nombre: string; telefono: string; email: string; calle: string; referencias?: string; empresa?: string }

export async function solicitarEnvio(d: {
  cotizacion_id: string
  tarifa_id: string
  origen: ContactoEnvio
  destino: ContactoEnvio
  contenido: string
  acepta: boolean
}): Promise<{ ok: true; folio: string; pago_url: string } | { ok: false; mensaje: string; login?: boolean }> {
  try {
    const auth = (await getAuthHeaders()) as Record<string, string>
    if (!auth.authorization) return { ok: false, login: true, mensaje: "Inicia sesión para solicitar tu envío." }
    const { res, body } = await llamar("/store/customers/me/envios", { method: "POST", body: JSON.stringify(d), headers: auth })
    if (res.status === 401) return { ok: false, login: true, mensaje: "Tu sesión venció. Inicia sesión de nuevo." }
    if (!res.ok) return { ok: false, mensaje: body.message || "No pudimos registrar tu envío." }
    return { ok: true, folio: body.folio, pago_url: body.pago_url }
  } catch {
    return { ok: false, mensaje: "No pudimos registrar tu envío. Intenta de nuevo." }
  }
}
