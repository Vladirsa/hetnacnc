// Pasa un archivo hecho en el Generador 2D y 3D al Cotizador CNC.
// Se guarda un momento en el navegador (sessionStorage), se abre el Cotizador
// y este lo carga solo en su botón de "subir archivo". Nada se sube a un servidor.

const CLAVE = "hetna-archivo-para-cotizar"
const VIGENCIA = 10 * 60 * 1000 // 10 minutos
const MAXIMO = 3.5 * 1024 * 1024 // sessionStorage aguanta ~5 MB

type Pendiente = { nombre: string; datos: string; binario: boolean; t: number }

const aBase64 = (buf: ArrayBuffer) => {
  let s = ""
  const b = new Uint8Array(buf)
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

// Devuelve false si el archivo es muy grande o el navegador no deja guardarlo
export function mandarACotizador(nombre: string, contenido: string | ArrayBuffer, locale: string): boolean {
  try {
    const binario = typeof contenido !== "string"
    const datos = binario ? aBase64(contenido as ArrayBuffer) : (contenido as string)
    if (datos.length > MAXIMO) return false
    const p: Pendiente = { nombre, datos, binario, t: Date.now() }
    sessionStorage.setItem(CLAVE, JSON.stringify(p))
  } catch {
    return false
  }
  window.location.href = `/${locale}/servicios/cotizador-cnc?archivo=generador`
  return true
}

export function hayArchivoPendiente(): boolean {
  try {
    const p = JSON.parse(sessionStorage.getItem(CLAVE) || "null") as Pendiente | null
    return !!p && Date.now() - p.t < VIGENCIA
  } catch {
    return false
  }
}

// Lo mete en el <input type="file"> de la app del Cotizador (mismo sitio, dentro del iframe)
export function cargarEnCotizador(iframe: HTMLIFrameElement) {
  let p: Pendiente | null = null
  try {
    p = JSON.parse(sessionStorage.getItem(CLAVE) || "null")
  } catch {
    p = null
  }
  if (!p || Date.now() - p.t > VIGENCIA) return
  const pendiente = p
  let intentos = 0
  const reloj = window.setInterval(() => {
    intentos++
    const win = iframe.contentWindow as (Window & typeof globalThis) | null
    const doc = iframe.contentDocument
    const input = (doc?.getElementById("archivo") || doc?.querySelector('input[type="file"][accept*="dxf"]')) as HTMLInputElement | null
    if (!win || !input) {
      if (intentos > 60) window.clearInterval(reloj)
      return
    }
    window.clearInterval(reloj)
    // espera a que la app termine de abrir la cuenta del taller antes de cargar el archivo
    window.setTimeout(() => {
      try {
        const bytes = pendiente.binario ? Uint8Array.from(atob(pendiente.datos), (c) => c.charCodeAt(0)) : pendiente.datos
        const dt = new win.DataTransfer()
        dt.items.add(new win.File([bytes], pendiente.nombre))
        input.files = dt.files
        input.dispatchEvent(new win.Event("change", { bubbles: true }))
        sessionStorage.removeItem(CLAVE)
      } catch (e) {
        console.error("[generador] no se pudo cargar el archivo en el Cotizador", e)
      }
    }, 1200)
  }, 250)
}
