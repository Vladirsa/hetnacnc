// Lee los datos extra de la ficha de producto desde product.metadata.
// Se pueden capturar en el admin (Producto → Metadata) como JSON o como texto simple:
//   compatibilidad : "Mach3, Mach4, GRBL"            (separado por coma o salto de línea)
//   videos         : una URL de YouTube por línea
//   archivos       : "Manual de usuario|https://.../manual.pdf" (una por línea)
//   faq            : "¿Incluye spindle?|Sí, de 2.2 kW" (una por línea)

export type Archivo = { nombre: string; url: string }
export type Pregunta = { pregunta: string; respuesta: string }

type Meta = Record<string, unknown> | null | undefined

const MAX_ITEMS = 24

// Solo enlaces http(s) o rutas del propio sitio: el metadata lo pueden escribir vendedores.
export function urlSegura(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const url = valor.trim()
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url
  if (/^\/(?!\/)[^\s]*$/.test(url)) return url
  return null
}

function comoJson(valor: unknown): unknown {
  if (typeof valor !== "string") return valor
  const texto = valor.trim()
  if (texto.startsWith("[") || texto.startsWith("{")) {
    try {
      return JSON.parse(texto)
    } catch {
      return texto
    }
  }
  return texto
}

function lineas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

export function lista(valor: unknown, separadores = /[\n,;]+/): string[] {
  const dato = comoJson(valor)
  if (Array.isArray(dato)) {
    return dato
      .map((x) => (typeof x === "string" || typeof x === "number" ? String(x).trim() : ""))
      .filter(Boolean)
      .slice(0, MAX_ITEMS)
  }
  if (typeof dato === "string") {
    return dato
      .split(separadores)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, MAX_ITEMS)
  }
  return []
}

export function compatibilidad(meta: Meta): string[] {
  return lista(meta?.compatibilidad)
}

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return m ? m[1] : null
}

export function videos(meta: Meta): { url: string; youtube: string | null }[] {
  return lista(meta?.videos, /[\n\s,;]+/)
    .map((u) => urlSegura(u))
    .filter((u): u is string => Boolean(u))
    .map((url) => ({ url, youtube: youtubeId(url) }))
}

function nombreDeUrl(url: string): string {
  try {
    const ultimo = decodeURIComponent(new URL(url, "https://x.local").pathname.split("/").pop() || "")
    return ultimo || "Archivo"
  } catch {
    return "Archivo"
  }
}

export function archivos(meta: Meta): Archivo[] {
  const dato = comoJson(meta?.archivos)
  const salida: Archivo[] = []

  const agregar = (nombre: unknown, url: unknown) => {
    const segura = urlSegura(url)
    if (!segura) return
    const n = typeof nombre === "string" && nombre.trim() ? nombre.trim() : nombreDeUrl(segura)
    salida.push({ nombre: n.slice(0, 120), url: segura })
  }

  if (Array.isArray(dato)) {
    for (const item of dato) {
      if (typeof item === "string") agregar(undefined, item)
      else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>
        agregar(o.nombre ?? o.name ?? o.titulo, o.url ?? o.href)
      }
    }
  } else if (typeof dato === "string") {
    for (const linea of lineas(dato)) {
      const i = linea.lastIndexOf("|")
      if (i === -1) agregar(undefined, linea)
      else agregar(linea.slice(0, i), linea.slice(i + 1))
    }
  }
  return salida.slice(0, MAX_ITEMS)
}

export function faq(meta: Meta): Pregunta[] {
  const dato = comoJson(meta?.faq)
  const salida: Pregunta[] = []

  const agregar = (p: unknown, r: unknown) => {
    if (typeof p !== "string" || typeof r !== "string") return
    if (!p.trim() || !r.trim()) return
    salida.push({ pregunta: p.trim().slice(0, 240), respuesta: r.trim().slice(0, 1200) })
  }

  if (Array.isArray(dato)) {
    for (const item of dato) {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>
        agregar(o.pregunta ?? o.p ?? o.q, o.respuesta ?? o.r ?? o.a)
      }
    }
  } else if (typeof dato === "string") {
    for (const linea of lineas(dato)) {
      const i = linea.indexOf("|")
      if (i > 0) agregar(linea.slice(0, i), linea.slice(i + 1))
    }
  }
  return salida.slice(0, MAX_ITEMS)
}

export function tieneFicha(meta: Meta): boolean {
  return (
    compatibilidad(meta).length > 0 ||
    videos(meta).length > 0 ||
    archivos(meta).length > 0 ||
    faq(meta).length > 0
  )
}
