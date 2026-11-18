"use server"

// Servicio de muebles con créditos: descargar los archivos de un mueble del
// constructor de ensamble y diseñar desde una imagen con IA.
// Ver packages/api/src/api/store/muebles/*.

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

const encabezados = async () => ({
  "Content-Type": "application/json",
  "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
  ...((await getAuthHeaders()) as Record<string, string>),
})

export type Fallo = { ok: false; mensaje: string; noAutenticado?: boolean; saldoInsuficiente?: boolean }

async function llamar<T>(ruta: string, cuerpo: unknown): Promise<({ ok: true } & T) | Fallo> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return { ok: false, mensaje: "Inicia sesión para usar tus créditos.", noAutenticado: true }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, { method: "POST", headers: await encabezados(), body: JSON.stringify(cuerpo), cache: "no-store" })
    if (res.status === 401) return { ok: false, mensaje: "Tu sesión expiró. Vuelve a iniciar sesión.", noAutenticado: true }
    const datos = (await res.json().catch(() => null)) as ({ ok?: boolean; mensaje?: string; saldoInsuficiente?: boolean } & T) | null
    if (!res.ok || !datos?.ok) return { ok: false, mensaje: datos?.mensaje || "No se pudo completar. Intenta de nuevo.", saldoInsuficiente: !!datos?.saldoInsuficiente }
    return { ...datos, ok: true }
  } catch (e) {
    console.error(`[muebles] ${ruta}`, e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor." }
  }
}

// Cobra la descarga de un diseño (el mismo diseño no se cobra dos veces en 24 h)
export async function cobrarDescargaMueble(clave: string, descripcion: string) {
  return llamar<{ cobrado: number; saldo: number | null }>("/store/muebles/descarga", { clave, descripcion: descripcion.slice(0, 200) })
}

export type LecturaMueble = {
  tipo: "exhibidor" | "otro"
  ancho: number | null
  fondoGabinete: number | null
  fondoRepisas: number | null
  altoGabinete: number | null
  repisas: number | null
  espacioSobreGabinete: number | null
  separacion: number | null
  sobreUltima: number | null
  divisores: "ninguno" | "abajo" | "arriba" | "ambos" | null
  numDivisores: number | null
  altoDivisor: number | null
  barrote: number | null
  confianza: "alta" | "media" | "baja"
  notas: string
}

// Lee un mueble de una imagen (JPEG en base64, ya reducida en el navegador)
export async function disenarMuebleDesdeImagen(imagen: string, medio: "image/jpeg" | "image/png" | "image/webp") {
  if (imagen.length > 950_000) return { ok: false, mensaje: "La imagen es muy grande." } as Fallo
  return llamar<{ lectura: LecturaMueble; cobrado: number; saldo: number | null }>("/store/muebles/imagen", { imagen, medio })
}

export type LecturaTableros = {
  tipo: "tableros" | "no_tableros"
  nombre: string
  grosor: number
  tableros: { nombre: string; plano: "lateral" | "horizontal" | "frontal"; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[]
  confianza: "alta" | "media" | "baja"
  notas: string
}

// Convierte la imagen de cualquier mueble de tableros en una lista de tableros
// a escala (2 créditos; se regresan si la imagen no sirve)
export async function disenarTablerosDesdeImagen(imagen: string, medio: "image/jpeg" | "image/png" | "image/webp") {
  if (imagen.length > 950_000) return { ok: false, mensaje: "La imagen es muy grande." } as Fallo
  return llamar<{ lectura: LecturaTableros; cobrado: number; saldo: number | null }>("/store/muebles/tableros", { imagen, medio })
}
