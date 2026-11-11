// @ts-nocheck
// Videos HETNA con HyperFrames (HTML -> MP4, Apache-2.0), con el estilo del
// video aprobado "¿Máquina parada?": plano azul claro con cuadrícula, tinta
// azul, acento naranja, letra Archivo, un objeto que actúa en cada escena,
// máximo 4 palabras en pantalla y subtítulos de una línea.
//
// Cómo se usa: el guionista (Claude, o el respaldo sin IA) escribe BLOQUES con un
// tipo de escena y textos cortos; aquí el código arma el HTML (la IA nunca
// escribe HTML), se revisa con `hyperframes check` y se hace el MP4.
// Si algo falla, devuelve null y quien llama usa el video de FFmpeg de siempre.
//
// Cuidar la tienda (el servidor tiene 2 procesadores):
//   - un solo video a la vez en todo el proceso (cola)
//   - prioridad mínima (nice 19) y 1 solo Chrome
//   - tope de tiempo: se mata el grupo completo (Chrome incluido) y se borra la carpeta
// Instalación: scripts/desplegar.sh deja HyperFrames en /opt/hyperframes (Chrome en ~/.cache/hyperframes).
import { spawn, spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

import Anthropic from "@anthropic-ai/sdk"
import sharp from "sharp"

import { carpetaFuentes, PRINCIPIOS_VIDEO } from "./render"
import { ffmpegBin } from "./video"

const DIR = () => process.env.HYPERFRAMES_DIR || "/opt/hyperframes"
const BIN = () => process.env.HYPERFRAMES_BIN || path.join(DIR(), "node_modules", ".bin", "hyperframes")
const GSAP = () => path.join(DIR(), "node_modules", "gsap", "dist", "gsap.min.js")
const TOPE_MS = () => Number(process.env.HYPERFRAMES_TOPE_MS || 240_000)

/** ¿Está instalado HyperFrames (y no se apagó con HF_DESACTIVAR=1)? */
export const hfListo = () => process.env.HF_DESACTIVAR !== "1" && fs.existsSync(BIN()) && fs.existsSync(GSAP())

// Si falla dos veces seguidas (p. ej. se pasa del tope en este servidor), se deja
// de intentar 3 horas para no gastar procesador en balde; mientras, FFmpeg.
let fallosSeguidos = 0
let pausaHasta = 0
export const hfDisponible = () => hfListo() && Date.now() >= pausaHasta
function anotar(ok: boolean, logger?: any) {
  if (ok) return void (fallosSeguidos = 0)
  if (++fallosSeguidos >= 2) {
    pausaHasta = Date.now() + 3 * 3600_000
    fallosSeguidos = 0
    logger?.warn?.("[fabrica] hyperframes: 2 fallas seguidas; pausa de 3 horas (se usa FFmpeg)")
  }
}

/** Horas de poco tráfico (2 a 6 am, hora de México) para los videos que pueden esperar. */
export function horaTranquila(d = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hourCycle: "h23" }).format(d))
  return h >= 2 && h < 6
}

// ---------------------------------------------------------------------
// Guion por bloques
// ---------------------------------------------------------------------

export const TIPOS = ["gancho", "dato", "lista", "comparar", "accion", "pregunta"] as const
export type Bloque = {
  tipo: (typeof TIPOS)[number] | "cierre"
  texto: string // lo que se VE (máx. 4 palabras)
  acento?: string // palabra de `texto` que va en naranja
  narracion: string // lo que se DICE
  icono?: string
  cifra?: string // sólo "dato": número real del texto (nunca inventado)
  items?: string[] // sólo "lista": 2 o 3, máx. 3 palabras
  mal?: string // sólo "comparar"
  bien?: string
}

const INK = "#142033"
const ACC = "#C2560A"
const FONDO = "#E8EEF4"
const L = `stroke="${INK}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"`

function engrane() {
  const pts: string[] = []
  const n = 10
  for (let i = 0; i < n * 4; i++) {
    const a = (i / (n * 4)) * Math.PI * 2
    const r = i % 4 < 2 ? 84 : 64
    pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`)
  }
  return `<g class="gira"><polygon points="${pts.join(" ")}" fill="#fff" ${L}/><circle cx="100" cy="100" r="24" fill="${ACC}" ${L}/></g>`
}

/** Iconos de línea (viewBox 0 0 200 200), mismo trazo que el video aprobado. */
export const ICONOS: Record<string, string> = {
  pieza: `<polygon points="100,22 168,61 168,139 100,178 32,139 32,61" fill="#fff" ${L}/><circle cx="100" cy="100" r="30" fill="${ACC}" ${L}/>`,
  engrane: engrane(),
  dinero: `<rect x="18" y="52" width="164" height="96" rx="14" fill="#fff" ${L}/><circle cx="100" cy="100" r="30" fill="${ACC}"/><text x="100" y="116" font-size="46" text-anchor="middle" fill="#fff" font-family="Archivo Black">$</text>`,
  reloj: `<circle cx="100" cy="100" r="78" fill="#fff" ${L}/><line x1="100" y1="100" x2="140" y2="100" ${L}/><g class="manecilla"><line x1="100" y1="100" x2="100" y2="42" stroke="${ACC}" stroke-width="12" stroke-linecap="round"/></g><circle cx="100" cy="100" r="9" fill="${INK}"/>`,
  laser: `<rect x="68" y="18" width="64" height="54" rx="10" fill="#fff" ${L}/><line class="haz" x1="100" y1="74" x2="100" y2="138" stroke="${ACC}" stroke-width="10" stroke-linecap="round"/><rect x="22" y="140" width="156" height="32" rx="6" fill="#fff" ${L}/>`,
  taller: `<path d="M24 176 V82 L64 56 V82 L104 56 V82 L144 56 V82 L176 82 V176 Z" fill="#fff" ${L}/><rect x="80" y="122" width="40" height="54" fill="${ACC}"/>`,
  camion: `<g class="rueda-todo"><rect x="14" y="58" width="112" height="82" rx="8" fill="#fff" ${L}/><path d="M126 84 H160 L186 116 V140 H126 Z" fill="${ACC}" ${L}/><circle cx="54" cy="152" r="18" fill="${INK}"/><circle cx="152" cy="152" r="18" fill="${INK}"/></g>`,
  factura: `<path d="M50 20 H130 L156 46 V180 H50 Z" fill="#fff" ${L}/><path d="M70 70 H136 M70 96 H136 M70 122 H112" ${L}/><circle cx="142" cy="152" r="28" fill="${ACC}"/><path d="M129 152 L139 162 L156 142" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  calculadora: `<rect x="44" y="18" width="112" height="164" rx="14" fill="#fff" ${L}/><rect x="62" y="36" width="76" height="34" rx="6" fill="${ACC}"/>` +
    [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<rect x="${62 + c * 28}" y="${88 + r * 28}" width="20" height="20" rx="4" fill="${INK}"/>`)).join(""),
  pin: `<path d="M100 182 C100 182 38 116 38 80 A62 62 0 0 1 162 80 C162 116 100 182 100 182 Z" fill="${ACC}" ${L}/><circle cx="100" cy="80" r="22" fill="#fff" ${L}/>`,
  persona: `<circle cx="100" cy="64" r="36" fill="#fff" ${L}/><path d="M34 180 C34 126 166 126 166 180 Z" fill="${ACC}" ${L}/>`,
  grupo: `<circle cx="56" cy="80" r="24" fill="#fff" ${L}/><circle cx="144" cy="80" r="24" fill="#fff" ${L}/><path d="M14 170 C14 128 98 128 98 170 Z M102 170 C102 128 186 128 186 170 Z" fill="#fff" ${L}/><circle cx="100" cy="66" r="30" fill="#fff" ${L}/><path d="M46 184 C46 124 154 124 154 184 Z" fill="${ACC}" ${L}/>`,
  corazon: `<path class="late" d="M100 172 C40 126 20 96 20 70 A40 40 0 0 1 100 54 A40 40 0 0 1 180 70 C180 96 160 126 100 172 Z" fill="${ACC}" ${L}/>`,
  foco: `<g class="rayos" stroke="${ACC}" stroke-width="9" stroke-linecap="round"><line x1="100" y1="6" x2="100" y2="-14"/><line x1="30" y1="40" x2="14" y2="28"/><line x1="170" y1="40" x2="186" y2="28"/><line x1="18" y1="100" x2="-2" y2="100"/><line x1="182" y1="100" x2="202" y2="100"/></g><path d="M100 22 A56 56 0 0 1 134 122 V140 H66 V122 A56 56 0 0 1 100 22 Z" fill="#fff" ${L}/><rect x="68" y="150" width="64" height="14" rx="4" fill="${INK}"/><rect x="78" y="170" width="44" height="12" rx="4" fill="${INK}"/>`,
  nube: `<path d="M50 120 A30 30 0 0 1 56 62 A42 42 0 0 1 136 52 A34 34 0 0 1 152 120 Z" fill="#fff" ${L}/><g class="gotas" stroke="${ACC}" stroke-width="9" stroke-linecap="round"><line x1="66" y1="140" x2="58" y2="162"/><line x1="102" y1="140" x2="94" y2="162"/><line x1="138" y1="140" x2="130" y2="162"/></g>`,
  escudo: `<path d="M100 18 L170 44 V94 C170 140 136 168 100 182 C64 168 30 140 30 94 V44 Z" fill="#fff" ${L}/><path d="M68 100 L92 124 L134 78" stroke="${ACC}" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  cohete: `<path d="M100 14 C140 44 146 96 132 144 H68 C54 96 60 44 100 14 Z" fill="#fff" ${L}/><circle cx="100" cy="76" r="18" fill="${ACC}" ${L}/><path d="M68 112 L40 150 L68 144 Z M132 112 L160 150 L132 144 Z" fill="${INK}"/><path class="fuego" d="M80 148 L100 190 L120 148 Z" fill="${ACC}"/>`,
  casa: `<rect x="44" y="90" width="112" height="86" fill="#fff" ${L}/><path d="M22 98 L100 30 L178 98" fill="none" ${L}/><rect x="84" y="120" width="32" height="56" fill="${ACC}"/>`,
  grafica: `<path d="M24 22 V176 H180" fill="none" ${L}/><rect class="barra" x="48" y="120" width="30" height="56" fill="${INK}"/><rect class="barra" x="94" y="88" width="30" height="88" fill="${INK}"/><rect class="barra" x="140" y="44" width="30" height="132" fill="${ACC}"/>`,
  carrito: `<path d="M14 36 H44 L66 136 H164 L182 66 H54" fill="none" ${L}/><rect x="62" y="74" width="108" height="50" fill="${ACC}" opacity=".9"/><circle cx="78" cy="164" r="14" fill="${INK}"/><circle cx="150" cy="164" r="14" fill="${INK}"/>`,
  llave: `<path class="gira" d="M146 26 A42 42 0 0 0 94 82 L34 142 A16 16 0 0 0 58 166 L118 106 A42 42 0 0 0 174 54 L148 80 L124 76 L120 52 Z" fill="#fff" ${L}/>`,
  archivo: `<path d="M52 18 H122 L152 48 V182 H52 Z" fill="#fff" ${L}/><path d="M122 18 V48 H152" fill="none" ${L}/><rect x="66" y="96" width="72" height="40" rx="8" fill="${ACC}"/><text x="102" y="126" font-size="26" text-anchor="middle" fill="#fff" font-family="Archivo Black">CAD</text>`,
  caja: `<path d="M100 24 L172 60 V140 L100 176 L28 140 V60 Z" fill="#fff" ${L}/><path d="M28 60 L100 96 L172 60 M100 96 V176" fill="none" ${L}/><path d="M64 42 L136 78 V102" fill="none" stroke="${ACC}" stroke-width="12" stroke-linecap="round"/>`,
  pregunta: `<circle class="late" cx="100" cy="100" r="82" fill="${ACC}"/><text x="100" y="138" font-size="120" text-anchor="middle" fill="#fff" font-family="Archivo Black">?</text>`,
  alerta: `<path d="M100 20 L184 172 H16 Z" fill="#fff" ${L}/><rect x="91" y="70" width="18" height="58" rx="6" fill="${ACC}"/><circle cx="100" cy="148" r="11" fill="${ACC}"/>`,
  check: `<circle cx="100" cy="100" r="82" fill="${ACC}"/><path d="M60 102 L88 130 L142 72" stroke="#fff" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  maquina: "", // se dibuja aparte (es la máquina del video aprobado)
}
export const NOMBRES_ICONO = Object.keys(ICONOS)

const MAQUINA = (id: string) => `<svg id="${id}" viewBox="0 0 800 520" width="680" height="442" style="position:absolute;left:140px;top:720px;width:800px;height:520px">
<rect x="40" y="300" width="720" height="150" rx="10" fill="#fff" stroke="${INK}" stroke-width="8"/>
<rect x="60" y="450" width="40" height="60" fill="${INK}"/><rect x="700" y="450" width="40" height="60" fill="${INK}"/>
<line x1="70" y1="330" x2="730" y2="330" stroke="${INK}" stroke-width="3" stroke-dasharray="10 12"/>
<rect x="20" y="120" width="40" height="190" fill="${INK}"/><rect x="740" y="120" width="40" height="190" fill="${INK}"/>
<rect x="20" y="100" width="760" height="44" rx="8" fill="${INK}"/>
<path class="corte" d="M150 300 H650" stroke="${ACC}" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1.2" stroke-dashoffset="1.1"/>
<g class="cabezal"><rect x="350" y="80" width="100" height="120" rx="10" fill="#fff" stroke="${INK}" stroke-width="8"/><polygon points="382,200 418,200 406,240 394,240" fill="${INK}"/></g>
<g class="chispas" fill="${ACC}" opacity="0"><circle cx="380" cy="290" r="8"/><circle cx="420" cy="282" r="6"/><circle cx="440" cy="300" r="7"/><circle cx="360" cy="304" r="5"/></g>
</svg>`

// Palabras clave -> icono (para el guion sin IA y como corrección si la IA manda uno que no existe)
const CLAVES: [RegExp, string][] = [
  [/l[aá]ser/i, "laser"],
  [/m[aá]quina|cnc|router|fresad|torno|corte|cortar|maquinad/i, "maquina"],
  [/factur|cfdi|\bsat\b|verific/i, "factura"],
  [/calcul/i, "calculadora"],
  [/env[ií]o|enviar|paquete|paqueter|gu[ií]a|skydropx|env[ií]a\b/i, "camion"],
  [/precio|cobr|cost|dinero|pago|pagar|ganar|comisi|\$|peso/i, "dinero"],
  [/tiempo|hora|r[aá]pid|minuto|tarde|espera/i, "reloj"],
  [/taller/i, "taller"],
  [/cerca|estado|ciudad|ubicaci|zona|radar/i, "pin"],
  [/comunidad|equipo|juntos|grupo|amig/i, "grupo"],
  [/segur|confian|garant|protec|riesgo/i, "escudo"],
  [/sueñ|crec|emprend|meta|futuro|lanza/i, "cohete"],
  [/idea|aprend|capacit|tutorial|ense[ñn]/i, "foco"],
  [/trist|ansied|depres|nervio|preocup|soled|dolor|culpa|frustr|resent|odio|abuso|miedo/i, "nube"],
  [/famil|casa|hogar|tranquil|calma|paz/i, "casa"],
  [/venta|vend|resultado|aument|m[aá]s clientes|creci/i, "grafica"],
  [/tienda|compr|producto|carrito/i, "carrito"],
  [/herramient|mantenim|refacci|repar/i, "llave"],
  [/digital|archivo|dise[ñn]|dxf|stl|plano|cad\b/i, "archivo"],
  [/cuidado|error|evita|problema|falla/i, "alerta"],
  [/cliente|persona|qui[eé]n|t[uú]\b/i, "persona"],
  [/pieza|parte|molde/i, "pieza"],
  [/corazón|amor|cari[ñn]o|quer/i, "corazon"],
]
export function iconoPara(texto: string, sugerido?: string, evitar: string[] = []) {
  if (sugerido && sugerido in ICONOS) return sugerido
  const todos = CLAVES.filter(([re]) => re.test(texto || "")).map(([, ic]) => ic)
  return todos.find((ic) => !evitar.includes(ic)) || ["check", "engrane", "foco"].find((ic) => !evitar.includes(ic)) || todos[0] || "engrane"
}

// Ojo: "sin", "no" y "más" NO se quitan (cambiarían el sentido: "sin comisión")
const VACIAS = new Set("el la los las un una unos unas de del al a en y o que se su sus tu tus mi mis es son lo le les por para con como pero muy ya si hay este esta estos estas ese esa eso the a an of to in and for your you is are it on with".split(" "))

/** Máximo n palabras para pantalla: quita relleno y conserva signos de pregunta. */
export function cuatroPalabras(t: string, n = 4) {
  const limpio = String(t || "").replace(/https?:\/\/\S+|#\S+/g, "").replace(/[“”"«»]/g, "").replace(/\s+/g, " ").trim()
  const pregunta = /[¿?]/.test(limpio)
  const abre = limpio.includes("¿") // en inglés no se abre la pregunta
  const ws = limpio.replace(/[¿?¡!.,;:…]/g, "").split(" ").filter(Boolean)
  let elegidas = ws.length <= n ? ws : ws.filter((w) => !VACIAS.has(w.toLowerCase()))
  if (elegidas.length > n) elegidas = elegidas.slice(0, n)
  if (!elegidas.length) elegidas = ws.slice(0, n)
  let x = elegidas.join(" ")
  x = x.charAt(0).toLocaleUpperCase("es") + x.slice(1)
  return pregunta ? `${abre ? "¿" : ""}${x}?` : x
}

const cifraDe = (t: string) => String(t || "").match(/(\$\s?\d[\d,.]*|\d[\d,.]*\s?%|\d+\s?(?:ejes|horas|días|min|mm|años|talleres|piezas))/i)?.[0] || ""

/** Guion sin IA a partir del gancho y las frases que ya escribió el agente del plan. */
export function bloquesBasicos(g: { gancho: string; frases: string[]; cierre: string }, o: { comunidad?: boolean } = {}): Bloque[] {
  const out: Bloque[] = [{ tipo: "gancho", texto: cuatroPalabras(g.gancho), narracion: g.gancho, icono: iconoPara(g.gancho) }]
  g.frases.forEach((fr) => {
    const cifra = cifraDe(fr)
    // Que no se repita el mismo objeto escena tras escena
    const icono = iconoPara(fr, undefined, out.map((b) => b.icono!))
    out.push(cifra ? { tipo: "dato", texto: cuatroPalabras(fr.replace(cifra, ""), 3), narracion: fr, icono, cifra } : { tipo: "accion", texto: cuatroPalabras(fr), narracion: fr, icono })
  })
  out.push({ tipo: "cierre", texto: g.cierre, narracion: o.comunidad ? g.cierre : `${g.cierre}. En hetnacnc.com` })
  return out
}

/** Limpia y valida lo que mande la IA: tipos e iconos válidos, 4 palabras, cifras sólo si están en la narración. */
export function sanearBloques(bs: any[], cierre: { texto: string; narracion: string }): Bloque[] {
  const ok: Bloque[] = []
  for (const b of (bs || []).slice(0, 6)) {
    if (!b || !TIPOS.includes(b.tipo) || !String(b.narracion || "").trim()) continue
    const texto = cuatroPalabras(b.texto || b.narracion)
    const x: Bloque = { tipo: b.tipo, texto, narracion: String(b.narracion).trim().slice(0, 220), icono: iconoPara(`${b.texto} ${b.narracion}`, b.icono) }
    const ac = String(b.acento || "").trim()
    if (ac && texto.toLowerCase().includes(ac.toLowerCase())) x.acento = ac
    if (b.tipo === "dato") {
      const c = String(b.cifra || "").trim()
      // Nada de cifras inventadas: la cifra tiene que decirse en la narración
      if (c && c.length <= 14 && x.narracion.replace(/\s/g, "").includes(c.replace(/\s/g, ""))) x.cifra = c
      else x.tipo = "accion"
    }
    if (b.tipo === "lista") {
      const it = (b.items || []).map((i: string) => cuatroPalabras(i, 3)).filter(Boolean).slice(0, 3)
      if (it.length >= 2) x.items = it
      else x.tipo = "accion"
    }
    if (b.tipo === "comparar") {
      if (b.mal && b.bien) Object.assign(x, { mal: cuatroPalabras(b.mal, 3), bien: cuatroPalabras(b.bien, 3) })
      else x.tipo = "accion"
    }
    ok.push(x)
  }
  if (!ok.length) return []
  if (ok[0].tipo !== "gancho" && ok[0].tipo !== "pregunta") ok[0].tipo = "gancho"
  ok.push({ tipo: "cierre", texto: cierre.texto, narracion: cierre.narracion })
  return ok
}

const ESQUEMA = {
  type: "object", additionalProperties: false, required: ["bloques"],
  properties: {
    bloques: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["tipo", "texto", "acento", "narracion", "icono", "cifra", "items", "mal", "bien"],
        properties: {
          tipo: { type: "string", enum: [...TIPOS] },
          texto: { type: "string" }, acento: { type: "string" }, narracion: { type: "string" },
          icono: { type: "string", enum: NOMBRES_ICONO },
          cifra: { type: "string" }, items: { type: "array", items: { type: "string" } }, mal: { type: "string" }, bien: { type: "string" },
        },
      },
    },
  },
}

let ia: Anthropic | null = null
/**
 * Guionista: convierte el texto del borrador en 3 a 5 bloques de escena.
 * null si no hay IA o falla (quien llama usa bloquesBasicos).
 */
export async function guionista(p: { texto: string; publico?: string; emocion?: string | null; idioma?: string; cierre: { texto: string; narracion: string }; reglasEmocion?: string }, logger?: any) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    ia ??= new Anthropic()
    const en = p.idioma === "en"
    const resp = await ia.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1500,
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        `Eres el guionista de videos verticales de 15 a 25 segundos de HETNA CNC (marketplace de fabricación CNC). ${PRINCIPIOS_VIDEO} ` +
        "Escribe de 3 a 5 bloques (el cierre con la marca lo pone el sistema; no lo escribas). " +
        "Tipos: gancho (primer bloque: problema o pregunta que detiene el dedo), dato (una cifra REAL que aparezca en el texto; si no hay cifra, no uses dato), " +
        "lista (2 o 3 puntos de máx. 3 palabras), comparar (mal vs bien, máx. 3 palabras cada uno), accion (el objeto hace algo: la máquina corta, el reloj corre, la gráfica sube), " +
        "pregunta (para invitar a comentar). Por bloque: texto = lo que se VE, máx. 4 palabras; acento = UNA palabra de ese texto para resaltar; " +
        "narracion = lo que se DICE, una oración natural de 6 a 16 palabras; icono = el objeto que mejor dibuja literalmente la idea. " +
        "Campos que no aplican: cadena vacía o lista vacía. No inventes precios, cifras, clientes ni promesas; usa sólo lo que dice el texto. " +
        (p.reglasEmocion ? `Emoción: ${p.reglasEmocion} ` : "") +
        (p.publico === "comunidad" ? "Es contenido de comunidad: no vendas nada, termina con una pregunta para comentar. " : "") +
        (en ? "Write texto and narracion in US English." : "Escribe en español de México, tuteando."),
      messages: [{ role: "user", content: `Público: ${p.publico || "general"}${p.emocion ? ` · emoción: ${p.emocion}` : ""}\n\nTexto de la publicación:\n${String(p.texto).slice(0, 2500)}` }],
    } as any)
    if (resp.stop_reason === "refusal") return null
    const txt = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
    const bloques = sanearBloques(JSON.parse(txt).bloques, p.cierre)
    return bloques.length >= 3 ? bloques : null
  } catch (e) {
    logger?.warn?.(`[fabrica] guionista: ${(e as Error).message}`)
    return null
  }
}

/** Lo que dice la voz (la pantalla sigue mostrando la marca escrita normal). */
export function paraVoz(t: string, idioma = "es") {
  let x = String(t || "")
  if (idioma === "en") return x.replace(/hetnacnc\.com/gi, "hetna C N C dot com").replace(/\bHETNA\b/g, "Hetna").replace(/\bCNC\b/g, "C N C")
  return x
    .replace(/hetnacnc\.com/gi, "hetna ce ene ce, punto com")
    .replace(/\bHETNA\b/g, "Hetna")
    .replace(/\bCNC\b/g, "ce ene ce")
    .replace(/\bCAD\b/g, "cad")
    .replace(/\bCFDI\b/g, "ce efe de i")
}

// ---------------------------------------------------------------------
// HTML de la composición
// ---------------------------------------------------------------------

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Divide el texto de pantalla en 1 o 2 renglones parejos y calcula el tamaño para que quepa en 920 px. */
export function acomodarTitulo(t: string, ancho = 920, max = 140, min = 64) {
  const ws = String(t || "").split(/\s+/).filter(Boolean)
  let lineas = [ws.join(" ")]
  if (ws.length >= 2) {
    let mejor: string[] = lineas
    let peor = Infinity
    for (let i = 1; i < ws.length; i++) {
      const a = ws.slice(0, i).join(" ")
      const b = ws.slice(i).join(" ")
      const m = Math.max(a.length, b.length)
      if (m < peor) (peor = m), (mejor = [a, b])
    }
    lineas = mejor
  }
  const largo = Math.max(...lineas.map((l) => l.length), 1)
  // Archivo Black medida en render: 0.52 a 0.6 em por letra; 0.64 deja margen (y nowrap: nunca un 3.er renglón)
  const tam = Math.max(min, Math.min(max, Math.floor(ancho / (largo * 0.64))))
  return { lineas, tam }
}

function tituloHtml(id: string, t: string, acento?: string, clase = "titulo") {
  const { lineas, tam } = acomodarTitulo(t)
  const ac = (acento || lineas.join(" ").split(" ").filter((w) => w.replace(/[¿?]/g, "").length > 3).pop() || "").toLowerCase()
  const pinta = (l: string) =>
    l
      .split(" ")
      .map((w) => (ac && w.toLowerCase().replace(/[¿?¡!.,]/g, "") === ac.replace(/[¿?¡!.,]/g, "") ? `<span class="acento">${esc(w)}</span>` : esc(w)))
      .join(" ")
  return `<div id="${id}" class="${clase}" style="font-size:${tam}px">${lineas.map(pinta).join("<br>")}</div>`
}

const icono = (nombre: string, id: string, tam: number, x: number, y: number) =>
  nombre === "maquina"
    ? MAQUINA(id)
    : `<svg id="${id}" viewBox="-10 -20 220 230" width="${tam}" height="${tam}" style="position:absolute;left:${x}px;top:${y}px;overflow:visible">${ICONOS[nombre] || ICONOS.engrane}</svg>`

/** Subtítulos: grupos de una línea (máx. 28 letras), repartidos en el tiempo de cada frase. */
export function gruposSubtitulo(texto: string, inicio: number, dur: number, max = 28) {
  const ws = String(texto || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  const grupos: string[] = []
  let act = ""
  for (const w of ws) {
    if (act && (act + " " + w).length > max) grupos.push(act), (act = w)
    else act = act ? `${act} ${w}` : w
  }
  if (act) grupos.push(act)
  const total = grupos.reduce((s, g) => s + g.length, 0) || 1
  let t = inicio
  return grupos.map((g) => {
    const d = (dur * g.length) / total
    const r = { texto: g, inicio: Math.round(t * 100) / 100, dur: Math.round(Math.max(0.4, d) * 100) / 100 }
    t += d
    return r
  })
}


// ---------------------------------------------------------------------
// Fondos: cada video sale con un tema distinto (mismo estilo de marca)
// ---------------------------------------------------------------------

export type Tema = { nombre: string; fondo: string; patron: string; texto: string; acento: string; trazo: string; relleno: string; tarjeta: string; tarjetaTexto: string; capFondo: string; capTexto: string; sombra: string; oscuro?: boolean }
const rejilla = (c: string) => `linear-gradient(${c} 2px, transparent 2px), linear-gradient(90deg, ${c} 2px, transparent 2px)`
export const TEMAS: Record<string, Tema> = {
  // El del video aprobado: plano azul claro con cuadrícula
  plano: { nombre: "plano", fondo: FONDO, patron: `background-image:${rejilla("rgba(20,32,51,.07)")};background-size:60px 60px;`, texto: INK, acento: ACC, trazo: INK, relleno: "#ffffff", tarjeta: "#ffffff", tarjetaTexto: INK, capFondo: "rgba(20,32,51,.92)", capTexto: "#ffffff", sombra: "rgba(20,32,51,.15)" },
  // Noche: azul HETNA con cuadrícula clara
  noche: { nombre: "noche", fondo: INK, patron: `background-image:${rejilla("rgba(255,255,255,.06)")};background-size:60px 60px;`, texto: "#F4F1EA", acento: "#F2A25F", trazo: "#F4F1EA", relleno: "#22345A", tarjeta: "#22345A", tarjetaTexto: "#F4F1EA", capFondo: "rgba(244,241,234,.95)", capTexto: INK, sombra: "rgba(0,0,0,.35)", oscuro: true },
  // Papel de taller: cálido con puntos
  papel: { nombre: "papel", fondo: "#F5EFE4", patron: "background-image:radial-gradient(rgba(43,33,24,.14) 3px, transparent 3.5px);background-size:44px 44px;", texto: "#2B2118", acento: ACC, trazo: "#2B2118", relleno: "#FFFDF8", tarjeta: "#FFFDF8", tarjetaTexto: "#2B2118", capFondo: "rgba(43,33,24,.92)", capTexto: "#ffffff", sombra: "rgba(43,33,24,.15)" },
  // Naranja HETNA con rayas diagonales
  naranja: { nombre: "naranja", fondo: ACC, patron: "background-image:repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 26px, transparent 26px 52px);", texto: "#ffffff", acento: INK, trazo: INK, relleno: "#ffffff", tarjeta: "#ffffff", tarjetaTexto: INK, capFondo: "rgba(20,32,51,.92)", capTexto: "#ffffff", sombra: "rgba(20,32,51,.25)" },
  // Acero: gris metálico con líneas finas
  acero: { nombre: "acero", fondo: "#D9DEE4", patron: "background-image:repeating-linear-gradient(0deg, rgba(20,32,51,.06) 0 2px, transparent 2px 14px), linear-gradient(160deg, rgba(255,255,255,.55), rgba(255,255,255,0) 60%);", texto: INK, acento: ACC, trazo: INK, relleno: "#ffffff", tarjeta: "#ffffff", tarjetaTexto: INK, capFondo: "rgba(20,32,51,.92)", capTexto: "#ffffff", sombra: "rgba(20,32,51,.18)" },
  // Foto real de la Biblioteca (del tema del texto), desenfocada y con velo azul
  foto: { nombre: "foto", fondo: INK, patron: "", texto: "#ffffff", acento: "#F2A25F", trazo: INK, relleno: "#ffffff", tarjeta: "#ffffff", tarjetaTexto: INK, capFondo: "rgba(244,241,234,.95)", capTexto: INK, sombra: "rgba(0,0,0,.35)", oscuro: true },
}

/** Tema para una pieza: cambia de un video a otro (según su id) y usa foto sólo si hay. */
export function temaPara(semilla: string, hayFoto = false) {
  const lista = Object.keys(TEMAS).filter((t) => t !== "foto" || hayFoto)
  let h = 0
  for (const c of String(semilla || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return lista[h % lista.length]
}

type Opciones = { duraciones: number[]; voz?: string | null; musica?: string | null; liga?: string; comunidad?: boolean; idioma?: string; tema?: string; foto?: string | null }

/**
 * index.html completo. `duraciones[i]` es lo que dura la voz del bloque i (con su
 * pausa); la escena dura eso y cada acción cae cerca de su palabra clave.
 */
export function componer(bloques: Bloque[], o: Opciones) {
  const en = o.idioma === "en"
  const T = TEMAS[o.tema === "foto" && !o.foto ? "plano" : o.tema || "plano"] || TEMAS.plano
  const liga = (o.liga || "hetnacnc.com").replace(/^https?:\/\//, "").replace(/\/$/, "")
  const escenas: string[] = []
  const anim: string[] = []
  const subs: string[] = []
  let t = 0
  const f = (n: number) => Math.round(n * 1000) / 1000
  bloques.forEach((b, i) => {
    const min = b.tipo === "cierre" ? 3 : 1.8
    const dur = f(Math.max(min, (o.duraciones[i] || 2.4) + (b.tipo === "cierre" ? 0.8 : 0.1)))
    const id = `e${i}`
    const ic = iconoPara(b.texto + " " + b.narracion, b.icono)
    // Momento de la palabra clave dentro de la narración (aprox. por posición)
    const pal = b.narracion.split(/\s+/)
    const k = Math.max(0, pal.findIndex((w) => b.acento && w.toLowerCase().includes(b.acento.toLowerCase())))
    // (a más tardar a la mitad de la escena, para que la acción se alcance a ver)
    const clave = f(t + Math.min(Math.max(0.6, dur * 0.5), Math.max(0.5, (k / Math.max(1, pal.length)) * dur)))
    let html = ""
    const A = (s: string) => anim.push(s)
    if (b.tipo === "cierre") {
      if (o.comunidad) {
        html =
          icono("pregunta", `${id}-ic`, 300, 390, 380) +
          tituloHtml(`${id}-t`, b.texto, b.texto.split(" ").pop(), "titulo centro") +
          `<div id="${id}-marca" class="marca-chica"><span class="acento">HETNA</span> CNC</div>`
        A(`tl.fromTo("#${id}-ic", {scale:.4, opacity:0}, {scale:1, opacity:1, duration:.5, ease:"back.out(1.7)", transformOrigin:"50% 50%"}, ${f(t + 0.1)});`)
        A(`tl.fromTo("#${id}-t", {y:40, opacity:0}, {y:0, opacity:1, duration:.45, ease:"expo.out"}, ${f(t + 0.5)});`)
        A(`tl.fromTo("#${id}-marca", {opacity:0}, {opacity:1, duration:.4}, ${f(t + 1.1)});`)
      } else {
        const cta = esc(b.texto)
        const tamCta = Math.max(44, Math.min(80, Math.floor(720 / (b.texto.length * 0.56))))
        html =
          `<div id="${id}-marca" class="marca"><span class="acento">HETNA</span> CNC</div>` +
          `<div id="${id}-web" class="web">${esc(liga)}</div>` +
          `<div id="${id}-cta" class="cta" style="font-size:${tamCta}px">${cta}</div>` +
          icono("maquina", `${id}-maq`, 0, 0, 0).replace("top:720px", "top:1440px;transform:scale(.5);transform-origin:50% 0")
        A(`tl.fromTo("#${id}-marca", {opacity:0, filter:"blur(10px)"}, {opacity:1, filter:"blur(0px)", duration:.5, ease:"expo.out"}, ${f(t + 0.1)});`)
        A(`tl.fromTo("#${id}-web", {opacity:0, y:30}, {opacity:1, y:0, duration:.5, ease:"expo.out"}, ${f(t + 0.5)});`)
        A(`tl.fromTo("#${id}-cta", {scale:.6, opacity:0}, {scale:1, opacity:1, duration:.45, ease:"back.out(1.6)"}, ${f(t + 1.0)});`)
      }
    } else {
      html += tituloHtml(`${id}-t`, b.texto, b.acento)
      // El cuadro 0 es la miniatura en las redes: la primera escena ya se ve completa
      if (i > 0) A(`tl.fromTo("#${id}-t", {y:40, opacity:0}, {y:0, opacity:1, duration:.4, ease:"expo.out"}, ${f(t + 0.05)});`)
      A(`tl.fromTo("#${id}-t .acento", {color:"${T.texto}"}, {color:"${T.acento}", duration:.25}, ${b.tipo === "gancho" ? f(Math.min(clave, t + 0.6)) : clave});`)
      if (b.tipo === "dato" && b.cifra) {
        html += `<div id="${id}-cifra" class="cifra" style="font-size:${Math.max(90, Math.min(240, Math.floor(980 / (b.cifra.length * 0.62))))}px">${esc(b.cifra)}</div>` + icono(ic === "maquina" ? "engrane" : ic, `${id}-ic`, 260, 410, 920)
        A(`tl.fromTo("#${id}-cifra", {scale:.2, opacity:0}, {scale:1, opacity:1, duration:.7, ease:"expo.out"}, ${clave});`)
        A(`tl.fromTo("#${id}-ic", {y:60, opacity:0}, {y:0, opacity:1, duration:.5, ease:"expo.out"}, ${f(t + 0.3)});`)
      } else if (b.tipo === "lista" && b.items?.length) {
        b.items.forEach((it, j) => {
          const ici = iconoPara(it)
          html += `<div id="${id}-i${j}" class="tarj" style="top:${660 + j * 200}px"><div class="ico">${j + 1}</div><div class="l2">${esc(it)}</div></div>`
          A(`tl.fromTo("#${id}-i${j}", {x:-80, opacity:0}, {x:0, opacity:1, duration:.4, ease:"expo.out"}, ${f(t + 0.4 + (j * (dur - 1)) / b.items!.length)});`)
        })
      } else if (b.tipo === "comparar" && b.mal && b.bien) {
        html +=
          `<div id="${id}-mal" class="lado mal" style="left:70px"><div class="marca-lado">✕</div><div class="l2">${esc(b.mal)}</div></div>` +
          `<div id="${id}-bien" class="lado bien" style="left:570px"><div class="marca-lado">✓</div><div class="l2">${esc(b.bien)}</div></div>`
        A(`tl.fromTo("#${id}-mal", {y:60, opacity:0}, {y:0, opacity:1, duration:.45, ease:"expo.out"}, ${f(t + 0.4)});`)
        A(`tl.to("#${id}-mal", {opacity:.45, scale:.94, duration:.3}, ${f(Math.max(t + 1, clave))});`)
        A(`tl.fromTo("#${id}-bien", {scale:1.6, opacity:0, rotation:-8}, {scale:1, opacity:1, rotation:0, duration:.4, ease:"back.out(1.6)"}, ${f(Math.max(t + 1, clave))});`)
      } else {
        // gancho / accion / pregunta: el objeto actúa
        const nombre = b.tipo === "pregunta" ? "pregunta" : ic
        if (nombre === "maquina") {
          html += MAQUINA(`${id}-ic`)
          if (i > 0) A(`tl.fromTo("#${id}-ic", {y:40, opacity:0}, {y:0, opacity:1, duration:.4, ease:"expo.out"}, ${f(t + 0.1)});`)
          if (b.tipo === "gancho") A(`tl.fromTo("#${id}-ic", {rotation:0}, {rotation:-1.2, duration:.08, yoyo:true, repeat:5, ease:"sine.inOut", transformOrigin:"50% 100%"}, ${clave});`)
          else {
            A(`tl.fromTo("#${id}-ic .cabezal", {y:0}, {y:58, duration:.3, ease:"power2.in"}, ${f(clave - 0.3)});`)
            A(`tl.fromTo("#${id}-ic .corte", {strokeDashoffset:1.1}, {strokeDashoffset:0, duration:${f(Math.max(0.6, dur - (clave - t) - 0.4))}, ease:"none"}, ${clave});`)
            A(`tl.fromTo("#${id}-ic .chispas", {opacity:0, scale:.6}, {opacity:1, scale:1.2, duration:.15, yoyo:true, repeat:5, ease:"sine.inOut", transformOrigin:"50% 50%"}, ${clave});`)
          }
        } else {
          html += icono(nombre, `${id}-ic`, 560, 260, 650)
          if (i > 0) A(`tl.fromTo("#${id}-ic", {scale:.6, opacity:0}, {scale:1, opacity:1, duration:.5, ease:"back.out(1.6)", transformOrigin:"50% 50%"}, ${f(t + 0.15)});`)
          A(accionDe(nombre, `#${id}-ic`, clave, dur - (clave - t)))
        }
      }
    }
    escenas.push(`<div id="${id}" class="clip escena" data-start="${f(t)}" data-duration="${dur}" data-track-index="1"><div class="fondo"></div>${T.nombre === "foto" ? `<div id="${id}-foto" class="foto"></div><div class="velo"></div>` : ""}${html}</div>`)
    if (T.nombre === "foto") anim.push(`tl.fromTo("#${id}-foto", {scale:1.04}, {scale:1.12, duration:${dur}, ease:"none"}, ${f(t)});`)
    for (const g of gruposSubtitulo(b.narracion, t + 0.05, Math.max(0.6, (o.duraciones[i] || dur) - 0.15))) {
      const sid = `c${subs.length}`
      subs.push(`<div id="${sid}" class="cap clip" data-start="${g.inicio}" data-duration="${g.dur}" data-track-index="2"><span>${esc(g.texto)}</span></div>`)
      anim.push(`tl.fromTo("#${sid} span", {opacity:0, y:10}, {opacity:1, y:0, duration:.15, ease:"power3.out"}, ${g.inicio});`)
    }
    t = f(t + dur)
  })
  const total = f(t)
  const audio = [
    o.voz ? `<audio id="voz" class="clip" src="assets/voz.wav" data-start="0" data-duration="${total}" data-track-index="3" data-volume="1"></audio>` : "",
    o.musica ? `<audio id="musica" class="clip" src="assets/musica.mp3" data-start="0" data-duration="${total}" data-track-index="4" data-volume="${o.voz ? 0.12 : 0.5}"></audio>` : "",
  ].join("\n")
  return {
    total,
    html: `<!doctype html>
<html lang="${en ? "en" : "es"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="assets/gsap.min.js"></script>
<style>
@font-face { font-family: "Archivo Black"; src: url("assets/Archivo-900.ttf"); font-weight: 400; }
@font-face { font-family: "Archivo XB"; src: url("assets/Archivo-800.ttf"); font-weight: 800; }
* { margin:0; padding:0; box-sizing:border-box; }
:root { --fondo:${T.fondo}; --texto:${T.texto}; --acento:${T.acento}; --trazo:${T.trazo}; --relleno:${T.relleno}; --tarjeta:${T.tarjeta}; --tarjeta-texto:${T.tarjetaTexto}; --cap-fondo:${T.capFondo}; --cap-texto:${T.capTexto}; --sombra:${T.sombra}; }
html, body { width:1080px; height:1920px; overflow:hidden; background:var(--fondo); }
#root { position:relative; width:100%; height:100%; overflow:hidden; font-family:"Archivo Black", sans-serif; color:var(--texto); }
.escena { position:absolute; inset:0; overflow:hidden; }
.fondo { position:absolute; inset:0; background-color:var(--fondo); ${T.patron} }
.foto { position:absolute; inset:-40px; background:url("assets/fondo.jpg") center/cover; }
.velo { position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,32,51,.88) 0%, rgba(20,32,51,.62) 45%, rgba(20,32,51,.9) 100%); }
.titulo { position:absolute; left:80px; width:920px; top:250px; line-height:.95; letter-spacing:-.02em; white-space:nowrap; }
.titulo.centro { text-align:center; top:760px; white-space:normal; }
.acento { color:var(--acento); }
.cifra { position:absolute; left:0; width:1080px; top:620px; text-align:center; font-size:240px; line-height:1; color:var(--acento); white-space:nowrap; }
.tarj { position:absolute; left:120px; width:840px; height:170px; background:var(--tarjeta); color:var(--tarjeta-texto); border:6px solid var(--trazo); border-radius:24px; display:flex; align-items:center; gap:30px; padding:0 34px; box-shadow:0 14px 0 var(--sombra); }
.tarj .ico { width:100px; height:100px; border-radius:20px; background:var(--acento); color:#fff; font-size:60px; display:flex; align-items:center; justify-content:center; flex:none; }
.l2 { font-size:58px; line-height:1; }
.lado { position:absolute; top:660px; width:440px; height:500px; border:6px solid var(--trazo); border-radius:28px; background:var(--tarjeta); color:var(--tarjeta-texto); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px; padding:30px; text-align:center; box-shadow:0 14px 0 var(--sombra); }
.lado .l2 { font-size:56px; }
.marca-lado { width:120px; height:120px; border-radius:60px; display:flex; align-items:center; justify-content:center; font-size:72px; color:#fff; font-family:"Archivo XB"; }
.mal .marca-lado { background:#5b6b80; } .bien .marca-lado { background:var(--acento); } .bien { border-color:var(--acento); }
.marca { position:absolute; left:0; width:1080px; top:540px; text-align:center; font-size:132px; line-height:1; white-space:nowrap; }
.marca-chica { position:absolute; left:0; width:1080px; top:1560px; text-align:center; font-size:54px; white-space:nowrap; }
.web { position:absolute; left:0; width:1080px; top:720px; text-align:center; font-family:"Archivo XB"; font-size:68px; }
.cta { position:absolute; left:140px; width:800px; top:880px; height:150px; border-radius:30px; background:var(--acento); color:${T.nombre === "naranja" ? "#ffffff" : T.oscuro ? INK : "#ffffff"}; display:flex; align-items:center; justify-content:center; white-space:nowrap; }
.cap { position:absolute; left:60px; width:960px; top:1300px; text-align:center; }
.cap span { display:inline-block; font-family:"Archivo XB"; font-size:50px; line-height:1.1; color:var(--cap-texto); background:var(--cap-fondo); padding:12px 24px; border-radius:16px; white-space:nowrap; }
/* Los dibujos toman los colores del tema */
svg [stroke="${INK}"] { stroke:var(--trazo); } svg [fill="${INK}"] { fill:var(--trazo); }
svg [fill="#fff"][stroke] { fill:var(--relleno); } svg [fill="${ACC}"] { fill:var(--acento); } svg [stroke="${ACC}"] { stroke:var(--acento); }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
${escenas.join("\n")}
${subs.join("\n")}
${audio}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${anim.join("\n")}
window.__timelines["main"] = tl;
</script>
</body>
</html>
`,
  }
}

/** Movimiento propio de cada objeto (dibujar literalmente la idea). */
function accionDe(nombre: string, sel: string, t: number, resto: number) {
  const d = Math.max(0.6, resto - 0.3).toFixed(2)
  switch (nombre) {
    case "engrane":
    case "llave":
      return `tl.fromTo("${sel} .gira", {rotation:0}, {rotation:${nombre === "llave" ? 40 : 180}, duration:${d}, ease:"power1.inOut", svgOrigin:"100 100"}, ${t});`
    case "reloj":
      return `tl.fromTo("${sel} .manecilla", {rotation:0}, {rotation:300, duration:${d}, ease:"power1.inOut", svgOrigin:"100 100"}, ${t});`
    case "grafica":
      return `tl.fromTo("${sel} .barra", {scaleY:0}, {scaleY:1, duration:.5, stagger:.15, ease:"back.out(1.4)", transformOrigin:"50% 100%"}, ${t});`
    case "camion":
      return `tl.fromTo("${sel} .rueda-todo", {x:-60}, {x:60, duration:${d}, ease:"power1.inOut"}, ${t});`
    case "cohete":
      return `tl.fromTo("${sel}", {y:0}, {y:-120, duration:${d}, ease:"power2.in"}, ${t}); tl.fromTo("${sel} .fuego", {scaleY:.6}, {scaleY:1.3, duration:.12, yoyo:true, repeat:7, svgOrigin:"100 148"}, ${t});`
    case "laser":
      return `tl.fromTo("${sel} .haz", {opacity:.2}, {opacity:1, duration:.1, yoyo:true, repeat:9}, ${t});`
    case "foco":
      return `tl.fromTo("${sel} .rayos", {opacity:0, scale:.7}, {opacity:1, scale:1, duration:.4, ease:"back.out(2)", svgOrigin:"100 90"}, ${t});`
    case "nube":
      return `tl.fromTo("${sel} .gotas", {y:-10, opacity:0}, {y:14, opacity:1, duration:.35, yoyo:true, repeat:3, ease:"sine.inOut"}, ${t});`
    case "corazon":
    case "pregunta":
      return `tl.fromTo("${sel} .late", {scale:1}, {scale:1.12, duration:.2, yoyo:true, repeat:3, ease:"sine.inOut", svgOrigin:"100 100"}, ${t});`
    case "alerta":
      return `tl.fromTo("${sel}", {rotation:0}, {rotation:6, duration:.07, yoyo:true, repeat:7, transformOrigin:"50% 90%"}, ${t});`
    default:
      return `tl.fromTo("${sel}", {scale:1}, {scale:1.1, duration:.18, yoyo:true, repeat:1, ease:"power2.out", transformOrigin:"50% 50%"}, ${t});`
  }
}

// ---------------------------------------------------------------------
// Render (uno a la vez, prioridad baja, con tope)
// ---------------------------------------------------------------------

const ENV = () => ({
  ...process.env,
  HF_CLI_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
  PRODUCER_BROWSER_GPU_MODE: "software",
})

function correrHF(args: string[], cwd: string, tope: number) {
  return new Promise<{ code: number; out: string }>((ok) => {
    const usaNice = process.platform === "linux" && fs.existsSync("/usr/bin/nice")
    const p = spawn(usaNice ? "/usr/bin/nice" : BIN(), usaNice ? ["-n", "19", BIN(), ...args] : args, { cwd, env: ENV(), detached: true, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    const toma = (d: Buffer) => {
      out += d.toString()
      if (out.length > 20000) out = out.slice(-20000)
    }
    p.stdout.on("data", toma)
    p.stderr.on("data", toma)
    const matar = () => {
      try {
        process.kill(-p.pid!, "SIGKILL") // grupo completo: CLI + Chrome + ffmpeg
      } catch {}
    }
    const t = setTimeout(() => {
      out += "\n[tope de tiempo]"
      matar()
    }, tope)
    p.on("close", (code) => {
      clearTimeout(t)
      matar()
      ok({ code: code ?? 1, out })
    })
    p.on("error", (e) => {
      clearTimeout(t)
      ok({ code: 1, out: String(e) })
    })
  })
}

async function traer(src: string, destino: string) {
  if (/^https?:\/\//.test(src)) {
    const r = await fetch(src, { signal: AbortSignal.timeout(60_000) })
    if (!r.ok) throw new Error(`descarga ${r.status}`)
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()))
  } else fs.copyFileSync(src, destino)
}

let cola: Promise<any> = Promise.resolve()
let enCola = 0

/**
 * Hace el MP4. Devuelve { buf, segundos } (igual que corto()) o null si
 * HyperFrames no está, la revisión encuentra errores o se pasa del tope.
 */
export async function videoHF(bloques: Bloque[], o: Opciones & { logger?: any }) {
  if (!hfDisponible() || !bloques?.length) return null
  if (enCola >= 3) {
    o.logger?.warn?.("[fabrica] hyperframes: cola llena, se usa el video de FFmpeg")
    return null
  }
  enCola++
  const turno = cola.then(() => hacer(bloques, o)).then((r) => (anotar(!!r, o.logger), r))
  cola = turno.catch(() => null)
  try {
    return await turno
  } finally {
    enCola--
  }
}

async function hacer(bloques: Bloque[], o: Opciones & { logger?: any }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-hf-"))
  try {
    fs.mkdirSync(path.join(dir, "assets"))
    fs.copyFileSync(GSAP(), path.join(dir, "assets", "gsap.min.js"))
    for (const p of [800, 900]) fs.copyFileSync(path.join(carpetaFuentes(), `Archivo-${p}.ttf`), path.join(dir, "assets", `Archivo-${p}.ttf`))
    let voz = o.voz
    if (voz) {
      try {
        await traer(voz, path.join(dir, "assets", "voz.wav"))
      } catch (e) {
        o.logger?.warn?.(`[fabrica] hyperframes voz: ${(e as Error).message}`)
        voz = null
      }
    }
    let musica = o.musica
    if (musica) {
      try {
        await traer(musica, path.join(dir, "assets", "musica.mp3"))
      } catch {
        musica = null
      }
    }
    let foto = o.tema === "foto" ? o.foto : null
    if (foto) {
      try {
        const crudo = path.join(dir, "assets", "fondo-original")
        await traer(foto, crudo)
        // Desenfoque y tamaño una sola vez aquí (en Chrome costaría en cada cuadro)
        await sharp(crudo).rotate().resize(1160, 2000, { fit: "cover" }).blur(7).modulate({ saturation: 0.85 }).jpeg({ quality: 82 }).toFile(path.join(dir, "assets", "fondo.jpg"))
        fs.rmSync(crudo, { force: true })
      } catch {
        foto = null
      }
    }
    const { html, total } = componer(bloques, { ...o, voz, musica, foto, tema: o.tema === "foto" && !foto ? temaPara(String(bloques[0]?.texto)) : o.tema })
    fs.writeFileSync(path.join(dir, "index.html"), html)
    fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ name: "hetna" }))
    const inicio = Date.now()
    const rev = await correrHF(["check", "--json"], dir, 120_000)
    const errores = revisar(rev.out)
    if (rev.code !== 0 && errores.length) {
      o.logger?.warn?.(`[fabrica] hyperframes check: ${errores.slice(0, 3).join(" | ")}`)
      return null
    }
    const salida = path.join(dir, "video.mp4")
    const r = await correrHF(["render", "-o", salida, "-w", "1", "-q", "looks", "--quiet"], dir, Math.max(30_000, TOPE_MS() - (Date.now() - inicio)))
    if (r.code !== 0 || !fs.existsSync(salida)) {
      o.logger?.warn?.(`[fabrica] hyperframes render: ${r.out.slice(-300)}`)
      return null
    }
    const buf = fs.readFileSync(salida)
    o.logger?.info?.(`[fabrica] hyperframes: video de ${total}s en ${Math.round((Date.now() - inicio) / 1000)}s`)
    return { buf, segundos: total }
  } catch (e) {
    o.logger?.warn?.(`[fabrica] hyperframes: ${(e as Error).message}`)
    return null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Errores de `check --json` (lint, runtime, layout…; los avisos no detienen el video). */
export function revisar(out: string) {
  try {
    const j = JSON.parse(out.slice(out.indexOf("{")))
    const lista: string[] = []
    for (const [k, v] of Object.entries<any>(j)) {
      if (!v || typeof v !== "object") continue
      for (const f of v.findings || []) if (f?.severity === "error") lista.push(`${k}: ${f.code || ""} ${f.selector || ""} ${String(f.message || "").slice(0, 80)}`.trim())
      for (const e of v.errors || []) lista.push(`${k}: ${e?.message || e?.code || String(e).slice(0, 80)}`)
    }
    if (lista.length) return lista
    return j.ok === false ? ["check: ok=false"] : []
  } catch {
    return /error/i.test(out) ? [out.slice(-200)] : []
  }
}

/** Duración real del audio (para el respaldo cuando la voz no trae duraciones). */
export function duracionAudio(f: string) {
  const r = spawnSync(ffmpegBin().replace(/ffmpeg$/, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" })
  return Number(String(r.stdout).trim()) || 0
}
