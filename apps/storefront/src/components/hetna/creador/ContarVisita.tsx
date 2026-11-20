"use client"

import { useEffect } from "react"

import { contarVisitaCreador } from "@/lib/hetna/creador-acciones"

// Cuenta una visita a la página del creador (una vez por sesión del navegador).
export function ContarVisita({ codigo }: { codigo: string }) {
  useEffect(() => {
    const llave = `hetna_creador_visita_${codigo}`
    try {
      if (sessionStorage.getItem(llave)) return
      sessionStorage.setItem(llave, "1")
    } catch {}
    contarVisitaCreador(codigo).catch(() => {})
  }, [codigo])
  return null
}
