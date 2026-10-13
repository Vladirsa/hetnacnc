"use client"

// No dibuja nada: solo avisa al servidor que estos anuncios se mostraron.
import { useEffect } from "react"

import { registrarVistas } from "@/lib/publicidad/vistas-cliente"

export default function PubVista({ ids }: { ids: string[] }) {
  const clave = ids.join(",")
  useEffect(() => {
    if (!clave) return
    const lista = clave.split(",")
    const t = setTimeout(() => registrarVistas(lista), 1500) // espera a que la página termine de cargar
    return () => clearTimeout(t)
  }, [clave])
  return null
}
