"use client"

// Cuenta el uso de la herramienta abierta (lib/generador/uso.ts): la visita al
// abrirla, las descargas (cualquier <a download> que la herramienta dispare) y
// lo que avisan Cotizar, Fabrícamelo, CAM y "Mándamelo por correo". Cada cosa
// cuenta una vez por herramienta y por sesión del navegador: el número dice
// cuánta gente lo hizo, no cuántos clics. No se manda nada personal.
import { useEffect } from "react"

import { EVENTOS_USO, EVENTO_USO, type EventoUso } from "@/lib/generador/uso"

function contar(herramienta: string, evento: EventoUso) {
  try {
    const clave = `hetna-uso:${herramienta}:${evento}`
    if (sessionStorage.getItem(clave)) return
    sessionStorage.setItem(clave, "1")
  } catch {
    // sin sessionStorage (modo privado estricto): se cuenta igual
  }
  fetch("/api/herramienta-uso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ herramienta, evento }),
    keepalive: true,
  }).catch(() => {})
}

export function ContarUsoHerramienta({ herramienta }: { herramienta: string }) {
  useEffect(() => {
    contar(herramienta, "vista")
    const alAvisar = (e: Event) => {
      const ev = (e as CustomEvent).detail
      if ((EVENTOS_USO as readonly string[]).includes(ev)) contar(herramienta, ev as EventoUso)
    }
    // las herramientas descargan creando un <a download> y dándole clic
    const alClic = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[download]")
      if (a) contar(herramienta, "descarga")
    }
    window.addEventListener(EVENTO_USO, alAvisar)
    document.addEventListener("click", alClic, true)
    return () => {
      window.removeEventListener(EVENTO_USO, alAvisar)
      document.removeEventListener("click", alClic, true)
    }
  }, [herramienta])
  return null
}
