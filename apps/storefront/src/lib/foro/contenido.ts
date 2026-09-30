// Convierte el texto de una publicación en bloques para mostrar: párrafos con ligas,
// videos incrustados (YouTube, TikTok, Facebook, Instagram, Vimeo) y bloques de G-code.

export type Video =
  | { tipo: "youtube"; id: string; url: string }
  | { tipo: "tiktok"; id: string; url: string }
  | { tipo: "vimeo"; id: string; url: string }
  | { tipo: "facebook"; url: string }
  | { tipo: "instagram"; id: string; url: string }

export type Trozo = { t: "texto"; v: string } | { t: "liga"; v: string } | { t: "salto" }
export type Bloque =
  | { t: "parrafo"; trozos: Trozo[] }
  | { t: "video"; video: Video }
  | { t: "codigo"; v: string }

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g

export function leerVideo(url: string): Video | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  const host = u.hostname.replace(/^(www\.|m\.|mobile\.)/, "")
  const partes = u.pathname.split("/").filter(Boolean)
  const idYT = /^[\w-]{11}$/
  if (host === "youtu.be" && idYT.test(partes[0] || "")) return { tipo: "youtube", id: partes[0], url }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v")
    if (v && idYT.test(v)) return { tipo: "youtube", id: v, url }
    if (["shorts", "embed", "live", "v"].includes(partes[0]) && idYT.test(partes[1] || "")) return { tipo: "youtube", id: partes[1], url }
  }
  if (host === "tiktok.com") {
    const i = partes.indexOf("video")
    if (i >= 0 && /^\d{8,25}$/.test(partes[i + 1] || "")) return { tipo: "tiktok", id: partes[i + 1], url }
  }
  if (host === "vimeo.com" && /^\d{5,12}$/.test(partes[0] || "")) return { tipo: "vimeo", id: partes[0], url }
  if (host === "instagram.com" && ["p", "reel", "reels", "tv"].includes(partes[0]) && /^[\w-]{5,40}$/.test(partes[1] || ""))
    return { tipo: "instagram", id: partes[1], url }
  if ((host === "facebook.com" || host === "fb.watch") && (host === "fb.watch" || /\/(videos|reel|watch)\b/.test(u.pathname) || u.searchParams.get("v")))
    return { tipo: "facebook", url }
  return null
}

// Dirección del reproductor incrustado
export function reproductor(v: Video): string {
  switch (v.tipo) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${v.id}`
    case "vimeo":
      return `https://player.vimeo.com/video/${v.id}?autoplay=1`
    case "instagram":
      return `https://www.instagram.com/p/${v.id}/embed`
    case "facebook":
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.url)}&show_text=false`
  }
}

export const esVertical = (v: Video) => v.tipo === "tiktok" || v.tipo === "instagram" || (v.tipo === "youtube" && /\/shorts\//.test(v.url))

function trozos(texto: string): Trozo[] {
  const out: Trozo[] = []
  texto.split("\n").forEach((linea, i) => {
    if (i > 0) out.push({ t: "salto" })
    let ultimo = 0
    for (const m of linea.matchAll(URL_RE)) {
      const pos = m.index ?? 0
      if (pos > ultimo) out.push({ t: "texto", v: linea.slice(ultimo, pos) })
      out.push({ t: "liga", v: m[0] })
      ultimo = pos + m[0].length
    }
    if (ultimo < linea.length) out.push({ t: "texto", v: linea.slice(ultimo) })
  })
  return out
}

export function bloques(cuerpo: string, maxVideos = 4): Bloque[] {
  const out: Bloque[] = []
  let videos = 0
  // separa los bloques de código ``` ... ```
  const partes = cuerpo.replace(/\r\n?/g, "\n").split(/^```[^\n]*\n?/m)
  partes.forEach((parte, i) => {
    if (i % 2 === 1) {
      const v = parte.replace(/\n+$/, "")
      if (v.trim()) out.push({ t: "codigo", v })
      return
    }
    for (const p of parte.split(/\n\s*\n/)) {
      const limpio = p.trim()
      if (!limpio) continue
      // cada línea que es solo la liga de un video se vuelve reproductor
      let acumulado: string[] = []
      const soltar = () => {
        const txt = acumulado.join("\n").trim()
        if (txt) out.push({ t: "parrafo", trozos: trozos(txt) })
        acumulado = []
      }
      for (const linea of limpio.split("\n")) {
        const l = linea.trim()
        const v = /^https?:\/\/\S+$/.test(l) && videos < maxVideos ? leerVideo(l) : null
        if (v) {
          soltar()
          out.push({ t: "video", video: v })
          videos++
        } else acumulado.push(linea)
      }
      soltar()
    }
  })
  return out
}

// Texto corto sin ligas ni código, para listas y descripciones
export function extracto(cuerpo: string, max = 180): string {
  const t = cuerpo
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(URL_RE, " ")
    .replace(/\[dato de contacto oculto\]/g, "(contacto oculto)")
    .replace(/\s+/g, " ")
    .trim()
  if (t.length <= max) return t
  const corte = t.slice(0, max)
  const esp = corte.lastIndexOf(" ")
  return (esp > max * 0.6 ? corte.slice(0, esp) : corte).replace(/[\s.,;:]+$/, "") + "…"
}

export const tieneVideo = (cuerpo: string, ligas: string[] = []) =>
  ligas.some((l) => leerVideo(l)) || (cuerpo.match(URL_RE) || []).some((l) => leerVideo(l))

// Normaliza una liga que escribió la persona (agrega https si falta). Devuelve null si no sirve.
export function ligaValida(v: string): string | null {
  let s = v.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = "https://" + s
  try {
    const u = new URL(s)
    if (!u.hostname.includes(".") || u.hostname.length > 120) return null
    return u.toString()
  } catch {
    return null
  }
}
