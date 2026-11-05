// IndexNow: avisa al momento a Bing (y con él a Copilot y a la búsqueda de
// ChatGPT, que usan su índice), Yandex, Seznam y Naver cuando hay una página
// nueva o cambiada, en vez de esperar a que la rastreen.
//
// La llave no es secreta: se publica en https://hetnacnc.com/<llave>.txt
// (apps/storefront/public/). Si se cambia, hay que cambiar ese archivo también.
// INDEXNOW_APAGADO=1 lo apaga.
const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
export const LLAVE_INDEXNOW = (process.env.INDEXNOW_KEY || "c934f6b0c1d9e08a18ab420b24a50e32").trim()

const apagado = () => ["1", "true", "si"].includes(String(process.env.INDEXNOW_APAGADO || "").toLowerCase())

export async function avisarIndexNow(urls: string[], logger?: { info?: (m: string) => void; warn?: (m: string) => void }) {
  if (apagado() || process.env.NODE_ENV !== "production") return { enviadas: 0 }
  const host = new URL(SITIO).host
  const lista = [...new Set(urls.filter((u) => typeof u === "string" && u.startsWith(SITIO)))]
  let enviadas = 0
  // IndexNow acepta hasta 10,000 por envío
  for (let i = 0; i < lista.length; i += 10_000) {
    const urlList = lista.slice(i, i + 10_000)
    try {
      const r = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key: LLAVE_INDEXNOW, keyLocation: `${SITIO}/${LLAVE_INDEXNOW}.txt`, urlList }),
      })
      // 200 y 202 son buenos (202 = recibido, verificando la llave)
      if (r.ok) enviadas += urlList.length
      else logger?.warn?.(`[indexnow] respuesta ${r.status}`)
    } catch (e) {
      logger?.warn?.(`[indexnow] ${(e as Error).message}`)
    }
  }
  if (enviadas) logger?.info?.(`[indexnow] ${enviadas} páginas avisadas`)
  return { enviadas }
}

// Los productos se juntan un minuto antes de avisar: al publicar o editar se
// disparan varios eventos seguidos del mismo producto.
const pendientes = new Set<string>()
let reloj: NodeJS.Timeout | null = null
export function avisarProductoIndexNow(handle: string, logger?: { info?: (m: string) => void; warn?: (m: string) => void }) {
  if (!handle || apagado()) return
  pendientes.add(`${SITIO}/mx/products/${handle}`)
  if (reloj) return
  reloj = setTimeout(() => {
    const urls = [...pendientes]
    pendientes.clear()
    reloj = null
    void avisarIndexNow(urls, logger)
  }, 60_000)
  reloj.unref?.()
}
