// Deja optimizadas (AVIF) las fotos de productos y categorías antes de que
// llegue un visitante.
//
// La primera vez que alguien pide una foto en un ancho, /_next/image la tiene
// que convertir: ~1.2 s por foto en AVIF (medido el 27 nov 2026), y en una
// ficha con 20 productos relacionados eso se nota. Después queda en disco y en
// Cloudflare y sale en ~0.1 s.
//
// Este script abre el inicio, las categorías y cada ficha del mapa del sitio,
// lee cada <img> (srcset + sizes) y pide el ancho que escogería un celular
// (390 px a 3x) y una computadora (1440 px a 1x y 2x). Las que ya están hechas
// cuestan casi nada, así que se puede correr cuantas veces se quiera.
//
//   bun scripts/calentar-fotos.mjs https://hetnacnc.com
//   (o node; sin dependencias)
//
// Lo corre scripts/desplegar.sh en segundo plano al final de cada despliegue.

const SITIO = (process.argv[2] || "https://hetnacnc.com").replace(/\/$/, "")
const PARALELO = Number(process.env.CALENTAR_PARALELO || 2) // fotos a la vez (CPU del VPS)
const PERFILES = [
  { ancho: 390, dpr: 3 }, // celular
  { ancho: 1440, dpr: 1 }, // computadora
  { ancho: 1440, dpr: 2 }, // computadora con pantalla retina
]
const GALLETA = "_medusa_cache_id=calentar-fotos; hetna_lang=es"

const pedir = async (url, opciones = {}) => {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 30_000)
  try {
    return await fetch(url, { ...opciones, signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (hetna-calentar)", ...(opciones.headers || {}) } })
  } finally {
    clearTimeout(t)
  }
}

const texto = async (url, cookie = GALLETA) => {
  try {
    const r = await pedir(url, { headers: { Cookie: cookie } })
    return r.ok ? await r.text() : ""
  } catch {
    return ""
  }
}

const desescapar = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'")

/** Ancho (px CSS) que ocupa la imagen según `sizes` para una pantalla dada. */
export function anchoSlot(sizes, anchoPantalla) {
  if (!sizes) return anchoPantalla
  for (const parte of sizes.split(",").map((x) => x.trim())) {
    const m = /^\(\s*min-width:\s*(\d+)px\s*\)\s+(.+)$/.exec(parte)
    const valor = m ? (anchoPantalla >= Number(m[1]) ? m[2] : null) : /^\(/.test(parte) ? null : parte
    if (!valor) continue
    const vw = /^([\d.]+)vw$/.exec(valor)
    if (vw) return (Number(vw[1]) / 100) * anchoPantalla
    const px = /^([\d.]+)px$/.exec(valor)
    if (px) return Number(px[1])
  }
  return anchoPantalla
}

/** El candidato del srcset que escogería el navegador (el menor que alcanza). */
export function escoger(candidatos, necesario) {
  const orden = [...candidatos].sort((a, b) => a.w - b.w)
  return orden.find((c) => c.w >= necesario) || orden[orden.length - 1]
}

/** URLs de /_next/image que pediría cada perfil para las <img> del HTML. */
export function fotosDeHtml(html) {
  const urls = new Set()
  for (const [etiqueta] of html.matchAll(/<img\b[^>]*>/gi)) {
    const srcset = /\ssrcset="([^"]+)"/i.exec(etiqueta)?.[1]
    if (!srcset || !srcset.includes("/_next/image")) continue
    const sizes = /\ssizes="([^"]+)"/i.exec(etiqueta)?.[1]
    const candidatos = desescapar(srcset)
      .split(/,\s+(?=\/|https?:)/)
      .map((c) => {
        const [url, d] = c.trim().split(/\s+/)
        if (/^\d+w$/.test(d || "")) return { url, w: parseInt(d, 10) }
        if (/^[\d.]+x$/.test(d || "")) return { url, w: 0, x: parseFloat(d) }
        return null
      })
      .filter(Boolean)
    if (!candidatos.length) continue
    for (const p of PERFILES) {
      let c
      if (candidatos.every((x) => x.x)) c = candidatos.find((x) => x.x >= Math.min(p.dpr, 2)) || candidatos[candidatos.length - 1]
      else c = escoger(candidatos.filter((x) => x.w), anchoSlot(sizes, p.ancho) * p.dpr)
      if (c?.url) urls.add(c.url)
    }
  }
  return [...urls]
}

async function main() {
  const t0 = Date.now()
  const mapa = (await texto(`${SITIO}/sitemaps/productos.xml`)) + (await texto(`${SITIO}/sitemaps/categorias.xml`))
  const paginas = [`${SITIO}/mx`, ...new Set([...mapa.matchAll(/<loc>([^<]+\/(?:products|categories)(?:\/[^<]*)?)<\/loc>/g)].map((m) => m[1]))]
  if (paginas.length === 1) console.log(`aviso: no se pudo leer el mapa del sitio de ${SITIO}; sólo se revisa el inicio`)
  const fotos = new Set()
  for (const url of paginas) for (const f of fotosDeHtml(await texto(url))) fotos.add(f)

  let hechas = 0, nuevas = 0, mal = 0
  const lista = [...fotos]
  const trabajador = async () => {
    while (lista.length) {
      const f = lista.shift()
      try {
        const r = await pedir(f.startsWith("http") ? f : SITIO + f, { headers: { Accept: "image/avif,image/webp,*/*" } })
        await r.arrayBuffer()
        if (!r.ok) mal++
        else if (r.headers.get("x-nextjs-cache") === "MISS") nuevas++
        hechas++
      } catch {
        mal++
      }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador))
  console.log(`fotos: ${paginas.length} páginas, ${hechas} fotos revisadas, ${nuevas} recién optimizadas, ${mal} con error, ${Math.round((Date.now() - t0) / 1000)} s`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
