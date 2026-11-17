"use client"

// Si la visita viene de una liga de un correo de prospección (utm_source=correo y
// e=<empresa>), avisa una vez (app/api/app/clic-correo) y quita «e» de la barra de
// direcciones, para que no se comparta ni se cuente otra vez al recargar.
import { useEffect } from "react"

export function RastreoCorreo() {
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      const e = u.searchParams.get("e")
      if (u.searchParams.get("utm_source") !== "correo" || !e) return
      void fetch("/api/app/clic-correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ e, ruta: u.pathname, campana: u.searchParams.get("utm_campaign") || "" }),
      }).catch(() => {})
      u.searchParams.delete("e")
      window.history.replaceState(window.history.state, "", u.pathname + (u.search ? u.search : "") + u.hash)
    } catch {
      // nada
    }
  }, [])
  return null
}
