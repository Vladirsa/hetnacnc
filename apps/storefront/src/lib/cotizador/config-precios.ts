"use client"

// Los ajustes de precio del dueño (Panel de HETNA > Precios de la calculadora).
// Mientras llegan, la calculadora usa los valores de fábrica.
import { useEffect, useState } from "react"

import type { ConfigPrecios } from "./estimador"

let memoria: Promise<ConfigPrecios> | null = null

export function useConfigPrecios(): ConfigPrecios | null {
  const [cfg, setCfg] = useState<ConfigPrecios | null>(null)
  useEffect(() => {
    memoria ||= fetch("/api/precios-config")
      .then((r) => (r.ok ? r.json() : { cfg: {} }))
      .then((d) => (d?.cfg || {}) as ConfigPrecios)
      .catch(() => ({}))
    let vivo = true
    memoria.then((c) => vivo && setCfg(c))
    return () => {
      vivo = false
    }
  }, [])
  return cfg
}
