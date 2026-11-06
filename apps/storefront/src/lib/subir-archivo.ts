// Subida de un archivo al bucket privado, desde el navegador, con avance.
//
// Primero intenta la subida DIRECTA a Backblaze: pide un boleto a
// /store/solicitud-archivos/boleto (vía /api/solicitud-archivo/boleto) y
// manda los bytes a B2 sin pasar por nuestros servidores. Así caben modelos
// de hasta 500 MB. Si el boleto o B2 fallan (por ejemplo, faltan las reglas
// CORS del bucket) y el archivo pesa 50 MB o menos, se sube por el servidor
// como antes (/api/solicitud-archivo).
//
// XHR y no fetch: fetch no informa el avance de una subida, y con un STEP de
// 200 MB en datos móviles una barra quieta parece formulario trabado.
//
// destino "taller" guarda en la carpeta de portafolios de talleres; "envio",
// en la de evidencia de Envíos HETNA; sin destino, en la de solicitudes.
import { MAX_MB_ARCHIVO_SERVIDOR } from "@/lib/fabricacion/opciones"

export type ArchivoGuardado = { clave: string; nombre: string; tamano: number }
type Destino = "taller" | "envio" | undefined

type Boleto = { url: string; token: string; nombre_b2: string; clave: string; nombre: string; tamano: number }

// B2 exige el SHA-1 del archivo (o "do_not_verify"). Hasta 150 MB se
// calcula aquí; más grande, se confía en TLS para no cargar todo en memoria.
async function sha1(archivo: File): Promise<string> {
  if (archivo.size > 150 * 1024 * 1024 || !globalThis.crypto?.subtle) return "do_not_verify"
  try {
    const h = await crypto.subtle.digest("SHA-1", await archivo.arrayBuffer())
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("")
  } catch {
    return "do_not_verify"
  }
}

function xhrSubir(
  abrir: (xhr: XMLHttpRequest) => void,
  cuerpo: Document | XMLHttpRequestBodyInit,
  alAvanzar: (n: number) => void
): Promise<{ status: number; texto: string }> {
  return new Promise((ok, mal) => {
    const xhr = new XMLHttpRequest()
    abrir(xhr)
    xhr.upload.onprogress = (e) => e.lengthComputable && alAvanzar(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => ok({ status: xhr.status, texto: xhr.responseText })
    xhr.onerror = () => mal(new Error("Se cortó la conexión. Intenta de nuevo."))
    xhr.send(cuerpo)
  })
}

async function subirDirecto(archivo: File, alAvanzar: (n: number) => void, destino: Destino): Promise<ArchivoGuardado> {
  const r = await fetch("/api/solicitud-archivo/boleto", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nombre: archivo.name, tamano: archivo.size, destino }),
  })
  const b = (await r.json().catch(() => ({}))) as Partial<Boleto> & { message?: string }
  if (!r.ok || !b.url || !b.token || !b.clave) {
    // 400/413 son del archivo (tipo o tamaño): no tiene caso reintentar por el servidor
    throw Object.assign(new Error(b.message || "No se pudo preparar la subida."), { definitivo: r.status === 400 || r.status === 413 })
  }
  const hash = await sha1(archivo)
  const res = await xhrSubir(
    (xhr) => {
      xhr.open("POST", b.url!)
      xhr.setRequestHeader("Authorization", b.token!)
      xhr.setRequestHeader("X-Bz-File-Name", b.nombre_b2!)
      xhr.setRequestHeader("Content-Type", archivo.type || "b2/x-auto")
      xhr.setRequestHeader("X-Bz-Content-Sha1", hash)
    },
    archivo,
    alAvanzar
  )
  if (res.status < 200 || res.status >= 300) throw new Error(`Backblaze respondió ${res.status}`)
  return { clave: b.clave, nombre: b.nombre || archivo.name, tamano: b.tamano || archivo.size }
}

async function subirPorServidor(archivo: File, alAvanzar: (n: number) => void, destino: Destino): Promise<ArchivoGuardado> {
  if (archivo.size > MAX_MB_ARCHIVO_SERVIDOR * 1024 * 1024) {
    throw new Error(`No se pudo subir directo y por el servidor el tope es ${MAX_MB_ARCHIVO_SERVIDOR} MB. Intenta de nuevo o comprímelo en ZIP.`)
  }
  const fd = new FormData()
  if (destino) fd.append("destino", destino)
  fd.append("archivo", archivo)
  const res = await xhrSubir((xhr) => xhr.open("POST", "/api/solicitud-archivo"), fd, alAvanzar)
  let cuerpo: { clave?: string; nombre?: string; tamano?: number; message?: string } = {}
  try {
    cuerpo = JSON.parse(res.texto)
  } catch {}
  if (res.status >= 200 && res.status < 300 && cuerpo.clave) {
    return { clave: cuerpo.clave, nombre: cuerpo.nombre || archivo.name, tamano: cuerpo.tamano || archivo.size }
  }
  throw new Error(cuerpo.message || "No se pudo subir.")
}

export async function subirArchivo(archivo: File, alAvanzar: (n: number) => void, destino?: Destino): Promise<ArchivoGuardado> {
  try {
    return await subirDirecto(archivo, alAvanzar, destino)
  } catch (e) {
    if ((e as { definitivo?: boolean }).definitivo) throw e
    console.warn("[subir-archivo] directa falló, se intenta por el servidor:", (e as Error).message)
    alAvanzar(0)
    return subirPorServidor(archivo, alAvanzar, destino)
  }
}
