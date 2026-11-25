// Perfil de taller del foro (tipo LinkedIn): lectura y limpieza de las listas
// nuevas del perfil (máquinas, materiales, portafolio y zonas que atiende).
// Lo usan las consultas (al leer de la base) y las acciones (al guardar lo que
// manda el navegador): así lo guardado y lo mostrado siempre tienen la misma forma.
// Sin "use server": son funciones normales, no acciones.

import { revisarMensaje } from "@/lib/chat/filtro"

import { revisarTexto } from "./filtro"
import {
  ESTADOS_MX,
  type Equipo,
  MATERIALES_TALLER,
  MAX_EQUIPOS,
  MAX_FOTOS_TRABAJO,
  MAX_TRABAJOS,
  type MaterialEspesor,
  type MaterialTaller,
  TIPOS_MAQUINA,
  TODO_MEXICO,
  type TipoMaquina,
  type Trabajo,
} from "./tipos"

type Obj = Record<string, unknown>
const esObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v)
const esId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)

export const esTipoMaquina = (v: unknown): v is TipoMaquina => typeof v === "string" && v in TIPOS_MAQUINA
export const esMaterial = (v: unknown): v is MaterialTaller => typeof v === "string" && v in MATERIALES_TALLER

/** Texto de una línea, con el filtro de datos de contacto del chat (teléfono, correo, WhatsApp). */
export const lineaLimpia = (v: unknown, max: number) =>
  typeof v === "string" ? revisarTexto(v.replace(/\s+/g, " ").trim().slice(0, max)).texto : ""
const textoLimpio = (v: unknown, max: number) =>
  typeof v === "string" ? revisarTexto(v.replace(/\r\n?/g, "\n").trim().slice(0, max)).texto : ""

/** Número positivo con tope (acepta "1,300" o "1300.5"); vacío o inválido = null. */
export function medida(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "").trim()) : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.round(n * 100) / 100, max)
}

/** Zonas que atiende: "Todo México" o estados de la lista oficial. */
export function leerZonas(v: unknown): string[] {
  const l = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
  if (l.includes(TODO_MEXICO)) return [TODO_MEXICO]
  return ESTADOS_MX.filter((e) => e !== "Fuera de México" && l.includes(e))
}

/** Máquinas. `fotosOk` (opcional) = fotos que de verdad subió esa persona. */
export function leerEquipos(v: unknown, fotosOk?: Set<string>): Equipo[] {
  const out: Equipo[] = []
  for (const x of Array.isArray(v) ? v : []) {
    if (!esObj(x) || !esTipoMaquina(x.tipo)) continue
    const foto = esId(x.foto) && (!fotosOk || fotosOk.has(x.foto)) ? x.foto : null
    out.push({
      tipo: x.tipo,
      modelo: lineaLimpia(x.modelo, 80),
      largo: medida(x.largo, 100000),
      ancho: medida(x.ancho, 100000),
      alto: medida(x.alto, 100000),
      potencia: medida(x.potencia, 1000000),
      unidad: x.unidad === "A" ? "A" : "W",
      foto,
    })
    if (out.length >= MAX_EQUIPOS) break
  }
  return out
}

/** Materiales y espesores (mm). Un material sólo una vez; si min > max se voltean. */
export function leerMateriales(v: unknown): MaterialEspesor[] {
  const out: MaterialEspesor[] = []
  for (const x of Array.isArray(v) ? v : []) {
    if (!esObj(x) || !esMaterial(x.material) || out.some((m) => m.material === x.material)) continue
    let min = medida(x.min, 1000)
    let max = medida(x.max, 1000)
    if (min && max && min > max) [min, max] = [max, min]
    out.push({ material: x.material, min, max })
  }
  return out
}

/** Portafolio: de 1 a 5 fotos por trabajo; sin fotos o sin título no se guarda. */
export function leerPortafolio(v: unknown, fotosOk?: Set<string>): Trabajo[] {
  const out: Trabajo[] = []
  for (const x of Array.isArray(v) ? v : []) {
    if (!esObj(x)) continue
    const fotos = [...new Set((Array.isArray(x.fotos) ? x.fotos : []).filter((f): f is string => esId(f) && (!fotosOk || fotosOk.has(f))))].slice(
      0,
      MAX_FOTOS_TRABAJO
    )
    const titulo = lineaLimpia(x.titulo, 100)
    if (!fotos.length || titulo.length < 2) continue
    out.push({
      id: typeof x.id === "string" && /^[a-z0-9]{6,20}$/.test(x.id) ? x.id : Math.random().toString(36).slice(2, 12),
      titulo,
      material: esMaterial(x.material) ? x.material : "",
      espesor: medida(x.espesor, 1000),
      maquina: esTipoMaquina(x.maquina) ? x.maquina : "",
      detalle: textoLimpio(x.detalle, 500),
      fotos,
    })
    if (out.length >= MAX_TRABAJOS) break
  }
  return out
}

/** Ids de fotos que trae una lista (máquinas o portafolio), para revisar que sean de la persona. */
export function fotosDeLista(v: unknown): string[] {
  const ids = new Set<string>()
  for (const x of Array.isArray(v) ? v : []) {
    if (!esObj(x)) continue
    if (esId(x.foto)) ids.add(x.foto)
    if (Array.isArray(x.fotos)) for (const f of x.fotos) if (esId(f)) ids.add(f)
  }
  return [...ids]
}

// En el perfil no se permite capturar teléfono, WhatsApp, correo, redes ni ligas
// externas: se usa el mismo filtro del chat en modo BLOQUEO (no se guarda y se
// explica por qué). El contacto es sólo con "Mensaje" o "Pedir cotización".
const NOMBRES_MOTIVO: Record<string, string> = {
  telefono: "teléfonos",
  correo: "correos o @usuarios",
  red_social: "WhatsApp o redes sociales",
  enlace: "ligas a otras páginas",
  frase_contacto: "frases para que te contacten por fuera",
}
/** null si todo bien; si no, el mensaje para la persona. `donde` = "Acerca de", "el portafolio"… */
export function contactoProhibido(textos: unknown[], donde: string): string | null {
  const motivos = new Set<string>()
  for (const t of textos) {
    if (typeof t !== "string" || !t.trim()) continue
    for (const m of revisarMensaje(t).motivos) motivos.add(m)
  }
  if (!motivos.size) return null
  const nombres = [...motivos].map((m) => NOMBRES_MOTIVO[m] || m)
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0]
  return `Quita ${lista} de ${donde}. Por seguridad, los clientes te contactan sólo con "Mensaje" o "Pedir cotización" dentro de HETNA.`
}

