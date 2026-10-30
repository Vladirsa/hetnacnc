// Subida de un archivo al bucket privado, desde el navegador, con avance.
// Pasa por /api/solicitud-archivo (ver esa ruta). XHR y no fetch: fetch no
// informa el avance de una subida, y con un STEP de 20 MB en datos móviles
// una barra quieta parece formulario trabado.
//
// destino "taller" guarda en la carpeta de portafolios de talleres; "envio",
// en la de evidencia de Envíos HETNA; sin destino, en la de solicitudes.
export type ArchivoGuardado = { clave: string; nombre: string; tamano: number }

export function subirArchivo(
  archivo: File,
  alAvanzar: (n: number) => void,
  destino?: "taller" | "envio"
): Promise<ArchivoGuardado> {
  return new Promise((ok, mal) => {
    const fd = new FormData()
    if (destino) fd.append("destino", destino)
    fd.append("archivo", archivo)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/solicitud-archivo")
    xhr.upload.onprogress = (e) => e.lengthComputable && alAvanzar(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let cuerpo: { clave?: string; nombre?: string; tamano?: number; message?: string } = {}
      try {
        cuerpo = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && cuerpo.clave) {
        ok({ clave: cuerpo.clave, nombre: cuerpo.nombre || archivo.name, tamano: cuerpo.tamano || archivo.size })
      } else {
        mal(new Error(cuerpo.message || "No se pudo subir."))
      }
    }
    xhr.onerror = () => mal(new Error("Se cortó la conexión. Intenta de nuevo."))
    xhr.send(fd)
  })
}
