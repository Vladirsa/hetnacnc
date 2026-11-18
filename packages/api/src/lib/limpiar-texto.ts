// Limpieza de los textos que escribe la IA antes de publicarlos. A veces la IA
// regresa, además del texto, instrucciones internas ("**Texto de la
// publicación:**", "CARRUSEL – Diapositiva 1…", "Nota antes de publicar…",
// markdown con ** y ---). Eso nunca debe salir a una red.

const META_LINEA = /^\s*(?:[#>*_-]+\s*)*(?:texto (?:de|para) (?:la )?publicaci[oó]n|publicaci[oó]n\s*\(|caption|copy(?: del post)?|carrusel\b|diapositiva\s*\d+|slide\s*\d+|l[aá]mina\s*\d+|portada\s*:|nota(?:s)? (?:antes de publicar|interna|para el equipo)|guion\s*:|escena\s*\d+|hashtags?\s*:|cta\s*:|t[ií]tulo\s*:|formato\s*:|red\s*:)/i

/** Quita instrucciones internas y markdown; deja sólo el texto que se publica. */
export function limpiarTextoRed(texto: string) {
  let t = String(texto || "").replace(/\r/g, "")
  // Si la IA puso un encabezado "Texto de la publicación:", lo que importa es lo de después
  const m = t.match(/\*{0,2}\s*texto (?:de|para) (?:la )?publicaci[oó]n\s*:?\s*\*{0,2}\s*\n([\s\S]+)/i)
  if (m) t = m[1]
  // Notas internas completas (un bloque que empieza con "Nota antes de publicar" hasta el siguiente ---)
  t = t.replace(/\*{0,2}\s*nota(?:s)? (?:antes de publicar|interna|para el equipo)[\s\S]*?(?:\n-{3,}\s*\n|$)/gi, "")
  const lineas = t.split("\n").filter((l) => !META_LINEA.test(l) && !/^\s*[-–—_*]{3,}\s*$/.test(l))
  t = lineas.join("\n")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1") // **negritas**
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "") // # títulos de markdown (no los hashtags pegados)
    .replace(/\*\*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return t
}

/** ¿Todavía trae algo que no debe publicarse? (para detener la publicación). */
export function tieneBasura(texto: string) {
  const t = String(texto || "")
  return /\*\*|diapositiva\s*\d|nota antes de publicar|texto de la publicaci[oó]n|\{\{\s*\w+\s*\}\}|\bGUION\s*:|contexto no incluye/i.test(t)
}

/** Instagram y TikTok no dejan tocar ligas en el texto: se cambian por "liga en la bio". */
export function sinLigasCrudas(texto: string) {
  let t = String(texto || "").replace(/https?:\/\/\S+/g, "liga en la bio")
  t = t.replace(/(liga en la bio[\s.,:;👉👆🔗]*){2,}/gi, "liga en la bio ")
  return t.trim()
}
