// Archivos del Cotizador en el bucket privado "solicitudes" de su Supabase.
// La ruta empieza con el id del taller: así la política de Storage
// (supabase/cotizador_en_linea.sql) deja que sólo ese taller los lea desde la app.
const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""

export const BUCKET = "solicitudes"

/** Nombre de archivo seguro para la ruta (sin acentos, espacios ni diagonales). */
export function nombreSeguro(original: string, respaldo = "archivo") {
  const limpio = String(original || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-80)
  return limpio || respaldo
}

export const extension = (nombre: string) => (String(nombre || "").split(".").pop() || "").toLowerCase()

export async function subirArchivo(ruta: string, buffer: Buffer, tipo?: string) {
  const r = await fetch(`${supaUrl()}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: {
      apikey: supaKey(),
      Authorization: `Bearer ${supaKey()}`,
      "Content-Type": tipo || "application/octet-stream",
      "x-upsert": "false",
    },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(60_000),
  })
  if (!r.ok) throw new Error(`Storage ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

/** Liga temporal para descargar un archivo privado. null si falla. */
export async function ligaFirmada(ruta: string, segundos = 3600): Promise<string | null> {
  try {
    const r = await fetch(`${supaUrl()}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
      method: "POST",
      headers: { apikey: supaKey(), Authorization: `Bearer ${supaKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: segundos }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) return null
    const d = (await r.json()) as { signedURL?: string }
    return d.signedURL ? `${supaUrl()}/storage/v1${d.signedURL}` : null
  } catch {
    return null
  }
}

/** Freno por IP en memoria: máximo `max` veces en `ventanaMs`. */
export function limitador(max: number, ventanaMs: number) {
  const visitas = new Map<string, number[]>()
  return (clave: string) => {
    const ahora = Date.now()
    const lista = (visitas.get(clave) || []).filter((t) => ahora - t < ventanaMs)
    if (lista.length >= max) return false
    lista.push(ahora)
    visitas.set(clave, lista)
    if (visitas.size > 5000) for (const [k, v] of visitas) if (!v.some((t) => ahora - t < ventanaMs)) visitas.delete(k)
    return true
  }
}
