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
  // Protección del envío: costo = max(minimo, valor × tasa), con valor entre valorMinimo y valorMaximo
  proteccion?: { tasa: number; minimo: number; valorMinimo: number; valorMaximo: number }
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
  acepta_evidencia: boolean
  contenido_estado: "nuevo" | "usado" | ""
  proteccion_valor?: number
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

// ---------- Mis envíos y su evidencia ----------

export type TipoEvidencia = "alto" | "largo" | "ancho" | "bascula" | "contenido" | "extra"
export type EvidenciaResumen = { tipo: TipoEvidencia; nombre: string; subido: string }
export type MiEnvio = {
  folio: string
  estado: "pendiente_pago" | "pagado" | "guia_generada" | "cancelado" | string
  precio: number
  tarifa: OpcionEnvio
  origen: Lugar & { nombre?: string }
  destino: Lugar & { nombre?: string }
  paquete: CotizacionGuardada["paquete"]
  pago_url: string | null
  guia: { numero?: string; url?: string; paqueteria?: string } | null
  proteccion_valor: number | null
  contenido_estado: "nuevo" | "usado" | null
  evidencia: EvidenciaResumen[]
  evidencia_completa: boolean
  created_at: string
}

export type Sobrepeso = {
  folio: string
  referencia: string
  kg_cotizado: number | null
  kg_reportado: number | null
  monto: number
  estado: string
  estado_nombre: string
  pago_url: string | null
  created_at: string
}

const conSesion = async () => (await getAuthHeaders()) as Record<string, string>

export async function misEnvios(): Promise<{ ok: true; envios: MiEnvio[]; sobrepesos: Sobrepeso[] } | { ok: false; login: boolean }> {
  try {
    const auth = await conSesion()
    if (!auth.authorization) return { ok: false, login: true }
    const { res, body } = await llamar("/store/customers/me/envios", { headers: auth })
    if (res.status === 401) return { ok: false, login: true }
    if (!res.ok) return { ok: false, login: false }
    const j = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v)
    return {
      ok: true,
      sobrepesos: body.sobrepesos || [],
      envios: (body.envios || []).map((e: any) => ({ ...e, tarifa: j(e.tarifa), origen: j(e.origen), destino: j(e.destino), paquete: j(e.paquete) })),
    }
  } catch {
    return { ok: false, login: false }
  }
}

export async function verEvidencia(folio: string): Promise<{ tipo: TipoEvidencia; nombre: string; subido: string; url: string | null }[]> {
  try {
    const { res, body } = await llamar(`/store/customers/me/envios/${encodeURIComponent(folio)}/evidencia`, { headers: await conSesion() })
    return res.ok ? body.evidencia || [] : []
  } catch {
    return []
  }
}

export async function guardarEvidencia(
  folio: string,
  d: { tipo: TipoEvidencia; clave: string; nombre: string; tamano: number }
): Promise<{ ok: true; evidencia: EvidenciaResumen[]; completa: boolean } | { ok: false; mensaje: string }> {
  try {
    const { res, body } = await llamar(`/store/customers/me/envios/${encodeURIComponent(folio)}/evidencia`, {
      method: "POST",
      body: JSON.stringify(d),
      headers: await conSesion(),
    })
    if (!res.ok) return { ok: false, mensaje: body.message || "No pudimos guardar la foto." }
    return { ok: true, evidencia: body.evidencia, completa: body.completa }
  } catch {
    return { ok: false, mensaje: "No pudimos guardar la foto. Intenta de nuevo." }
  }
}
