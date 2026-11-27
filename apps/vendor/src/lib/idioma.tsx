// @ts-nocheck
// Panel del taller en inglés (fase 5 del inglés).
//
// El idioma lo elige el taller en su perfil del panel (Mercur lo guarda en la
// cookie y en localStorage "lng"). Las páginas propias de HETNA
// (src/routes/*) están escritas en español; aquí se traducen con el
// diccionario de src/lib/panel-en/*.ts, que sólo se descarga si el panel va en inglés.
//
//   <T>Texto en español</T>          texto fijo o que viene de datos
//   const t = useT(); t("Guardar")   para placeholders, títulos, alert…
//
// Frases con datos: en el diccionario la llave lleva {0}, {1}…
// ("Tienes {0} pedidos" → "You have {0} orders") y se aplica a "Tienes 3 pedidos".
import { useSyncExternalStore } from "react"

type Dic = { EN: Record<string, string>; PLANTILLAS: [RegExp, string][] }

export type IdiomaPanel = "es" | "en"

export function idiomaPanel(): IdiomaPanel {
  try {
    const cookie = document.cookie.match(/(?:^|;\s*)lng=([^;]+)/)?.[1]
    const valor = decodeURIComponent(cookie || localStorage.getItem("lng") || "es")
    return valor.toLowerCase().startsWith("en") ? "en" : "es"
  } catch {
    return "es"
  }
}

let dic: Dic | null = null
let cargando: Promise<Dic> | null = null
const avisos = new Set<() => void>()

function cargar(): Promise<Dic> {
  cargando ??= import("./panel-en").then((m) => {
    const plantillas: [RegExp, string][] = []
    const EN: Record<string, string> = {}
    for (const [k, v] of Object.entries(m.PANEL_EN as Record<string, string>)) {
      if (/\{\d\}/.test(k)) {
        const re = new RegExp("^" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{(\d)\\\}/g, "(.*?)") + "$")
        plantillas.push([re, v])
      } else EN[k] = v
    }
    dic = { EN, PLANTILLAS: plantillas }
    for (const f of avisos) f()
    return dic
  })
  return cargando
}

/** Texto en el idioma del panel (el original si no hay traducción). */
export function traducir(texto: string, idioma: IdiomaPanel = idiomaPanel()): string {
  if (idioma !== "en" || typeof texto !== "string") return texto
  if (!dic) {
    cargar()
    return texto
  }
  const limpio = texto.trim()
  if (!limpio) return texto
  const directo = dic.EN[limpio]
  if (directo !== undefined) return texto.replace(limpio, () => directo)
  for (const [re, v] of dic.PLANTILLAS) {
    const m = limpio.match(re)
    if (m) return texto.replace(limpio, () => v.replace(/\{(\d)\}/g, (_, i) => m[Number(i) + 1] ?? ""))
  }
  return texto
}

// Un solo vigilante para todo el panel (no uno por cada <T>)
let actual: IdiomaPanel = typeof document !== "undefined" ? idiomaPanel() : "es"
let version = 0
const oyentes = new Set<() => void>()
let reloj: ReturnType<typeof setInterval> | null = null
const avisarTodos = () => {
  version++
  for (const f of oyentes) f()
}
avisos.add(avisarTodos)
function revisar() {
  const nuevo = idiomaPanel()
  if (nuevo !== actual) {
    actual = nuevo
    if (nuevo === "en" && !dic) cargar()
    avisarTodos()
  }
}
function suscribir(f: () => void) {
  oyentes.add(f)
  if (!reloj) {
    reloj = setInterval(revisar, 1500)
    window.addEventListener("focus", revisar)
  }
  return () => {
    oyentes.delete(f)
    if (!oyentes.size && reloj) {
      clearInterval(reloj)
      reloj = null
      window.removeEventListener("focus", revisar)
    }
  }
}

/** Idioma del panel; se actualiza si el taller lo cambia en su perfil. */
export function useIdiomaPanel(): IdiomaPanel {
  // version cambia al cambiar el idioma o al terminar de bajar el diccionario
  useSyncExternalStore(suscribir, () => version)
  if (actual === "en" && !dic) cargar()
  return actual
}

export function useT() {
  const idioma = useIdiomaPanel()
  return (texto: string) => traducir(texto, idioma)
}

export function T({ children }: { children?: any }) {
  const idioma = useIdiomaPanel()
  if (typeof children === "string") return <>{traducir(children, idioma)}</>
  return <>{children}</>
}
