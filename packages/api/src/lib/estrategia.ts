// @ts-nocheck
// Marketing HETNA — pestaña Estrategia.
// (docs/investigacion-marketing-viral.md: "Dominar el algoritmo de cada red" y
//  "Expansión: México, Estados Unidos y Sudamérica")
//
// 1. Guía por red: lo que premia cada algoritmo (formato, duración, gancho,
//    dónde va la liga, hashtags, horarios y frecuencia). Editable.
// 2. Públicos: clientes empresa, clientes particulares/makers, talleres y
//    proveedores, cada uno con sus temas (pilares), objetivo y página destino.
// 3. Mercados: México, EE.UU. y Sudamérica, con su zona horaria, sus redes y
//    el reparto del esfuerzo.
// 4. Plan semanal: huecos por red, mercado, día y hora con público, tema y
//    formato. El agente de contenido los llena con borradores (IA o plantilla).
// 5. Puntaje de algoritmo: revisa cada texto contra la guía de su red y dice
//    cómo mejorarlo antes de publicar.
// Las cifras de las guías son un punto de partida (estudios de Buffer y otros);
// el sistema mide y el dueño las ajusta. Las redes no publican sus fórmulas.
import Anthropic from "@anthropic-ai/sdk"

import { aprendizaje } from "./social-estadisticas"
import { STORE_URL, nuevoId } from "./licitacion"
import { MERCADOS, REDES, T_CONFIG_S, T_POST, asegurarSocial, crearPublicacion, horaEn, iaSocial, zonaDe } from "./social-hub"

export const T_PLAN = "hetna_social_plan"

// ---------------------------------------------------------------------
// Públicos y temas
// ---------------------------------------------------------------------

export type Publico = { clave: string; nombre: string; objetivo: string; destino: string; pilares: string[] }
export const PUBLICOS: Publico[] = [
  {
    clave: "clientes_empresa", nombre: "Clientes empresa", objetivo: "que pidan cotización", destino: "/mx/cotizar",
    pilares: ["Cómo cotizar tu pieza en 3 pasos", "Caso: pieza resuelta por un taller de HETNA", "Talleres verificados y certificados", "Ahorro y tiempos al fabricar en México", "Índice de precios CNC del mes"],
  },
  {
    clave: "clientes_particulares", nombre: "Clientes particulares y makers", objetivo: "que coticen o compren", destino: "/mx",
    pilares: ["Corte satisfactorio de máquina CNC", "Antes y después de una pieza", "¿Cuánto cuesta cortar o maquinar…?", "Ideas para tu proyecto o negocio", "Diseños listos para cortar"],
  },
  {
    clave: "talleres", nombre: "Talleres", objetivo: "que se registren", destino: "/mx/talleres/unete",
    pilares: ["Oportunidades de trabajo en tu estado", "Cómo ganar licitaciones sin comisión", "Talleres destacados del ranking", "Tips de máquinas, materiales y procesos", "Cuánto cobrar por tu trabajo"],
  },
  {
    clave: "proveedores", nombre: "Proveedores", objetivo: "que publiquen sus productos", destino: "/mx/talleres/unete",
    pilares: ["Lo más pedido del mes", "Demanda de materiales por región", "Cómo vender insumos y herramientas en HETNA"],
  },
]

// ---------------------------------------------------------------------
// Guía por red (lo que premia cada algoritmo)
// ---------------------------------------------------------------------

export type Guia = {
  red: string
  formatos: string[] // se rotan en el plan
  frecuencia: number // publicaciones por semana (punto de partida)
  horas: number[] // horas locales sugeridas
  dias: number[] // 1 = lunes … 7 = domingo
  publicos: string[] // a quién le habla esta red (se rotan)
  liga: "en_texto" | "perfil" | "primer_comentario"
  hashtags: [number, number]
  media: "no" | "opcional" | "imagen" | "video"
  claves: string // qué premia el algoritmo, en una línea
}

export const GUIAS: Record<string, Guia> = {
  facebook: { red: "facebook", formatos: ["reel", "imagen", "reel", "texto"], frecuencia: 5, horas: [9, 12], dias: [1, 2, 3, 4, 5], publicos: ["clientes_particulares", "talleres", "clientes_empresa"], liga: "en_texto", hashtags: [0, 3], media: "opcional", claves: "Tiempo viendo reels; contenido original (sin marca de TikTok); más de una quinta parte del feed son recomendaciones." },
  instagram: { red: "instagram", formatos: ["reel", "carrusel", "reel", "reel", "carrusel"], frecuencia: 5, horas: [9, 18], dias: [1, 2, 3, 4, 5], publicos: ["clientes_particulares", "clientes_empresa", "talleres"], liga: "perfil", hashtags: [3, 10], media: "imagen", claves: "Tiempo de visualización, me gusta por alcance y envíos por mensaje (lo que más ayuda a llegar a quien no te sigue)." },
  tiktok: { red: "tiktok", formatos: ["video"], frecuencia: 7, horas: [19, 13, 20], dias: [1, 2, 3, 4, 5, 6, 7], publicos: ["clientes_particulares", "talleres"], liga: "perfil", hashtags: [3, 5], media: "video", claves: "Que lo vean completo, que lo repitan, compartidos y guardados; reparte por etapas; también es buscador." },
  youtube: { red: "youtube", formatos: ["short", "short", "largo"], frecuencia: 3, horas: [18, 19], dias: [2, 4, 6], publicos: ["clientes_empresa", "clientes_particulares", "talleres"], liga: "en_texto", hashtags: [2, 3], media: "video", claves: "Primer filtro: visto contra deslizado (el primer segundo); después, cuánto del video ven." },
  threads: { red: "threads", formatos: ["texto", "imagen", "texto"], frecuencia: 4, horas: [9, 13, 19], dias: [1, 2, 3, 4, 5], publicos: ["talleres", "clientes_particulares", "proveedores"], liga: "en_texto", hashtags: [0, 1], media: "opcional", claves: "Premia conversaciones: respuestas y citas; textos cortos con opinión o pregunta; publica seguido (varias veces por semana)." },
  linkedin: { red: "linkedin", formatos: ["texto", "documento", "imagen"], frecuencia: 3, horas: [10, 13, 15], dias: [2, 3, 4], publicos: ["clientes_empresa", "proveedores"], liga: "primer_comentario", hashtags: [0, 3], media: "opcional", claves: "Perfiles personales llegan más que páginas; premia conversación y que la gente se quede; castiga ligas en el texto." },
  telegram: { red: "telegram", formatos: ["texto", "imagen"], frecuencia: 5, horas: [10], dias: [1, 2, 3, 4, 5], publicos: ["talleres", "proveedores"], liga: "en_texto", hashtags: [0, 2], media: "opcional", claves: "Sin algoritmo: llega a los suscriptores del canal; directo e informativo." },
  whatsapp: { red: "whatsapp", formatos: ["estado"], frecuencia: 3, horas: [11], dias: [1, 3, 5], publicos: ["talleres", "clientes_particulares"], liga: "en_texto", hashtags: [0, 0], media: "imagen", claves: "Red más usada en México; sin algoritmo: canal, estados y listas con permiso." },
  grupos_facebook: { red: "grupos_facebook", formatos: ["texto"], frecuencia: 3, horas: [12], dias: [2, 4, 6], publicos: ["talleres", "clientes_particulares"], liga: "en_texto", hashtags: [0, 0], media: "opcional", claves: "Como miembro de la comunidad: útil y no vendedor; a mano con liga medida por grupo." },
  reddit: { red: "reddit", formatos: ["texto"], frecuencia: 1, horas: [10], dias: [3], publicos: ["clientes_empresa", "talleres"], liga: "en_texto", hashtags: [0, 0], media: "opcional", claves: "Aportar ayuda técnica real; nada de anuncios (las comunidades lo castigan)." },
}

// Redes por mercado. Todos usan las mismas cuentas de HETNA (cada publicación
// en el idioma de su mercado); las redes manuales quedan para copiar y pegar.
export const REDES_MERCADO: Record<string, string[]> = {
  mx: ["facebook", "instagram", "threads", "tiktok", "youtube", "linkedin", "telegram", "whatsapp", "grupos_facebook"],
  us: ["linkedin", "youtube", "instagram", "threads", "facebook", "reddit", "tiktok"],
  co: ["facebook", "instagram", "threads", "tiktok", "telegram", "whatsapp", "grupos_facebook"],
  cl: ["facebook", "instagram", "tiktok", "whatsapp", "grupos_facebook"],
  pe: ["facebook", "instagram", "tiktok", "whatsapp", "grupos_facebook"],
  ar: ["facebook", "instagram", "tiktok", "whatsapp", "grupos_facebook"],
  br: ["instagram", "whatsapp", "youtube", "tiktok"],
}

export type ConfigEstrategia = {
  mercados: Record<string, number> // mercado -> % del esfuerzo (0 = apagado)
  guias: Record<string, Partial<Pick<Guia, "frecuencia" | "horas">>>
  pilares: Record<string, string[]>
}
// Primer país de Sudamérica: Colombia (decisión del 10 nov 2026); EE.UU. en inglés desde las mismas cuentas
const CONFIG_INICIAL: ConfigEstrategia = { mercados: { mx: 100, co: 35, us: 25 }, guias: {}, pilares: {} }

export async function leerEstrategia(knex: any): Promise<ConfigEstrategia> {
  await asegurarSocial(knex)
  const r = await knex(T_CONFIG_S).where({ clave: "estrategia" }).first()
  const v = r?.valor || {}
  return {
    // Mercados que el dueño nunca ha tocado toman el valor inicial (así entran Colombia y EE.UU.)
    mercados: v.mercados && typeof v.mercados === "object" ? { ...CONFIG_INICIAL.mercados, ...v.mercados } : CONFIG_INICIAL.mercados,
    guias: v.guias || {},
    pilares: v.pilares || {},
  }
}

export async function guardarEstrategia(knex: any, c: Partial<ConfigEstrategia>) {
  const a = await leerEstrategia(knex)
  const mercados = { ...a.mercados }
  for (const [k, v] of Object.entries(c.mercados || {})) if (k in MERCADOS) mercados[k] = Math.max(0, Math.min(100, Math.round(Number(v) || 0)))
  const guias = { ...a.guias }
  for (const [red, g] of Object.entries(c.guias || {})) {
    if (!(red in GUIAS)) continue
    const f = Math.max(0, Math.min(21, Math.round(Number((g as any).frecuencia))))
    const horas = Array.isArray((g as any).horas) ? (g as any).horas.map((h: any) => Math.round(Number(h))).filter((h: number) => h >= 0 && h <= 23).slice(0, 4) : undefined
    guias[red] = { ...(Number.isFinite(f) ? { frecuencia: f } : {}), ...(horas?.length ? { horas } : {}) }
  }
  const pilares = { ...a.pilares }
  for (const [p, lista] of Object.entries(c.pilares || {})) {
    if (!PUBLICOS.some((x) => x.clave === p) || !Array.isArray(lista)) continue
    pilares[p] = lista.map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 12)
  }
  const nueva = { mercados, guias, pilares }
  await knex.raw(`insert into ?? (clave, valor) values ('estrategia', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(nueva)])
  return nueva
}

export const guiaDe = (cfg: ConfigEstrategia, red: string): Guia => ({ ...GUIAS[red], ...(cfg.guias[red] || {}) })
export const publicoDe = (cfg: ConfigEstrategia, clave: string): Publico => {
  const p = PUBLICOS.find((x) => x.clave === clave) || PUBLICOS[0]
  return { ...p, pilares: cfg.pilares[clave]?.length ? cfg.pilares[clave] : p.pilares }
}

// ---------------------------------------------------------------------
// Puntaje de algoritmo
// ---------------------------------------------------------------------

const CTA = /(manda|env[ií]a|comparte|gu[aá]rda|comenta|etiqueta|cotiza|reg[ií]strate|[uú]nete|send|share|save|comment|tag|quote|join)/i
const CLAVES_CNC = /(cnc|l[aá]ser|laser|plasma|router|fresad|torno|maquinad|machin|corte|cut|impresi[oó]n 3d|3d print|molde|mold|acero|steel|aluminio|aluminum|mdf|acr[ií]lico|acrylic)/i
const URL = /(https?:\/\/|\bhetnacnc\.com|\{\{liga\}\})/i

export type Revision = { ok: boolean; texto: string; consejo?: string }

/** Revisa un texto contra la guía de su red. Devuelve 0–100 y consejos. */
export function puntuar(texto: string, red: string, ctx: { medios?: { url: string; tipo?: string }[]; programada_para?: string | Date | null; mercado?: string } = {}) {
  const g = GUIAS[red]
  const max = REDES[red]?.max || 2000
  const t = String(texto || "")
  const revisiones: Revision[] = []
  const add = (ok: boolean, txt: string, consejo?: string) => revisiones.push({ ok, texto: txt, consejo: ok ? undefined : consejo })
  const primera = t.split("\n").find((l) => l.trim()) || ""
  add(t.length <= max, `Largo dentro de ${max} caracteres`, `Recórtalo: ${t.length} de ${max}.`)
  add(primera.length > 0 && primera.length <= 90, "Gancho corto en la primera línea", "Empieza con una frase corta que dé curiosidad o el resultado (máximo 90 caracteres).")
  add(CTA.test(t), "Pide una acción (mandar, guardar, comentar, cotizar)", red === "instagram" ? "Pide que lo manden a alguien: los envíos por mensaje son lo que más pesa en Instagram." : "Termina pidiendo una acción concreta.")
  if (g) {
    const tags = (t.match(/#[\p{L}\d_]+/gu) || []).length
    add(tags >= g.hashtags[0] && tags <= g.hashtags[1], `Hashtags: ${g.hashtags[0]} a ${g.hashtags[1]}`, `Tiene ${tags}; usa entre ${g.hashtags[0]} y ${g.hashtags[1]}.`)
    if (g.liga === "perfil") add(!/https?:\/\//i.test(t), "Sin liga en el texto (no se puede tocar)", "Quita la liga y di \"liga en el perfil\" o \"comenta COTIZA\".")
    if (g.liga === "primer_comentario") add(!URL.test(t), "Liga fuera del texto (en el primer comentario)", "LinkedIn castiga las ligas en el texto: ponla en el primer comentario.")
    if (g.liga === "en_texto") add(URL.test(t), "Lleva la liga medida", "Agrega la liga ({{liga}}) para medir resultados.")
    const medio = ctx.medios?.[0]
    const esVideo = medio && (medio.tipo === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(medio.url))
    if (g.media === "video") add(!!esVideo, "Lleva video vertical", "Esta red es de video: agrega un video vertical de 10 a 60 segundos.")
    if (g.media === "imagen") add(!!medio, "Lleva imagen o video", "Agrega una imagen o, mejor, un video vertical.")
    if (red === "tiktok" || red === "youtube") add(CLAVES_CNC.test(primera), "Palabra clave en la primera línea (búsqueda)", "Di de qué trata con palabras que la gente busca (ej. \"corte láser de acero\").")
    if (red === "linkedin") add(((t.match(/\p{Extended_Pictographic}/gu) || []).length) <= 3, "Pocos emojis (tono profesional)", "Deja máximo 3 emojis.")
    if (ctx.programada_para) {
      const h = horaEn(new Date(ctx.programada_para), zonaDe(ctx.mercado))
      add(g.horas.some((x) => Math.abs(x - h) <= 1), "Sale en buen horario", `Mejor a las ${g.horas.join(" o ")} h (hora local).`)
    }
  }
  const ok = revisiones.filter((r) => r.ok).length
  return { puntaje: revisiones.length ? Math.round((ok / revisiones.length) * 100) : 100, revisiones }
}

// ---------------------------------------------------------------------
// Plan semanal
// ---------------------------------------------------------------------

let listo = false
export async function asegurarPlan(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_PLAN))) {
    await knex.schema.createTable(T_PLAN, (t: any) => {
      t.text("id").primary()
      t.date("semana").notNullable().index()
      t.timestamp("fecha", { useTz: true }).notNullable()
      t.text("red").notNullable()
      t.text("mercado").notNullable()
      t.text("publico").notNullable()
      t.text("pilar").notNullable()
      t.text("formato").notNullable()
      t.text("estado").notNullable().defaultTo("vacio") // vacio | borrador | falta_material | programada | publicada | descartada
      t.text("post_id")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
  listo = true
}

/** Lunes (AAAA-MM-DD) de la semana de `d`, en hora de México. */
export function lunesDe(d = new Date()) {
  const local = new Date(new Date(d).toLocaleString("en-US", { timeZone: "America/Mexico_City" }))
  const dia = (local.getDay() + 6) % 7
  local.setDate(local.getDate() - dia)
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`
}

/** Instante UTC de una fecha y hora local en una zona (p. ej. 2026-11-16 18:00 en Chicago). */
export function instanteEn(fecha: string, hora: number, zona: string) {
  const [y, m, d] = fecha.split("-").map(Number)
  let t = Date.UTC(y, m - 1, d, hora, 0, 0)
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zona, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]))
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute))
    t += Date.UTC(y, m - 1, d, hora, 0, 0) - local
  }
  return new Date(t)
}

const sumarDias = (fecha: string, n: number) => {
  const [y, m, d] = fecha.split("-").map(Number)
  const x = new Date(Date.UTC(y, m - 1, d + n))
  return x.toISOString().slice(0, 10)
}

// Tope de publicaciones por red y por día: todos los países comparten las mismas
// cuentas y publicar de más baja el alcance de cada publicación.
export const TOPE_DIA: Record<string, number> = { threads: 2, facebook: 2, instagram: 2, tiktok: 2, youtube: 1, linkedin: 1, telegram: 2, whatsapp: 1, grupos_facebook: 2, reddit: 1, pinterest: 2 }

/** Deja como mucho TOPE_DIA[red] huecos por red y día; gana el mercado con más reparto. */
export function recortarPorDia<T extends { red: string; mercado: string; fecha: Date }>(filas: T[], mercados: Record<string, number>) {
  const orden = [...filas].sort((a, b) => (mercados[b.mercado] || 0) - (mercados[a.mercado] || 0))
  const cuenta: Record<string, number> = {}
  const quedan = new Set<T>()
  for (const f of orden) {
    const dia = new Date(f.fecha).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })
    const k = `${f.red}|${dia}`
    if ((cuenta[k] || 0) >= (TOPE_DIA[f.red] ?? 2)) continue
    cuenta[k] = (cuenta[k] || 0) + 1
    quedan.add(f)
  }
  return filas.filter((f) => quedan.has(f))
}

/** Arma los huecos de la semana según guías, mercados y reparto. No duplica. */
export async function generarPlan(knex: any, semana = lunesDe(new Date(Date.now() + 7 * 86_400_000))) {
  await asegurarPlan(knex)
  const cfg = await leerEstrategia(knex)
  if (await knex(T_PLAN).where({ semana }).first("id")) return { semana, creados: 0, ya: true }
  const activos = Object.entries(cfg.mercados).filter(([, pct]) => pct > 0)
  const maxPct = Math.max(1, ...activos.map(([, p]) => p))
  const filas: any[] = []
  let giro = 0
  for (const [mercado, pct] of activos) {
    const zona = zonaDe(mercado)
    for (const red of REDES_MERCADO[mercado] || []) {
      const g = guiaDe(cfg, red)
      if (!g?.frecuencia) continue
      const n = Math.max(0, Math.round((g.frecuencia * pct) / maxPct))
      // Reparte en los días sugeridos, de forma pareja
      const dias = g.dias.length ? g.dias : [1, 2, 3, 4, 5]
      for (let i = 0; i < n; i++) {
        const dia = dias[Math.floor((i * dias.length) / Math.max(n, 1)) % dias.length]
        const hora = g.horas[i % g.horas.length]
        const publico = publicoDe(cfg, g.publicos[(i + giro) % g.publicos.length])
        const pilar = publico.pilares[(i + giro) % publico.pilares.length]
        filas.push({
          id: nuevoId("plan"), semana, fecha: instanteEn(sumarDias(semana, dia - 1), hora, zona), red, mercado,
          publico: publico.clave, pilar, formato: g.formatos[i % g.formatos.length], estado: "vacio",
        })
      }
      giro++
    }
  }
  const finales = recortarPorDia(filas, cfg.mercados)
  if (finales.length) await knex.batchInsert(T_PLAN, finales, 100)
  return { semana, creados: finales.length, recortados: filas.length - finales.length }
}

// ---------------------------------------------------------------------
// Agente de contenido: llena los huecos con borradores
// ---------------------------------------------------------------------

let ia: Anthropic | null = null

/** Texto base para un hueco: con IA (usando datos reales del sitio) o plantilla. */
async function ideaPara(slot: any, cfg: ConfigEstrategia, contexto: string, logger?: any) {
  const publico = publicoDe(cfg, slot.publico)
  const plantilla = `${slot.pilar}\n\n${publico.objetivo === "que se registren" ? "¿Tienes taller CNC? Recibe solicitudes de trabajo sin comisión:" : "Cotiza tu pieza en HETNA CNC:"} {{liga}}`
  if (!iaSocial()) return { texto: plantilla, ia: false }
  try {
    ia ??= new Anthropic()
    const g = GUIAS[slot.red]
    const resp = await ia.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1500,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "Eres el estratega de contenido de HETNA CNC, marketplace de fabricación CNC (talleres, clientes industriales, makers y proveedores). " +
        "Escribe UNA publicación lista para usar. Reglas: usa sólo datos reales del contexto, no inventes precios, cifras, clientes ni promociones; " +
        "si el formato es video o reel, escribe el texto de la publicación y al final una línea 'GUION:' con el guion de 15 a 30 segundos (gancho en el primer segundo). " +
        "Incluye la marca {{liga}} donde va la liga. Sin teléfonos ni correos. " +
        "Diseño que funciona (docs/investigacion-disenos-virales.md): primera línea de máximo 8 palabras que se entienda sola y, si hay un dato real en el contexto, con número; " +
        "habla de un estado o proceso concreto cuando el contexto lo permita; una sola llamada a la acción; pide que lo manden a quien lo necesita (nunca 'comenta SÍ' ni 'etiqueta a'); " +
        "a talleres muéstrales la necesidad del cliente (trabajo disponible, sin comisión) y a clientes que ya hay talleres listos para cotizar.",
      messages: [{
        role: "user",
        content:
          `Mercado: ${MERCADOS[slot.mercado]?.nombre} (${MERCADOS[slot.mercado]?.nota}).\nRed: ${REDES[slot.red]?.nombre}. Lo que premia: ${g?.claves}\n` +
          `Formato: ${slot.formato}. Público: ${publico.nombre} (objetivo: ${publico.objetivo}). Tema: ${slot.pilar}.\n\nContexto real de HETNA:\n${contexto}`,
      }],
    } as any)
    if (resp.stop_reason === "refusal") return { texto: plantilla, ia: false }
    const texto = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim()
    return { texto: texto || plantilla, ia: !!texto }
  } catch (e) {
    logger?.warn?.(`[estrategia] IA no disponible: ${(e as Error).message}`)
    return { texto: plantilla, ia: false }
  }
}

/** Datos reales y públicos para que la IA no invente (licitaciones, productos, talleres). */
async function contextoReal(knex: any) {
  const partes: string[] = []
  const talleres = await knex("seller").whereNull("deleted_at").count({ n: "*" }).first().catch(() => null)
  if (talleres) partes.push(`Talleres registrados: ${talleres.n}.`)
  const lic = await knex("hetna_solicitud").where("created_at", ">=", knex.raw("now() - interval '30 days'")).count({ n: "*" }).first().catch(() => null)
  if (lic) partes.push(`Solicitudes de fabricación en los últimos 30 días: ${lic.n}.`)
  const prods = await knex("product").whereNull("deleted_at").where({ status: "published" }).orderBy("created_at", "desc").limit(5).select("title").catch(() => [])
  if (prods.length) partes.push(`Productos recientes en la tienda: ${prods.map((p: any) => p.title).join("; ")}.`)
  const ap = await aprendizaje(knex).catch(() => null)
  if (ap?.resumen?.length) partes.push(`Lo que mejor ha funcionado en nuestras redes (estadísticas reales): ${ap.resumen.join(" ")}`)
  partes.push("HETNA no cobra comisión en licitaciones; los talleres pueden estar verificados y tener certificaciones; hay ranking público por evaluaciones reales; contratos SafeDeal opcionales.")
  return partes.join("\n")
}

/** Llena los huecos vacíos de la semana con borradores ligados al plan. */
export async function llenarPlan(knex: any, semana: string, logger?: any, limite = 60) {
  await asegurarPlan(knex)
  const cfg = await leerEstrategia(knex)
  const huecos = await knex(T_PLAN).where({ semana, estado: "vacio" }).orderBy("fecha").limit(limite)
  if (!huecos.length) return { llenados: 0 }
  const contexto = await contextoReal(knex)
  let n = 0
  for (const h of huecos) {
    const publico = publicoDe(cfg, h.publico)
    const idea = await ideaPara(h, cfg, contexto, logger)
    // El guion del video va en notas: no se publica
    const [texto, guion] = idea.texto.split(/\n\s*GUION:\s*/i)
    const conLiga = texto.includes("{{liga}}") ? texto.trim() : `${texto.trim()}\n\n{{liga}}`
    const destino = `${STORE_URL}${h.mercado === "us" ? publico.destino.replace(/^\/mx/, "/us") : publico.destino}`
    const postId = await crearPublicacion(
      knex,
      {
        origen: "manual", fuente: "plan", titulo: `${REDES[h.red]?.nombre} · ${h.pilar}`, texto_base: conLiga, url: destino, redes: [h.red], estado: "borrador",
        programada_para: h.fecha, mercado: h.mercado, textos: idea.ia ? { [h.red]: conLiga } : undefined, notas: guion ? `Guion: ${guion.trim()}` : undefined,
      },
      logger
    )
    const necesitaVideo = ["reel", "video", "short", "largo"].includes(h.formato)
    await knex(T_PLAN).where({ id: h.id }).update({ post_id: postId, estado: necesitaVideo ? "falta_material" : "borrador" })
    n++
  }
  return { llenados: n }
}

/** Plan de una semana con el estado real de cada publicación. */
export async function verPlan(knex: any, semana: string) {
  await asegurarPlan(knex)
  const huecos = await knex(`${T_PLAN} as h`).leftJoin(`${T_POST} as p`, "p.id", "h.post_id").where("h.semana", semana).orderBy("h.fecha").select("h.*", "p.estado as post_estado", "p.medios", "p.titulo")
  return huecos.map((h: any) => ({
    ...h,
    // El estado de la publicación manda (si ya se programó, publicó o descartó)
    estado: h.post_estado && ["programada", "publicada", "parcial", "descartada"].includes(h.post_estado) ? h.post_estado : h.estado === "falta_material" && Array.isArray(h.medios) && h.medios.length ? "borrador" : h.estado,
  }))
}
