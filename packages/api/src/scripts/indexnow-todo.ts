// Avisa por IndexNow TODAS las páginas del mapa del sitio (Bing, Copilot,
// búsqueda de ChatGPT, Yandex). Úsalo una vez al principio y después de
// cambios grandes; los productos nuevos se avisan solos.
//   cd /root/hetnacnc/packages/api && NODE_ENV=production bunx medusa exec ./src/scripts/indexnow-todo.ts
import { avisarIndexNow } from "../lib/indexnow"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

async function urlsDe(mapa: string, vistos = new Set<string>()): Promise<string[]> {
  if (vistos.has(mapa) || vistos.size > 50) return []
  vistos.add(mapa)
  const r = await fetch(mapa)
  if (!r.ok) return []
  const xml = await r.text()
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"))
  // Un índice de mapas trae otros mapas: se recorren
  if (/<sitemapindex/i.test(xml)) {
    const hijos = await Promise.all(locs.map((l) => urlsDe(l, vistos)))
    return hijos.flat()
  }
  return locs
}

export default async function indexNowTodo() {
  const urls = [...new Set([`${SITIO}/llms.txt`, ...(await urlsDe(`${SITIO}/sitemap.xml`))])]
  console.log(`Encontré ${urls.length} páginas en el mapa del sitio.`)
  const r = await avisarIndexNow(urls, { info: console.log, warn: console.log })
  console.log(r.enviadas ? `✔ Avisadas ${r.enviadas} páginas a IndexNow (Bing, Copilot, ChatGPT, Yandex).` : "✘ No se pudo avisar. Revisa que la página https://hetnacnc.com/c934f6b0c1d9e08a18ab420b24a50e32.txt abra.")
}
