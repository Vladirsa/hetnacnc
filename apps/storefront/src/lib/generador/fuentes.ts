// Tipografías libres (licencia OFL) servidas por Fontsource, cargadas con
// opentype.js desde el navegador. Las usan Letreros y Llaveros.

import type { Fuente } from "@/lib/generador/letreros"

const CDN = "https://cdn.jsdelivr.net/npm"
const OPENTYPE = `${CDN}/opentype.js@1.3.4/dist/opentype.min.js`

export type Tipo = { id: string; peso: number; nombre: string; grupo: "Molde" | "Cursiva" | "Esténcil" }

export const FUENTES: Tipo[] = [
  { id: "anton", peso: 400, nombre: "Anton", grupo: "Molde" },
  { id: "bebas-neue", peso: 400, nombre: "Bebas Neue", grupo: "Molde" },
  { id: "montserrat", peso: 800, nombre: "Montserrat", grupo: "Molde" },
  { id: "oswald", peso: 700, nombre: "Oswald", grupo: "Molde" },
  { id: "roboto-slab", peso: 700, nombre: "Roboto Slab", grupo: "Molde" },
  { id: "alfa-slab-one", peso: 400, nombre: "Alfa Slab", grupo: "Molde" },
  { id: "cinzel", peso: 700, nombre: "Cinzel", grupo: "Molde" },
  { id: "righteous", peso: 400, nombre: "Righteous", grupo: "Molde" },
  { id: "bungee", peso: 400, nombre: "Bungee", grupo: "Molde" },
  { id: "black-ops-one", peso: 400, nombre: "Black Ops", grupo: "Molde" },
  { id: "pacifico", peso: 400, nombre: "Pacifico", grupo: "Cursiva" },
  { id: "lobster", peso: 400, nombre: "Lobster", grupo: "Cursiva" },
  { id: "great-vibes", peso: 400, nombre: "Great Vibes", grupo: "Cursiva" },
  { id: "dancing-script", peso: 700, nombre: "Dancing Script", grupo: "Cursiva" },
  { id: "kaushan-script", peso: 400, nombre: "Kaushan", grupo: "Cursiva" },
  { id: "yellowtail", peso: 400, nombre: "Yellowtail", grupo: "Cursiva" },
  { id: "sacramento", peso: 400, nombre: "Sacramento", grupo: "Cursiva" },
  { id: "stardos-stencil", peso: 700, nombre: "Stardos Stencil", grupo: "Esténcil" },
  { id: "allerta-stencil", peso: 400, nombre: "Allerta Stencil", grupo: "Esténcil" },
]

export const archivoFuente = (t: Tipo, ext: "woff" | "woff2") => `${CDN}/@fontsource/${t.id}@5.3.0/files/${t.id}-latin-${t.peso}-normal.${ext}`

type Opentype = { parse(b: ArrayBuffer): Fuente }
let opentypeListo: Promise<Opentype> | null = null
export function cargarOpentype(): Promise<Opentype> {
  if (!opentypeListo) {
    opentypeListo = new Promise((ok, mal) => {
      const w = window as unknown as { opentype?: Opentype }
      if (w.opentype) return ok(w.opentype)
      const s = document.createElement("script")
      s.src = OPENTYPE
      s.async = true
      s.onload = () => (w.opentype ? ok(w.opentype) : mal(new Error("opentype")))
      s.onerror = () => { opentypeListo = null; mal(new Error("opentype")) }
      document.head.appendChild(s)
    })
  }
  return opentypeListo
}

const cache = new Map<string, Promise<Fuente>>()
export function cargarFuente(t: Tipo): Promise<Fuente> {
  let p = cache.get(t.id)
  if (!p) {
    p = Promise.all([cargarOpentype(), fetch(archivoFuente(t, "woff")).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() })]).then(([ot, b]) => ot.parse(b))
    p.catch(() => cache.delete(t.id))
    cache.set(t.id, p)
  }
  return p
}

// @font-face de cada tipografía para que los botones se vean con su letra
export function instalarFuentesVista() {
  const id = "hetna-fuentes-letrero"
  if (document.getElementById(id)) return
  const st = document.createElement("style")
  st.id = id
  st.textContent = FUENTES.map((t) => `@font-face{font-family:"hl-${t.id}";src:url(${archivoFuente(t, "woff2")}) format("woff2");font-weight:${t.peso};font-display:swap}`).join("")
  document.head.appendChild(st)
}
