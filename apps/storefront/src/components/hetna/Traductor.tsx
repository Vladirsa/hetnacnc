"use client"

import { useEffect } from "react"

import type * as Diccionario from "@/i18n/en"
import { COOKIE_IDIOMA } from "@/i18n/idioma"

// Traduce la tienda al ingles cuando el cliente elige EN.
// Cambia solo el texto visible (sin tocar la estructura), asi React sigue
// funcionando normal. Las palabras vienen del diccionario src/i18n/en.ts.
// VELOCIDAD: el diccionario se descarga SOLO si el cliente eligio ingles
// (import dinamico). Los visitantes en espanol ya no lo cargan.

export const leerIdioma = (): "es" | "en" => {
  try {
    const c = document.cookie
      .split("; ")
      .find((x) => x.startsWith(COOKIE_IDIOMA + "="))
    return c?.split("=")[1] === "en" ? "en" : "es"
  } catch {
    return "es"
  }
}

// Se llenan cuando llega el diccionario (solo en ingles)
let EN = {} as typeof Diccionario.EN
let REGLAS = [] as unknown as typeof Diccionario.REGLAS

const ATRIBUTOS = ["placeholder", "aria-label", "title", "alt"]
const IGNORAR = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"])

const traducir = (texto: string): string | null => {
  const limpio = texto.trim()
  if (!limpio) return null
  const directo = (EN as Record<string, string>)[limpio]
  if (directo !== undefined) {
    return directo === limpio ? null : texto.replace(limpio, directo)
  }
  for (const [re, reemplazo] of REGLAS) {
    if (re.test(limpio)) return texto.replace(limpio, limpio.replace(re, reemplazo))
  }
  return null
}

const traducirAtributo = (el: Element, nombre: string) => {
  const v = el.getAttribute(nombre)
  if (!v) return
  const r = traducir(v)
  if (r !== null && r !== v) el.setAttribute(nombre, r)
}

const recorrer = (nodo: Node) => {
  if (nodo.nodeType === Node.TEXT_NODE) {
    const t = nodo as Text
    const r = traducir(t.nodeValue || "")
    if (r !== null && r !== t.nodeValue) t.nodeValue = r
    return
  }
  if (nodo.nodeType !== Node.ELEMENT_NODE) return
  const el = nodo as HTMLElement
  if (IGNORAR.has(el.tagName) || el.isContentEditable) return
  for (const a of ATRIBUTOS) traducirAtributo(el, a)
  if (el instanceof HTMLInputElement && ["submit", "button"].includes(el.type)) {
    const r = traducir(el.value)
    if (r !== null && r !== el.value) el.value = r
  }
  el.childNodes.forEach(recorrer)
}

const quitarVelo = () => document.getElementById("hetna-en-velo")?.remove()

export const Traductor = () => {
  useEffect(() => {
    if (leerIdioma() !== "en") {
      quitarVelo()
      return
    }

    let activo = true
    let observador: MutationObserver | null = null

    const titulo = () => {
      const r = traducir(document.title)
      if (r !== null && r !== document.title) document.title = r
    }
    const idiomaHtml = () => {
      if (document.documentElement.lang !== "en") document.documentElement.lang = "en"
    }

    import("@/i18n/en")
      .then((m) => {
        if (!activo) return
        EN = m.EN
        REGLAS = m.REGLAS

        recorrer(document.body)
        titulo()
        idiomaHtml()
        quitarVelo()

        observador = new MutationObserver((cambios) => {
          for (const c of cambios) {
            if (c.type === "childList") c.addedNodes.forEach(recorrer)
            else if (c.type === "characterData") recorrer(c.target)
            else if (c.type === "attributes" && c.attributeName)
              traducirAtributo(c.target as Element, c.attributeName)
          }
          titulo()
          idiomaHtml()
        })
        observador.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ATRIBUTOS,
        })
      })
      // Si el diccionario no carga, al menos mostramos la pagina en espanol
      .catch(() => quitarVelo())

    return () => {
      activo = false
      observador?.disconnect()
    }
  }, [])

  return null
}
