// Idioma de la página en el servidor (lo que lee Google).
// La cookie elegida manda; sin elección, /us es inglés y lo demás español.
// nginx guarda la caché de páginas por idioma (infra/nginx/hetna-cache-paginas.conf),
// así que el HTML en inglés y el de español nunca se mezclan.
import { cookies, headers } from "next/headers"
import { cache } from "react"

import { COOKIE_IDIOMA } from "./idioma"
import { crearT, sinTraducir } from "./traducir"

export type Idioma = "es" | "en"

export const idiomaServidor = cache(async (): Promise<Idioma> => {
  const locale = (await headers()).get("x-hetna-locale") || ""
  const elegido = (await cookies()).get(COOKIE_IDIOMA)?.value
  return (elegido ? elegido === "en" : locale === "us") ? "en" : "es"
})

/** t() para componentes de servidor y generateMetadata: `const t = await traductor()` */
export const traductor = cache(async () => {
  if ((await idiomaServidor()) !== "en") return sinTraducir
  const { EN, REGLAS } = await import("./diccionario")
  return crearT(EN, REGLAS)
})

/** Traduce los textos de la metadata (título, descripción, Open Graph). */
export async function metaEnIdioma<M extends Record<string, any>>(m: M): Promise<M> {
  const t = await traductor()
  if (t === sinTraducir) return m
  const tr = (v: unknown) => (typeof v === "string" ? t(v) : v)
  const titulo = (v: any) =>
    typeof v === "string" ? t(v) : v && typeof v === "object" ? { ...v, ...(v.default ? { default: t(v.default) } : {}), ...(typeof v.template === "string" ? { template: v.template.replace(/^%s \| (.+)$/, (_: string, r: string) => `%s | ${t(r)}`) } : {}), ...(v.absolute ? { absolute: t(v.absolute) } : {}) } : v
  return {
    ...m,
    ...(m.title !== undefined ? { title: titulo(m.title) } : {}),
    ...(m.description !== undefined ? { description: tr(m.description) } : {}),
    ...(m.openGraph ? { openGraph: { ...m.openGraph, title: titulo(m.openGraph.title), description: tr(m.openGraph.description), locale: "en_US" } } : {}),
    ...(m.twitter ? { twitter: { ...m.twitter, title: titulo(m.twitter.title), description: tr(m.twitter.description) } } : {}),
  }
}
