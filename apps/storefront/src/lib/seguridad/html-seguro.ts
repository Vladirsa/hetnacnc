// Limpia HTML que escribe un tercero (descripción de un producto o de un
// taller) antes de pintarlo con dangerouslySetInnerHTML.
//
// Sin esto, un taller ponía <img src=x onerror=...> en su descripción y ese
// código corría en hetnacnc.com con la sesión de quien la viera (XSS).
//
// Lista blanca: sólo sobreviven etiquetas de formato, sin NINGÚN atributo,
// salvo href en <a> si es http(s), mailto o una ruta del sitio. Todo lo demás
// se quita; el contenido de <script>, <style> e <iframe> se borra completo.
// La salida sólo tiene etiquetas armadas aquí y texto sin "<" ni ">".
const PERMITIDAS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "small", "sub", "sup",
  "ul", "ol", "li", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
  "span", "div", "hr", "table", "thead", "tbody", "tr", "th", "td", "a",
])
const VACIAS = new Set(["br", "hr"])

const escaparTexto = (t: string) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;")

function hrefSeguro(atributos: string): string | null {
  const m = atributos.match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
  const valor = (m?.[2] ?? m?.[3] ?? m?.[4] ?? "").trim()
  if (!valor) return null
  // Se decodifican entidades y se quitan espacios/controles antes de revisar
  // el esquema: así "jav&#x61;script:" o "java\tscript:" no se cuelan.
  const limpio = valor
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[\u0000- ]/g, "")
    .toLowerCase()
  if (!(/^(https?:|mailto:)/.test(limpio) || (limpio.startsWith("/") && !limpio.startsWith("//")))) return null
  return valor.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function htmlSeguro(html: string | null | undefined): string {
  if (!html) return ""
  const sinPeligrosos = String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "")

  let out = ""
  let ultimo = 0
  const etiqueta = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  let m: RegExpExecArray | null
  while ((m = etiqueta.exec(sinPeligrosos))) {
    out += escaparTexto(sinPeligrosos.slice(ultimo, m.index))
    ultimo = etiqueta.lastIndex
    const nombre = m[1].toLowerCase()
    if (!PERMITIDAS.has(nombre)) continue
    const cierre = m[0].startsWith("</")
    if (cierre) {
      if (!VACIAS.has(nombre)) out += `</${nombre}>`
      continue
    }
    if (nombre === "a") {
      const href = hrefSeguro(m[2])
      out += href ? `<a href="${href}" rel="nofollow noopener noreferrer" target="_blank">` : "<a>"
      continue
    }
    out += VACIAS.has(nombre) ? `<${nombre}>` : `<${nombre}>`
  }
  out += escaparTexto(sinPeligrosos.slice(ultimo))
  return out
}
