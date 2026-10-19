"use server"

// Capa de datos del cotizador del taller: habla con las rutas
// /store/cotizador/* del backend, que son las que viven en el módulo
// cotizador (packages/api/src/modules/cotizador).
//
// Nada de SQL aquí. El cotizador viejo (lib/taller/acciones.ts) abre su propio
// Pool contra otra base y calcula el plan y el folio en el storefront; eso
// quedó como el camino a retirar. Todo lo que se agregue de cotizador va por
// estas rutas, que son las mismas que va a consumir la app móvil.
//
// Las rutas exigen sesión de cliente de la tienda (authenticate("customer")),
// así que cada llamada manda el Bearer de la cookie _medusa_jwt. Si no hay
// sesión no se llama al backend: se responde no_autenticado para que la
// pantalla mande al login en vez de tragarse un 401.

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Respuesta<T> =
  | { ok: true; datos: T }
  | { ok: false; mensaje: string; noAutenticado?: boolean }

async function pedir<T>(
  ruta: string,
  opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {}
): Promise<Respuesta<T>> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, {
      method: opciones.metodo || "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        ...auth,
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      // Datos de un taller en particular: cachearlos le mostraría a un taller
      // las cotizaciones de otro.
      cache: "no-store",
    })

    const cuerpo = await res.json().catch(() => ({}) as Record<string, unknown>)

    if (res.status === 401) {
      return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    }
    if (!res.ok) {
      return {
        ok: false,
        mensaje: (cuerpo as { message?: string }).message || "No se pudo completar la operación.",
      }
    }
    return { ok: true, datos: cuerpo as T }
  } catch (e) {
    console.error(`[cotizador] falló ${opciones.metodo || "GET"} ${ruta}`, e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor. Intenta de nuevo." }
  }
}

// --- Perfil del taller ---

export type TallerPerfil = {
  id: string
  nombre_comercial: string
  nombre_contacto: string | null
  razon_social: string | null
  rfc: string | null
  direccion: string | null
  ciudad: string | null
  estado: string | null
  cp: string | null
  pais: string | null
  telefono: string | null
  whatsapp: string | null
  correo: string | null
  sitio_web: string | null
  logo_url: string | null
  moneda: "MXN" | "USD" | "EUR"
  iva_pct: number
  vigencia_dias: number
  costo_hora_taller: number
  costo_hora_maquina: number
  costo_hora_operador: number
  margen_minimo: number
  margen_recomendado: number
  folio_prefijo: string
  terminos_estandar: string | null
  condiciones_pago_default: string | null
  dias_entrega_default: number | null
  firma_nombre: string | null
  firma_puesto: string | null
}

// limite null = sin tope (plan de paga o prueba vigente).
export type ResumenPlan = {
  plan: "gratis" | "prueba" | "taller" | "pro" | "industrial"
  usadas: number
  limite: number | null
  prueba_dias: number
}

export async function cargarPerfil() {
  return pedir<{ perfil: TallerPerfil | null; plan: ResumenPlan | null }>("/store/cotizador/perfil")
}

export async function guardarPerfil(cambios: Partial<TallerPerfil>) {
  return pedir<{ perfil: TallerPerfil }>("/store/cotizador/perfil", {
    metodo: "POST",
    cuerpo: cambios,
  })
}

// --- Catálogo de servicios del motor ---

export type ServicioCatalogo = { clave: string; nombre: string; emoji?: string; tipos: string[] }

export async function cargarServicios() {
  return pedir<{ servicios: ServicioCatalogo[] }>("/store/cotizador/servicios")
}

// --- Calculadora (no guarda nada) ---

export type ResultadoCalculo = {
  servicio: string
  emoji?: string
  descripcion: string
  total: number
  subtotal: number
  iva: number
  costoTotal: number
  pvMinimo: number
  pvRecomendado: number
  pvPremium: number
  utilidad: number
  margenReal: number
  gananciaHora: number
  tiempoHoras: number
  costosDesglose: Record<string, number>
  detalle: Record<string, number>
  incluyeIva: boolean
  materialNombre: string
}

export async function calcularPrecio(entrada: Record<string, unknown>) {
  return pedir<{ resultado: ResultadoCalculo; usando_costos_propios: boolean }>(
    "/store/cotizador/calcular",
    { metodo: "POST", cuerpo: entrada }
  )
}

// --- Cotizaciones ---

export type Cotizacion = {
  id: string
  folio: string
  revision: string
  moneda: string
  fecha: string
  validez_hasta: string | null
  cliente_nombre: string
  cliente_empresa: string | null
  cliente_telefono: string | null
  cliente_correo: string | null
  proyecto_referencia: string | null
  subtotal: number
  descuento: number
  iva: number
  envio: number
  total: number
  estatus: "borrador" | "enviada" | "vista" | "aceptada" | "rechazada" | "vencida"
  token_publico: string | null
  enviada_en: string | null
  created_at: string
}

export type Partida = {
  id: string
  posicion: number
  concepto: string
  descripcion: string | null
  cantidad: number
  unidad: string
  precio_unitario: number
  subtotal: number
}

export async function listarCotizaciones(opciones: { estatus?: string; limite?: number } = {}) {
  const query = new URLSearchParams()
  if (opciones.estatus) query.set("estatus", opciones.estatus)
  if (opciones.limite) query.set("limit", String(opciones.limite))
  const sufijo = query.toString() ? `?${query}` : ""
  return pedir<{ cotizaciones: Cotizacion[]; count: number }>(
    `/store/cotizador/cotizaciones${sufijo}`
  )
}

export async function cargarCotizacion(id: string) {
  return pedir<{ cotizacion: Cotizacion; partidas: Partida[] }>(
    `/store/cotizador/cotizaciones/${encodeURIComponent(id)}`
  )
}

// cobro dice si esta cotización entró en el tope gratis del mes o si consumió
// créditos del monedero, para poder avisarlo en pantalla. Trae el estado del
// plan YA con la recién emitida contada, así que `usadas` sirve directo para
// "3 de 10 este mes" sin volver a pedir el perfil.
export type Cobro = {
  cobrar: boolean
  creditos: number
  plan: ResumenPlan["plan"]
  limite: number | null
  usadas: number
  prueba_dias: number
}

export async function crearCotizacion(cuerpo: Record<string, unknown>) {
  return pedir<{ cotizacion: Cotizacion; cobro: Cobro }>("/store/cotizador/cotizaciones", {
    metodo: "POST",
    cuerpo,
  })
}

export async function enviarCotizacion(id: string) {
  return pedir<{
    cotizacion_id: string
    folio: string
    url_publica: string | null
    whatsapp_url: string
  }>(`/store/cotizador/cotizaciones/${encodeURIComponent(id)}/enviar`, { metodo: "POST" })
}
