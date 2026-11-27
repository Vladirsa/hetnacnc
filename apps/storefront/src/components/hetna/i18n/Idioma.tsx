"use client"

// Idioma en los componentes (se arman en el servidor y en el navegador igual):
//   <T>Texto en español</T>      -> el texto en inglés cuando la página va en inglés
//   const t = useT(); t("Texto") -> para atributos (placeholder, title, alt…)
// El idioma lo decide el servidor (i18n/servidor.ts) y llega por <IdiomaProvider>.
// El diccionario (src/i18n/en.ts) sólo se descarga cuando la página va en
// inglés: quien navega en español no lo baja.
import { createContext, use, useContext, useMemo, type ReactNode } from "react"

import type { Idioma } from "@/i18n/servidor"
import { crearT, sinTraducir } from "@/i18n/traducir"

const Contexto = createContext<Idioma>("es")
// (cast: el repo mezcla versiones de @types/react y Provider "no es componente JSX" para tsc)
const Proveedor = Contexto.Provider as unknown as (p: { value: Idioma; children: ReactNode }) => any

let carga: Promise<ReturnType<typeof crearT>> | null = null
const cargarT = () => (carga ??= import("@/i18n/diccionario").then((m) => crearT(m.EN, m.REGLAS)))

export function IdiomaProvider({ idioma, children }: { idioma: Idioma; children: ReactNode }) {
  // Empieza a bajar el diccionario desde el primer render (no hasta el primer <T>)
  if (idioma === "en") cargarT()
  return <Proveedor value={idioma}>{children}</Proveedor>
}

export const useIdioma = () => useContext(Contexto)

export function useT(): (texto: string) => string {
  const idioma = useContext(Contexto)
  // use() espera el diccionario igual en el servidor y al hidratar: el HTML
  // sale ya en inglés y React no ve diferencias.
  const t = idioma === "en" ? use(cargarT()) : sinTraducir
  return useMemo(() => t, [t])
}

/** Texto traducible: <T>Agregar al carrito</T> */
export function T({ children }: { children?: ReactNode }) {
  const t = useT()
  if (typeof children === "string") return <>{t(children)}</>
  if (typeof children === "number") return <>{children}</>
  return <>{children}</>
}
