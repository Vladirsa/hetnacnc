// Pasa un archivo hecho en el Generador 2D y 3D al Cotizador CNC.
// Se guarda un momento en el navegador (sessionStorage), se abre el Cotizador
// y este lo carga solo en su botón de "subir archivo". Nada se sube a un servidor.

import { avisarUso } from "./uso"

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

// ---------- Paquete de cotización ----------
// Lo que el cliente ya hizo en la herramienta llega completo al Cotizador:
// una o varias piezas (cada una con su cantidad), el servicio, el material y
// una nota. El Cotizador (public/hetna-cotizador/app.html, mismo sitio) lo lee
// de IndexedDB al abrir, precarga todo y cotiza el proyecto completo.
// Las claves deben coincidir con PAQ en hetna/cotizador/app.js.
const PAQ_DB = "hetna-cotizador-paquete"
const PAQ_ALMACEN = "paquetes"
const PAQ_CLAVE = "pendiente"
const PAQ_MARCA = "hetna-paquete-pendiente"
const PAQ_MAXIMO = 100 * 1024 * 1024

export type PiezaPaquete = { nombre: string; contenido: string | ArrayBuffer; cantidad?: number }
/** Claves de servicio, tipo y material como en hetna/cotizador/datos.json; lo que no exista ahí se ignora. */
export type ContextoCotizacion = {
  servicio?: "laser_co2" | "plasma" | "router" | "impresion_3d" | "carpinteria" | "laser_fibra" | "herreria"
  tipo?: string
  material?: string
  opciones?: { materialImpresion?: "pla" | "abs" | "petg" | "tpu"; materialLaser?: "mdf_fino" | "mdf_medio" | "otros" }
  juegos?: number
  nota?: string
}
export type PaqueteCotizacion = ContextoCotizacion & { proyecto: string; origen: string; piezas: PiezaPaquete[] }

/** Material de láser CO2 del cotizador según el espesor de MDF (mm). */
/** "Sofía Pérez" → "sofia-perez" (sin acentos ni símbolos, hasta 40 letras); vacío → `respaldo`. */
export const slugArchivo = (texto: string, respaldo = "archivo") =>
  (texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || respaldo).slice(0, 40)

/** Nombre de archivo limpio y único dentro de un proyecto ("Lateral izquierdo" → "lateral-izquierdo.dxf"). */
export function nombresDeArchivo(nombres: string[], ext: string): string[] {
  const usados = new Map<string, number>()
  return nombres.map((n) => {
    const base = slugArchivo(n, "pieza")
    const k = (usados.get(base) || 0) + 1
    usados.set(base, k)
    return `${k > 1 ? `${base}-${k}` : base}.${ext}`
  })
}

/** Material del router en el cotizador: el MDF de lista más cercano al espesor (mm). */
export const materialRouterMDF = (mm: number) => `MDF ${[3, 9, 15, 18].reduce((a, b) => (Math.abs(b - mm) < Math.abs(a - mm) ? b : a))}mm`

export const materialLaserPorEspesor = (mm: number): "mdf_fino" | "mdf_medio" | "otros" => (mm <= 4.5 ? "mdf_fino" : mm <= 7.5 ? "mdf_medio" : "otros")

// ── Precio en vivo (/store/precio-instantaneo): su vocabulario de materiales ──
/** Material de láser para el precio en vivo según el espesor. */
export const materialLaserPrecio = (mm?: number) => (mm && mm <= 2.5 ? "MDF delgado (hasta 2.5mm)" : mm && mm > 5.5 ? "Acrílico, cuero, tela u otro" : "MDF/Madera (3-5mm)")
/** Calibre de plasma para el precio en vivo (claves de PLASMA_CALIBRE en el backend). */
export const calibrePlasmaPrecio = (mm: number) => (mm <= 2.2 ? "Lámina delgada (cal. 20 a 12)" : mm <= 4.2 ? 'Lámina gruesa (1/8", 3 mm)' : "Placa (cal. 10 o más grueso)")
/** Servicio y material del precio en vivo para MDF del espesor dado, en router o láser. */
export const precioMDF = (maquina: "router" | "laser", mm?: number) =>
  maquina === "router" ? { servicio: "router" as const, material: materialRouterMDF(mm || 15) } : { servicio: "laser_co2" as const, material: materialLaserPrecio(mm) }
/** El mismo acero se escribe distinto en cada sistema: sin acento en el Cotizador, con acento en el precio en vivo. */
export const ACERO_COTIZADOR = "Acero al carbon"
export const ACERO_PRECIO = "Acero al carbón"

/** Contexto del Cotizador para cortar MDF del espesor dado en router o en láser. */
export function contextoMDF(maquina: "router" | "laser", mm: number): ContextoCotizacion {
  return maquina === "router"
    ? { servicio: "router", material: materialRouterMDF(mm) }
    : { servicio: "laser_co2", tipo: "Solo corte", material: "MDF", opciones: { materialLaser: materialLaserPorEspesor(mm) } }
}

/** Servicio del Cotizador → servicio de la solicitud de Fabrícamelo (SERVICIOS_SOLICITUD). */
export function procesoDeServicio(servicio?: ContextoCotizacion["servicio"]): string | undefined {
  switch (servicio) {
    case "laser_co2":
      return "Corte láser"
    case "plasma":
      return "Corte plasma"
    case "router":
      return "Corte CNC"
    case "impresion_3d":
      return "Impresión 3D"
    default:
      return undefined
  }
}

function guardarPaquete(p: PaqueteCotizacion & { t: number }): Promise<boolean> {
  return new Promise((ok) => {
    try {
      const r = indexedDB.open(PAQ_DB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(PAQ_ALMACEN)
      r.onerror = () => ok(false)
      r.onsuccess = () => {
        const db = r.result
        try {
          const tx = db.transaction(PAQ_ALMACEN, "readwrite")
          tx.objectStore(PAQ_ALMACEN).put(p, PAQ_CLAVE)
          tx.oncomplete = () => { db.close(); ok(true) }
          tx.onerror = () => { db.close(); ok(false) }
          tx.onabort = () => { db.close(); ok(false) }
        } catch {
          db.close()
          ok(false)
        }
      }
    } catch {
      ok(false)
    }
  })
}

/**
 * Manda el proyecto al Cotizador y lo abre. Devuelve false (sin navegar) si es
 * muy grande o el navegador no deja guardarlo; si no, navega cuando ya quedó
 * guardado. Nada se sube a un servidor.
 */
export function mandarPaqueteACotizador(paquete: PaqueteCotizacion, locale: string): boolean {
  const piezas = paquete.piezas.filter((p) => p.contenido && (typeof p.contenido === "string" ? p.contenido.length : p.contenido.byteLength) > 0)
  if (!piezas.length) return false
  const total = piezas.reduce((s, p) => s + (typeof p.contenido === "string" ? p.contenido.length : p.contenido.byteLength), 0)
  if (total > PAQ_MAXIMO || typeof indexedDB === "undefined") return false
  const t = Date.now()
  try {
    sessionStorage.removeItem(CLAVE) // que no se cargue también un archivo suelto viejo
    sessionStorage.removeItem(PAQ_MARCA)
  } catch {
    return false
  }
  const guardado = {
    ...paquete,
    t,
    piezas: piezas.map((p) => ({ nombre: p.nombre, cantidad: Math.max(1, Math.round(p.cantidad || 1)), contenido: new Blob([p.contenido]) })),
  }
  void guardarPaquete(guardado as unknown as PaqueteCotizacion & { t: number }).then((ok) => {
    if (ok) {
      try {
        sessionStorage.setItem(PAQ_MARCA, JSON.stringify({ t, proyecto: paquete.proyecto }))
      } catch {
        /* sin marca el Cotizador abre con su ejemplo */
      }
    } else if (piezas.length === 1) {
      // Sin IndexedDB: una pieza chica todavía cabe por el camino de antes
      const c = piezas[0].contenido
      const binario = typeof c !== "string"
      const datos = binario ? aBase64(c as ArrayBuffer) : (c as string)
      if (datos.length <= MAXIMO) {
        try {
          sessionStorage.setItem(CLAVE, JSON.stringify({ nombre: piezas[0].nombre, datos, binario, t } satisfies Pendiente))
        } catch {
          /* se abre el Cotizador vacío */
        }
      }
    }
    window.location.href = `/${locale}/servicios/cotizador-cnc?archivo=generador`
  })
  avisarUso("cotizar") // ya va en camino (si no cupo, no cuenta)
  return true
}

// Un solo archivo, con lo que la herramienta sepa del trabajo (servicio, material...)
export function mandarACotizador(nombre: string, contenido: string | ArrayBuffer, locale: string, contexto: ContextoCotizacion & { origen?: string; cantidad?: number } = {}): boolean {
  const { origen = "", cantidad = 1, ...resto } = contexto
  return mandarPaqueteACotizador({ ...resto, proyecto: nombre.replace(/\.[^.]+$/, ""), origen, piezas: [{ nombre, contenido, cantidad }] }, locale)
}

export function hayArchivoPendiente(): boolean {
  try {
    const marca = JSON.parse(sessionStorage.getItem(PAQ_MARCA) || "null") as { t: number } | null
    if (marca && Date.now() - marca.t < 30 * 60 * 1000) return true
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

// ---------- Fabrícamelo: el archivo va a la solicitud de fabricación ----------
// Mismo truco (sessionStorage), pero el destino es /cotizar, donde el
// formulario lo sube como si el cliente lo hubiera elegido y los talleres lo
// reciben tal cual. Nada se manda a un servidor hasta que el cliente envía.
const CLAVE_FABRICAR = "hetna-archivo-para-fabricar"

// Archivos grandes (STL de litofanías y relieves, 15–60 MB) no caben en
// sessionStorage (~5 MB): esos van a IndexedDB, que aguanta lo que permite la
// subida (100 MB). Sigue sin subirse nada hasta que el cliente envía.
const IDB = "hetna-fabricar"
const ALMACEN = "archivos"
const MAX_GRANDE = 100 * 1024 * 1024

const abrirIDB = () =>
  new Promise<IDBDatabase>((ok, mal) => {
    const r = indexedDB.open(IDB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })

async function guardarGrande(nombre: string, blob: Blob): Promise<boolean> {
  try {
    const db = await abrirIDB()
    await new Promise<void>((ok, mal) => {
      const tx = db.transaction(ALMACEN, "readwrite")
      tx.objectStore(ALMACEN).put({ nombre, blob, t: Date.now() }, "pendiente")
      tx.oncomplete = () => ok()
      tx.onerror = () => mal(tx.error)
    })
    db.close()
    return true
  } catch {
    return false
  }
}

/** El archivo grande que dejó un generador (IndexedDB), si sigue vigente. */
export async function tomarArchivoGrandeParaFabricar(): Promise<File | null> {
  try {
    const db = await abrirIDB()
    const fila = await new Promise<{ nombre: string; blob: Blob; t: number } | undefined>((ok, mal) => {
      const r = db.transaction(ALMACEN, "readonly").objectStore(ALMACEN).get("pendiente")
      r.onsuccess = () => ok(r.result)
      r.onerror = () => mal(r.error)
    })
    db.close()
    if (!fila || Date.now() - fila.t > VIGENCIA) return null
    return new File([fila.blob], fila.nombre, { type: "application/octet-stream" })
  } catch {
    return null
  }
}

export function mandarAFabricar(
  nombre: string,
  contenido: string | ArrayBuffer,
  locale: string,
  datos: { pieza: string; medidas?: string; material?: string; proceso?: string }
): boolean {
  let grande = false
  try {
    const binario = typeof contenido !== "string"
    const tam = binario ? (contenido as ArrayBuffer).byteLength : (contenido as string).length
    if (tam > 2.5 * 1024 * 1024) {
      if (tam > MAX_GRANDE) return false
      grande = true
      sessionStorage.removeItem(CLAVE_FABRICAR) // que no se tome uno chico viejo
    } else {
      const d = binario ? aBase64(contenido as ArrayBuffer) : (contenido as string)
      const p: Pendiente = { nombre, datos: d, binario, t: Date.now() }
      sessionStorage.setItem(CLAVE_FABRICAR, JSON.stringify(p))
    }
  } catch {
    return false
  }
  const q = new URLSearchParams({ desde: "generador", pieza: datos.pieza })
  if (datos.medidas) q.set("medidas", datos.medidas)
  if (datos.material) q.set("material", datos.material)
  // El formulario sólo preselecciona procesos de SERVICIOS_SOLICITUD
  // (lib/trabajos/servicios.ts): "Router CNC" ahí se llama "Corte CNC".
  const proceso = datos.proceso === "Router CNC" ? "Corte CNC" : datos.proceso
  if (proceso) q.set("proceso", proceso)
  avisarUso("fabricar") // ya pasó las revisiones de tamaño
  const ir = () => {
    window.location.href = `/${locale}/cotizar?${q.toString()}`
  }
  if (!grande) {
    ir()
    return true
  }
  // Se navega cuando ya quedó guardado; si IndexedDB falla, se abre la
  // solicitud igual (con los datos) y el cliente sube el archivo ahí.
  void guardarGrande(nombre, new Blob([contenido])).then(ir)
  return true
}

// Lo recoge el formulario de /cotizar como un File normal. Se queda guardado
// mientras dure la vigencia: si el cliente cambia de taller en la misma
// página, el archivo sigue ahí.
export function tomarArchivoParaFabricar(): File | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(CLAVE_FABRICAR) || "null") as Pendiente | null
    if (!p || Date.now() - p.t > VIGENCIA) return null
    const bytes = p.binario ? Uint8Array.from(atob(p.datos), (c) => c.charCodeAt(0)) : new TextEncoder().encode(p.datos)
    return new File([bytes], p.nombre, { type: "application/octet-stream" })
  } catch {
    return null
  }
}

// ---------- Fabrícamelo con varios archivos (proyecto completo) ----------
// Mismo IndexedDB que los archivos grandes ("hetna-fabricar"), con la clave
// "pendientes": una lista de archivos (piezas, ZIP, planos en PDF) que el
// formulario de /cotizar sube todos. El Cotizador (hetna/cotizador/app.js)
// escribe lo mismo desde su botón "Pídelo a un taller": las claves deben
// coincidir con FAB allá.
const CLAVE_VARIOS = "pendientes"
export const MAX_ARCHIVOS_FABRICAR = 5 // = MAX_ARCHIVOS del formulario (lib/fabricacion/opciones.ts)

export type DatosFabricar = { pieza: string; medidas?: string; material?: string; proceso?: string; cantidad?: string; nota?: string }

/** URL de /cotizar con los datos del trabajo ya puestos. */
export function urlFabricar(locale: string, datos: DatosFabricar) {
  const q = new URLSearchParams({ desde: "generador", pieza: datos.pieza.slice(0, 120) })
  if (datos.medidas) q.set("medidas", datos.medidas.slice(0, 120))
  if (datos.material) q.set("material", datos.material.slice(0, 80))
  const proceso = datos.proceso === "Router CNC" ? "Corte CNC" : datos.proceso
  if (proceso) q.set("proceso", proceso)
  if (datos.cantidad) q.set("cantidad", datos.cantidad.slice(0, 60))
  if (datos.nota) q.set("nota", datos.nota.slice(0, 1500))
  return `/${locale}/cotizar?${q.toString()}`
}

/**
 * Manda varios archivos (máx. 5 de 100 MB) a la solicitud de fabricación y la
 * abre cuando quedaron guardados. Devuelve false si no caben.
 */
export function mandarArchivosAFabricar(archivos: { nombre: string; contenido: Blob | ArrayBuffer | string }[], locale: string, datos: DatosFabricar): boolean {
  if (!archivos.length || archivos.length > MAX_ARCHIVOS_FABRICAR || typeof indexedDB === "undefined") return false
  const blobs = archivos.map((a) => ({ nombre: a.nombre, blob: a.contenido instanceof Blob ? a.contenido : new Blob([a.contenido]) }))
  if (blobs.some((b) => b.blob.size > MAX_GRANDE)) return false
  try {
    sessionStorage.removeItem(CLAVE_FABRICAR) // que no se tome uno chico viejo
  } catch {
    return false
  }
  void abrirIDB()
    .then(
      (db) =>
        new Promise<void>((ok, mal) => {
          const tx = db.transaction(ALMACEN, "readwrite")
          tx.objectStore(ALMACEN).put({ t: Date.now(), archivos: blobs }, CLAVE_VARIOS)
          tx.oncomplete = () => { db.close(); ok() }
          tx.onerror = () => { db.close(); mal(tx.error) }
        })
    )
    .catch(() => {}) // si falla, la solicitud abre igual con los datos y el cliente sube sus archivos
    .then(() => { window.location.href = urlFabricar(locale, datos) })
  avisarUso("fabricar")
  return true
}

/** Los archivos que dejó un proyecto (IndexedDB), si siguen vigentes. */
export async function tomarArchivosParaFabricar(): Promise<File[]> {
  try {
    const db = await abrirIDB()
    const fila = await new Promise<{ t: number; archivos: { nombre: string; blob: Blob }[] } | undefined>((ok, mal) => {
      const r = db.transaction(ALMACEN, "readonly").objectStore(ALMACEN).get(CLAVE_VARIOS)
      r.onsuccess = () => ok(r.result)
      r.onerror = () => mal(r.error)
    })
    db.close()
    if (!fila || Date.now() - fila.t > VIGENCIA) return []
    return fila.archivos.map((a) => new File([a.blob], a.nombre, { type: a.blob.type || "application/octet-stream" }))
  } catch {
    return []
  }
}
