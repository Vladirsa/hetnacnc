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
import { PRINCIPIOS_VIDEO } from "./fabrica/render"
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
    pilares: ["Corte satisfactorio de máquina CNC", "Antes y después de una pieza", "¿Cuánto cuesta cortar o maquinar…?", "Ideas para tu proyecto o negocio", "Diseños listos para cortar",
      // HETNA 3D Studio: de foto, texto o logotipo a STL
      "Convierte una foto en modelo 3D con IA (el primero del mes es gratis)", "Tu foto en una litofanía 3D para imprimir", "Tu logotipo en 3D: de SVG o DXF a STL", "Llaveros y placas con nombre en minutos"],
  },
  {
    clave: "talleres", nombre: "Talleres", objetivo: "que se registren", destino: "/mx/talleres/unete",
    pilares: [
      "Oportunidades de trabajo en tu estado", "Cómo ganar licitaciones sin comisión", "Talleres destacados del ranking", "Tips de máquinas, materiales y procesos", "Cuánto cobrar por tu trabajo",
      // Novedades de HETNA (temas que el dueño quiere desarrollar con talleres, proveedores y clientes)
      "Mejoras nuevas de HETNA y cómo te ayudan", "La calculadora CNC: qué calcula y cómo usarla en tu taller", "Vende diseños y productos digitales en HETNA (subirlos es fácil)",
      "Envíos más baratos y rápidos desde HETNA", "Facturación y verificación: por qué un taller verificado vende más", "Lo básico que necesita un taller para recibir trabajo por internet",
      "Tutorial: trabajar con 3, 4 y 5 ejes (diferencias y cuándo conviene cada uno)",
      // HETNA Cotizador (lo que se cobra): plan gratis de 5 al mes, prueba de 14 días, planes Taller/Pro/Industrial
      "HETNA Cotizador: sube tu DXF y el precio sale con tus costos", "Deja de cotizar a mano: empieza gratis con 5 cotizaciones al mes",
      "Cotización por WhatsApp en PDF con tu marca", "Seguimiento automático de cotizaciones (que no se te enfríe el cliente)",
      // HETNA 3D Studio (imagen a 3D con IA con créditos; lo demás gratis)
      "De una foto a un modelo 3D con IA (STL para imprimir o maquinar)", "Letras 3D para anuncios: hojas de corte listas en DXF",
    ],
  },
  {
    clave: "proveedores", nombre: "Proveedores", objetivo: "que publiquen sus productos", destino: "/mx/talleres/unete",
    pilares: ["Lo más pedido del mes", "Demanda de materiales por región", "Cómo vender insumos y herramientas en HETNA", "Sube tus productos en minutos", "Lo básico que necesita un proveedor para vender en línea",
      // Publicidad en el sitio (espacios de 30 o 90 días, se pagan con Mercado Pago)
      "Anúnciate en HETNA: tu marca en el carrusel del inicio, banners y el foro"],
  },
  {
    // Comunidad: el lado humano de emprender un taller o negocio (humor, empatía, pregunta a la audiencia).
    // Lo que más se comenta y comparte; formato tipo caricatura o cómic con una pregunta al final.
    clave: "comunidad", nombre: "Comunidad (dueños de taller y emprendedores)", objetivo: "que comenten y compartan", destino: "/mx/foro-cnc",
    pilares: [
      "El tacaño: cobrar barato no es ahorrar", "Los nervios antes de entregar un trabajo grande", "Ansiedad cuando no entra trabajo al taller",
      "Cuando el taller pesa: salud mental del emprendedor", "El dolor de perder un cliente", "Codependencia: el taller que vive de un solo cliente",
      "Inseguridad al cotizar: ¿y si cobro mucho?", "La soledad de emprender", "Resentimiento con el cliente que no pagó", "La culpa de no estar en casa por el taller",
      "Dependencia de una sola máquina", "¿Qué pasa con tu taller si te enfermas?", "El daño de una mala pieza (y cómo reponerse)", "Tristeza por cerrar un proyecto",
      "Del odio al aprendizaje: el cliente difícil", "Abuso: clientes que regatean y cambian todo sin pagar", "Frustración cuando la máquina falla en el peor momento",
      "Necesidad: aceptar cualquier trabajo o elegir", "Quejarse vs. resolver", "Toma de decisiones en el taller", "El que mucho abarca poco aprieta",
      "El riesgo de dar servicio a empresas grandes (pagos a 90 días)", "Confianza en tu negocio", "Egoísmo vs. colaborar con otros talleres",
      "Un loco entiende a otro loco: la comunidad de talleres", "¿La economía es un límite para triunfar?", "Capacitación constante", "Decisiones y malas decisiones",
      "Resistencia al cambio en el taller",
    ],
  },
]

// ---------------------------------------------------------------------
// Mapa emocional (fórmula del dueño, 11 nov 2026): cada publicación vende una
// emoción. Se escribe a la aspiración, no a la condición de quien la ve; sólo
// se promete lo verificable (trabajo disponible, sin comisión, talleres
// verificados, cotizar gratis): nada de "hazte rico" ni cifras de ganancias, y
// nada dirigido a menores ("sueños" = jóvenes emprendedores y padres).
// ---------------------------------------------------------------------

export type Emocion = { clave: string; nombre: string; publicos: string[]; como: string; prueba: string }
export const EMOCIONES: Emocion[] = [
  { clave: "deseo", nombre: "Deseo", publicos: ["talleres", "proveedores"], como: "el taller con trabajos que dan orgullo, la máquina que no para, clientes que regresan", prueba: "solicitudes reales de clientes y cotizar sin comisión" },
  { clave: "belleza", nombre: "Belleza", publicos: ["clientes_particulares"], como: "piezas y diseños bonitos: decoración, regalos personalizados, acabados que lucen", prueba: "trabajos reales de talleres y diseños de la tienda" },
  { clave: "tranquilidad", nombre: "Tranquilidad", publicos: ["clientes_particulares", "clientes_empresa"], como: "encargar sin miedo: taller verificado, condiciones claras, todo por escrito", prueba: "talleres verificados, reseñas reales y contrato SafeDeal opcional" },
  { clave: "suenos", nombre: "Sueños", publicos: ["talleres", "clientes_particulares"], como: "emprender con una máquina, convertir una idea en negocio, el primer cliente", prueba: "registro gratis, calculadora y diseños para empezar" },
  { clave: "seguridad", nombre: "Seguridad", publicos: ["clientes_empresa", "proveedores"], como: "proveedores confiables para producir sin sorpresas: calidad, plazos y respaldo", prueba: "ranking por evaluaciones reales, certificaciones y SafeDeal" },
  { clave: "esperanza", nombre: "Esperanza", publicos: ["talleres", "proveedores"], como: "empezar con poco y crecer: oportunidades cerca, sin pagar por entrar", prueba: "registro gratis, sin comisión y solicitudes abiertas en su estado" },
]
export const REGLAS_EMOCION =
  "Cada pieza transmite UNA emoción del mapa emocional de HETNA y la muestra con una escena o historia (no la nombra). " +
  "Se escribe a la aspiración, nunca a la condición de quien la ve (no 'si eres pobre', no 'para mujeres'). " +
  "Sólo se promete lo verificable: trabajo disponible, cotizar gratis, sin comisión, talleres verificados; prohibido prometer riqueza, ingresos o cifras de ganancias. " +
  "Nada dirigido a menores de edad: 'sueños' es para jóvenes emprendedores y para padres que apoyan a sus hijos."
export const emocionesDe = (publico: string) => EMOCIONES.filter((e) => e.publicos.includes(publico))

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
  facebook: { red: "facebook", formatos: ["reel", "imagen", "reel", "texto"], frecuencia: 5, horas: [9, 12], dias: [1, 2, 3, 4, 5], publicos: ["clientes_particulares", "talleres", "clientes_empresa", "comunidad"], liga: "en_texto", hashtags: [0, 3], media: "opcional", claves: "Tiempo viendo reels; contenido original (sin marca de TikTok); más de una quinta parte del feed son recomendaciones." },
  instagram: { red: "instagram", formatos: ["reel", "carrusel", "reel", "reel", "carrusel"], frecuencia: 5, horas: [9, 18], dias: [1, 2, 3, 4, 5], publicos: ["clientes_particulares", "clientes_empresa", "talleres", "comunidad"], liga: "perfil", hashtags: [3, 10], media: "imagen", claves: "Tiempo de visualización, me gusta por alcance y envíos por mensaje (lo que más ayuda a llegar a quien no te sigue)." },
  tiktok: { red: "tiktok", formatos: ["video"], frecuencia: 7, horas: [19, 13, 20], dias: [1, 2, 3, 4, 5, 6, 7], publicos: ["clientes_particulares", "talleres", "comunidad"], liga: "perfil", hashtags: [3, 5], media: "video", claves: "Que lo vean completo, que lo repitan, compartidos y guardados; reparte por etapas; también es buscador." },
  youtube: { red: "youtube", formatos: ["short", "short", "largo"], frecuencia: 3, horas: [18, 19], dias: [2, 4, 6], publicos: ["clientes_empresa", "clientes_particulares", "talleres"], liga: "en_texto", hashtags: [2, 3], media: "video", claves: "Primer filtro: visto contra deslizado (el primer segundo); después, cuánto del video ven." },
  google_business: { red: "google_business", formatos: ["imagen"], frecuencia: 2, horas: [10], dias: [2, 5], publicos: ["clientes_empresa", "clientes_particulares"], liga: "en_texto", hashtags: [0, 0], media: "imagen", claves: "Publicaciones en tu ficha de Google: ayudan a aparecer en búsquedas locales ('corte láser cerca de mí'); constancia semanal, foto real y palabras de servicio + ciudad." },
  threads: { red: "threads", formatos: ["texto", "imagen", "texto"], frecuencia: 4, horas: [9, 13, 19], dias: [1, 2, 3, 4, 5], publicos: ["talleres", "clientes_particulares", "proveedores", "comunidad"], liga: "en_texto", hashtags: [0, 1], media: "opcional", claves: "Premia conversaciones: respuestas y citas; textos cortos con opinión o pregunta; publica seguido (varias veces por semana)." },
  linkedin: { red: "linkedin", formatos: ["texto", "documento", "imagen"], frecuencia: 3, horas: [10, 13, 15], dias: [2, 3, 4], publicos: ["clientes_empresa", "proveedores"], liga: "primer_comentario", hashtags: [0, 3], media: "opcional", claves: "Perfiles personales llegan más que páginas; premia conversación y que la gente se quede; castiga ligas en el texto." },
  telegram: { red: "telegram", formatos: ["texto", "imagen"], frecuencia: 5, horas: [10], dias: [1, 2, 3, 4, 5], publicos: ["talleres", "proveedores"], liga: "en_texto", hashtags: [0, 2], media: "opcional", claves: "Sin algoritmo: llega a los suscriptores del canal; directo e informativo." },
  whatsapp: { red: "whatsapp", formatos: ["estado"], frecuencia: 3, horas: [11], dias: [1, 3, 5], publicos: ["talleres", "clientes_particulares"], liga: "en_texto", hashtags: [0, 0], media: "imagen", claves: "Red más usada en México; sin algoritmo: canal, estados y listas con permiso." },
  grupos_facebook: { red: "grupos_facebook", formatos: ["texto"], frecuencia: 3, horas: [12], dias: [2, 4, 6], publicos: ["talleres", "clientes_particulares"], liga: "en_texto", hashtags: [0, 0], media: "opcional", claves: "Como miembro de la comunidad: útil y no vendedor; a mano con liga medida por grupo." },
  reddit: { red: "reddit", formatos: ["texto"], frecuencia: 1, horas: [10], dias: [3], publicos: ["clientes_empresa", "talleres"], liga: "en_texto", hashtags: [0, 0], media: "opcional", claves: "Aportar ayuda técnica real; nada de anuncios (las comunidades lo castigan)." },
}

// Redes por mercado. Todos usan las mismas cuentas de HETNA (cada publicación
// en el idioma de su mercado); las redes manuales quedan para copiar y pegar.
export const REDES_MERCADO: Record<string, string[]> = {
  mx: ["facebook", "instagram", "threads", "google_business", "tiktok", "youtube", "linkedin", "telegram", "whatsapp", "grupos_facebook"],
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
    pilares[p] = lista.map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 40)
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
  await knex.raw(`alter table if exists ?? add column if not exists emocion text`, [T_PLAN]).catch(() => {})
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
      t.text("emocion")
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
  // Temas: se escoge el que menos se ha usado en las últimas 12 semanas (así sale todo el temario, no siempre los primeros)
  const usos: Record<string, number> = {}
  for (const r of await knex(T_PLAN).where("fecha", ">=", knex.raw("now() - interval '84 days'")).groupBy("publico", "pilar").select("publico", "pilar").count({ n: "*" }).catch(() => []))
    usos[`${r.publico}|${r.pilar}`] = Number(r.n) || 0
  const elegirPilar = (publico: Publico) => {
    let mejor = publico.pilares[0]
    for (const x of publico.pilares) if ((usos[`${publico.clave}|${x}`] || 0) < (usos[`${publico.clave}|${mejor}`] || 0)) mejor = x
    usos[`${publico.clave}|${mejor}`] = (usos[`${publico.clave}|${mejor}`] || 0) + 1
    return mejor
  }
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
        const pilar = elegirPilar(publico)
        filas.push({
          id: nuevoId("plan"), semana, fecha: instanteEn(sumarDias(semana, dia - 1), hora, zona), red, mercado,
          publico: publico.clave, pilar, formato: g.formatos[i % g.formatos.length], estado: "vacio",
          // Emoción que vende esta pieza (rota entre las del público)
          // Comunidad no vende: es conversación humana (y trae temas de salud mental), así que no lleva emoción de venta
          emocion: publico.clave === "comunidad" ? null : (emocionesDe(publico.clave)[(i + giro) % Math.max(1, emocionesDe(publico.clave).length)] || EMOCIONES[0]).clave,
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
  const plantilla =
    publico.clave === "comunidad"
      ? `${slot.pilar}\n\n¿A ti te ha pasado? Cuéntanos en comentarios. 👇`
      : `${slot.pilar}\n\n${publico.objetivo === "que se registren" ? "¿Tienes taller CNC? Recibe solicitudes de trabajo sin comisión:" : "Cotiza tu pieza en HETNA CNC:"} {{liga}}`
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
        "si el formato es video o reel, escribe el texto de la publicación y al final una línea 'GUION:' con el guion de 15 a 30 segundos (gancho en el primer segundo), " +
        "escrito como bloques donde cada bloque dice la acción visual concreta y el texto en pantalla de máximo 4 palabras. Principios de video: " + PRINCIPIOS_VIDEO + " " +
        "Incluye la marca {{liga}} donde va la liga. Sin teléfonos ni correos. " +
        "Diseño que funciona (docs/investigacion-disenos-virales.md): primera línea de máximo 8 palabras que se entienda sola y, si hay un dato real en el contexto, con número; " +
        "habla de un estado o proceso concreto cuando el contexto lo permita; una sola llamada a la acción; pide que lo manden a quien lo necesita (nunca 'comenta SÍ' ni 'etiqueta a'); " +
        "a talleres muéstrales la necesidad del cliente (trabajo disponible, sin comisión) y a clientes que ya hay talleres listos para cotizar. " +
        "Público Comunidad: habla del lado humano de emprender un taller con empatía o humor (personifica el problema, situaciones que todos reconocen) y termina con una pregunta para que comenten; nada de vender. " +
        REGLAS_EMOCION + " " +
        "Temas de salud mental (depresión, ansiedad, abuso): con respeto, sin diagnósticos ni consejos médicos, sin burla; invita a buscar apoyo y, en México, menciona la Línea de la Vida 800 911 2000.",
      messages: [{
        role: "user",
        content:
          `Mercado: ${MERCADOS[slot.mercado]?.nombre} (${MERCADOS[slot.mercado]?.nota}).\nRed: ${REDES[slot.red]?.nombre}. Lo que premia: ${g?.claves}\n` +
          `Formato: ${slot.formato}. Público: ${publico.nombre} (objetivo: ${publico.objetivo}). Tema: ${slot.pilar}.\n` +
          (() => { const e = EMOCIONES.find((x) => x.clave === slot.emocion); return e ? `Emoción que vende: ${e.nombre} — ${e.como}. Prueba verificable: ${e.prueba}.\n` : "" })() +
          `\nContexto real de HETNA:\n${contexto}`,
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
  // Guía de estilo del dueño (biblioteca de referencias)
  const { guiaParaPrompt } = await import("./referencias")
  const guia = await guiaParaPrompt(knex)
  if (guia) partes.push(guia.trim())
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
    if (h.emocion) await knex(T_POST).where({ id: postId }).update({ emocion: h.emocion })
    n++
  }
  return { llenados: n }
}

/**
 * Todo el temario de una vez: un borrador (con su imagen o carrusel) por cada
 * tema que no se ha usado en 30 días ni está ya programado. Uno por día a las
 * 19:00 (México), alternando públicos, para no saturar las cuentas. Quedan con
 * fuente "temario": el piloto automático NO los aprueba; los revisa el dueño.
 */
export async function temarioCompleto(knex: any, logger?: any, o: { publicos?: string[]; desde?: Date } = {}) {
  await asegurarPlan(knex)
  const cfg = await leerEstrategia(knex)
  const claves = (o.publicos?.length ? o.publicos : ["comunidad", "talleres", "clientes_particulares", "proveedores", "clientes_empresa"]).filter((c) => PUBLICOS.some((p) => p.clave === c))
  const usados = new Set(
    (await knex(T_PLAN).where("fecha", ">=", knex.raw("now() - interval '30 days'")).select("publico", "pilar")).map((r: any) => `${r.publico}|${r.pilar}`),
  )
  // Intercala los públicos: comunidad, talleres, clientes, … y otra vez
  const colas = claves.map((c) => publicoDe(cfg, c).pilares.filter((x) => !usados.has(`${c}|${x}`)).map((pilar) => ({ publico: c, pilar })))
  const temas: { publico: string; pilar: string }[] = []
  for (let i = 0; colas.some((q) => q.length); i++) {
    const q = colas[i % colas.length]
    if (q.length) temas.push(q.shift()!)
  }
  if (!temas.length) return { creados: 0, temas: 0 }
  const inicio = lunesDe(o.desde || new Date()) // se cuenta desde mañana
  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }))
  const manana = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
  const filas = temas.map((t, i) => {
    const dia = sumarDias(manana, i + 1)
    const fecha = instanteEn(dia, 19, "America/Mexico_City")
    const emos = emocionesDe(t.publico)
    return {
      id: nuevoId("plan"), semana: lunesDe(fecha), fecha, red: t.publico === "comunidad" ? "facebook" : "instagram", mercado: "mx",
      publico: t.publico, pilar: t.pilar, formato: i % 3 === 2 ? "carrusel" : "imagen", estado: "vacio",
      emocion: t.publico === "comunidad" ? null : (emos[i % Math.max(1, emos.length)] || EMOCIONES[0]).clave,
    }
  })
  await knex(T_PLAN).insert(filas)
  logger?.info?.(`[temario] ${filas.length} temas desde ${inicio}; escribiendo los textos…`)
  // Textos con IA, uno por uno (en segundo plano; la Fábrica luego les hace la imagen)
  const contexto = await contextoReal(knex)
  let n = 0
  for (const h of filas) {
    try {
      const publico = publicoDe(cfg, h.publico)
      const idea = await ideaPara(h, cfg, contexto, logger)
      const [texto] = idea.texto.split(/\n\s*GUION:\s*/i)
      const conLiga = texto.includes("{{liga}}") ? texto.trim() : `${texto.trim()}\n\n{{liga}}`
      const postId = await crearPublicacion(
        knex,
        { origen: "manual", fuente: "temario", titulo: `Temario · ${h.pilar}`, texto_base: conLiga, url: `${STORE_URL}${publico.destino}`, redes: [h.red], estado: "borrador", programada_para: h.fecha, mercado: "mx", textos: idea.ia ? { [h.red]: conLiga } : undefined } as any,
        logger,
      )
      await knex(T_PLAN).where({ id: h.id }).update({ post_id: postId, estado: "borrador" })
      if (h.emocion) await knex(T_POST).where({ id: postId }).update({ emocion: h.emocion })
      n++
    } catch (e) {
      logger?.warn?.(`[temario] ${h.pilar}: ${(e as Error).message}`)
    }
  }
  logger?.info?.(`[temario] listos ${n} de ${filas.length}`)
  return { creados: n, temas: filas.length }
}

/** Temas pendientes por público (para el botón del panel). */
export async function temasPendientes(knex: any) {
  await asegurarPlan(knex)
  const cfg = await leerEstrategia(knex)
  const usados = new Set((await knex(T_PLAN).where("fecha", ">=", knex.raw("now() - interval '30 days'")).select("publico", "pilar")).map((r: any) => `${r.publico}|${r.pilar}`))
  return PUBLICOS.map((p) => {
    const pil = publicoDe(cfg, p.clave).pilares
    return { clave: p.clave, nombre: p.nombre, total: pil.length, pendientes: pil.filter((x) => !usados.has(`${p.clave}|${x}`)).length }
  })
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
