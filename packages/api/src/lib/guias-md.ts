// Lee una guía del blog escrita en docs/guias-blog/*.md (el formato que se
// pega en Admin › Blog) y la convierte en un artículo listo para guardar.
// El contenido usa el mismo "texto simple" del panel (## títulos, - listas,
// **negritas**, [ligas](url)) y se convierte con las mismas reglas.
const SECCIONES: Record<string, string> = {
  "router cnc": "router-cnc",
  "corte láser": "corte-laser",
  "plasma cnc": "plasma",
  "torno y fresadora cnc": "torno-fresadora",
  "impresión 3d": "impresion-3d",
  "diseño y cam": "diseno-cam",
  "controladores y electrónica": "controladores-electronica",
  "materiales y herramientas": "materiales-herramientas",
  "precios y negocio": "precios-negocio",
  "muestra tu trabajo": "muestra-tu-trabajo",
  "novedades y ofertas": "novedades-ofertas",
  "empleos y proyectos": "empleos-proyectos",
}

// Mismas reglas que apps/admin/src/routes/blog/page.tsx (textoAHtml)
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const enLinea = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>')

export function textoAHtml(texto: string): string {
  return texto
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((b) => {
      const lineas = b.split("\n").filter((l) => l.trim())
      if (!lineas.length) return ""
      if (lineas.length === 1 && /^###\s/.test(lineas[0])) return `<h3>${enLinea(lineas[0].replace(/^###\s+/, ""))}</h3>`
      if (lineas.length === 1 && /^##\s/.test(lineas[0])) return `<h2>${enLinea(lineas[0].replace(/^##\s+/, ""))}</h2>`
      if (lineas.every((l) => /^\s*[-*]\s/.test(l))) return `<ul>${lineas.map((l) => `<li>${enLinea(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`
      if (lineas.every((l) => /^\s*\d+[.)]\s/.test(l))) return `<ol>${lineas.map((l) => `<li>${enLinea(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`
      return `<p>${lineas.map(enLinea).join("<br/>")}</p>`
    })
    .filter(Boolean)
    .join("\n")
}

export type GuiaMd = {
  slug: string
  title: string
  categoria: string
  autor: string
  excerpt: string
  seo_title?: string
  seo_description?: string
  content_html: string
}

/** null si al archivo le falta algo indispensable (título, slug, sección o contenido). */
export function leerGuiaMd(md: string): GuiaMd | null {
  const [cabeza, ...resto] = md.replace(/\r/g, "").split(/^-{3,} *CONTENIDO.*-{3,}\s*$/m)
  if (!resto.length) return null
  const campo = (nombre: string) => {
    const m = new RegExp(`^${nombre}:\\s*(.+)$`, "mi").exec(cabeza)
    return m ? m[1].trim() : ""
  }
  const slug = campo("Dirección \\(slug\\)")
  const title = campo("Título")
  const categoria = SECCIONES[campo("Sección del foro").toLowerCase()] || ""
  const contenido = resto.join("\n").trim()
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || !title || !categoria || !contenido) return null
  return {
    slug,
    title,
    categoria,
    autor: campo("Autor") || "Equipo HETNA",
    excerpt: campo("Resumen"),
    seo_title: campo("Título para Google") || undefined,
    seo_description: campo("Descripción para Google") || undefined,
    content_html: textoAHtml(contenido),
  }
}
