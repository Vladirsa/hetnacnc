// Subida de un archivo al bucket privado, desde el navegador, con avance.
//
// Siempre por el servidor (/api/solicitud-archivo → POST /store/solicitud-archivos),
// que revisa el contenido real, los ZIP y el antivirus antes de guardarlo. La
// subida directa a Backblaze se quitó: el token que usaba servía para escribir
// cualquier archivo del bucket y se saltaba esas revisiones.
//
// XHR y no fetch: fetch no informa el avance de una subida, y con un STEP de
// 100 MB en datos móviles una barra quieta parece formulario trabado.
//
// destino "taller" guarda en la carpeta de portafolios de talleres; "envio",
// en la de evidencia de Envíos HETNA; sin destino, en la de solicitudes.
import { MAX_MB_ARCHIVO_SERVIDOR } from "@/lib/fabricacion/opciones"

export type ArchivoGuardado = { clave: string; nombre: string; tamano: number }
type Destino = "taller" | "envio" | undefined

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
    xhr.onerror = () => mal(new Error(xhr.status ? `error ${xhr.status}` : "el navegador bloqueó la petición (CORS) o se cortó la conexión"))
    xhr.send(cuerpo)
  })
}

export async function subirArchivo(archivo: File, alAvanzar: (n: number) => void, destino?: Destino): Promise<ArchivoGuardado> {
  if (archivo.size > MAX_MB_ARCHIVO_SERVIDOR * 1024 * 1024) {
    throw new Error(`El archivo pesa más de ${MAX_MB_ARCHIVO_SERVIDOR} MB. Comprímelo en ZIP o divídelo.`)
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
