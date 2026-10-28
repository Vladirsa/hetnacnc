import { cookies, headers } from "next/headers"

import { COOKIE_IDIOMA } from "@/i18n/idioma"

// Idioma de la página, decidido en el servidor con la misma regla que el resto
// del sitio: manda la cookie elegida; sin elección, /us va en inglés y lo demás
// en español. Sirve para páginas que tienen su propio texto en inglés (p. ej.
// las legales), en vez de depender del traductor del navegador.
export async function idiomaServidor(): Promise<"es" | "en"> {
  const elegido = (await cookies()).get(COOKIE_IDIOMA)?.value
  if (elegido) return elegido === "en" ? "en" : "es"
  const locale = (await headers()).get("x-hetna-locale") || ""
  return locale === "us" ? "en" : "es"
}
