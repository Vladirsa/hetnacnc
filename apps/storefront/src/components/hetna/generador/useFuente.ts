"use client"

// Carga una tipografía (lib/generador/fuentes) sólo cuando hace falta y
// devuelve la función que pasa texto a trazos en mm, centrados en (0,0).
import { useEffect, useMemo, useState } from "react"

import { FUENTES, cargarFuente } from "@/lib/generador/fuentes"
import type { Fuente } from "@/lib/generador/letreros"
import { textoATrazos } from "@/lib/generador/textoTrazos"

export function useFuente(id: string, hace_falta = true) {
  const [fuentes, setFuentes] = useState<Record<string, Fuente>>({})
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!hace_falta || fuentes[id]) return
    const t = FUENTES.find((f) => f.id === id) || FUENTES[0]
    let vivo = true
    setError(false)
    cargarFuente(t)
      .then((f) => vivo && setFuentes((x) => ({ ...x, [id]: f })))
      .catch(() => vivo && setError(true))
    return () => {
      vivo = false
    }
  }, [id, hace_falta, fuentes])
  const fuente = fuentes[id] || null
  const texto = useMemo(() => (fuente ? (t: string, alto: number, capa: string) => textoATrazos(fuente, t, alto, capa) : null), [fuente])
  return { fuente, texto, error }
}
