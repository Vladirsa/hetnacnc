"use client"

// Dónde está el cliente, para ordenar talleres por cercanía. Todo pasa en el
// navegador (las fichas se guardan en caché y no pueden llevar datos de quien
// las ve):
//   1. Lo que ya dijo antes: su código postal (localStorage "hetna_ubicacion").
//   2. Si no, el estado aproximado por su IP (/api/ubicacion), una vez por visita.
//   3. Cuando escribe su código postal aquí o en /cotizar (evento
//      "hetna:ubicacion" de FormSolicitudTaller) se guarda y manda sobre lo de la IP.
import { useCallback, useEffect, useState } from "react"

import { buscarCP } from "@/lib/envios/cotizar"
import { normalizarEstado, type UbicacionCliente } from "@/lib/ubicacion/cercania"

export type Ubicacion = UbicacionCliente & { fuente: "cp" | "ip" }

const CLAVE = "hetna_ubicacion"
const CLAVE_IP = "hetna_ubicacion_ip"
const EVENTO = "hetna:ubicacion"

const leer = (s: Storage, k: string): Ubicacion | null => {
  try {
    const v = JSON.parse(s.getItem(k) || "null")
    return v && typeof v === "object" && typeof v.estado === "string" ? v : null
  } catch {
    return null
  }
}

export function useUbicacion() {
  const [u, setU] = useState<Ubicacion | null>(null)
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    const guardada = leer(localStorage, CLAVE)
    if (guardada) setU(guardada)
    else {
      const ip = leer(sessionStorage, CLAVE_IP)
      if (ip) setU(ip)
      else if (!sessionStorage.getItem(CLAVE_IP)) {
        sessionStorage.setItem(CLAVE_IP, "null") // una sola consulta por visita
        fetch("/api/ubicacion", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : {}))
          .then((d: { estado?: string; ciudad?: string }) => {
            if (!d?.estado || leer(localStorage, CLAVE)) return
            const v: Ubicacion = { estado: d.estado, municipio: d.ciudad || "", fuente: "ip" }
            sessionStorage.setItem(CLAVE_IP, JSON.stringify(v))
            setU(v)
          })
          .catch(() => {})
      }
    }
    // El formulario de /cotizar (u otra lista en la misma página) avisa con este evento
    const f = (e: Event) => {
      const d = (e as CustomEvent<UbicacionCliente>).detail
      if (!d?.estado) return
      const v: Ubicacion = { cp: d.cp, municipio: d.municipio, estado: normalizarEstado(d.estado) || d.estado, fuente: "cp" }
      localStorage.setItem(CLAVE, JSON.stringify(v))
      setU(v)
    }
    window.addEventListener(EVENTO, f)
    return () => window.removeEventListener(EVENTO, f)
  }, [])

  /** Busca el código postal y, si existe, lo guarda y avisa a las demás listas de la página. */
  const ponerCp = useCallback(async (cp: string) => {
    setAviso("")
    const r = await buscarCP(cp)
    if (!r.ok) {
      setAviso(r.mensaje)
      return false
    }
    const municipio = r.info.municipio || r.info.ciudad
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: { cp, municipio, estado: r.info.estado } }))
    return true
  }, [])

  return { ubicacion: u, ponerCp, aviso }
}
